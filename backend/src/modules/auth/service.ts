import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { User, IUser } from '../../models/User';
import { RefreshToken, hashToken } from '../../models/RefreshToken';
import { Patient } from '../../models/Patient';
import { AppError, AuthError, ConflictError } from '../../middleware/errorHandler';
import { logger } from '../../middleware/requestLogger';
import { Hospital } from '../../models/Hospital';
import { runWithTenant } from '../../tenant/context';

// Token config
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function generateAccessToken(user: IUser, jwtSecret: string): string {
  const hospitalId = user.hospitalId?.toString();
  if (!hospitalId && process.env.NODE_ENV !== 'test') {
    throw new AuthError('Account is not assigned to a hospital. Run the profile audit and repair migration.');
  }
  return jwt.sign(
    { _id: user._id.toString(), role: user.role, email: user.email, hospitalId, sessionVersion: user.sessionVersion },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

export async function registerUser(
  input: { firstName: string; lastName: string; email: string; password: string; phone?: string; dob?: string; gender?: string },
  jwtSecret: string
): Promise<{ user: IUser; tokens: TokenPair }> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) throw new ConflictError('Email already registered');

  const hospital = await Hospital.findOne({ status: 'active' }).sort({ createdAt: 1 });
  if (!hospital) throw new AppError(503, 'SETUP_REQUIRED', 'The platform administrator must initialize a hospital first');
  const user = await User.create({
    ...input,
    email: normalizedEmail,
    role: 'patient',
    hospitalId: hospital._id,
    dob: input.dob ? new Date(input.dob) : undefined,
  });

  try {
    await runWithTenant(hospital._id.toString(), () => Patient.create({ userId: user._id }));
    const tokens = await createTokenPair(user, jwtSecret);
    return { user, tokens };
  } catch (error) {
    // Registration is one logical operation. On standalone MongoDB we cannot
    // assume transactions are available, so compensate explicitly if any
    // downstream patient/token write fails.
    await Promise.allSettled([
      RefreshToken.deleteMany({ user: user._id }),
      Patient.deleteOne({ userId: user._id }),
      User.deleteOne({ _id: user._id }),
    ]);
    throw error;
  }
}

export async function loginUser(
  email: string,
  password: string,
  jwtSecret: string,
  meta: { userAgent?: string; ip?: string }
): Promise<{ user: IUser; tokens: TokenPair }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail }).select('+password +sessionVersion');
  if (!user) throw new AuthError('Invalid credentials');

  if (!user.isActive || user.status !== 'active') throw new AuthError('Account is inactive or suspended');

  if (user.isLocked()) {
    throw new AuthError('Account is temporarily locked due to too many failed login attempts');
  }

  const passwordMatch = await user.comparePassword(password);
  if (!passwordMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      logger.warn('Account locked', { email, failedAttempts: user.failedLoginAttempts });
    }
    await user.save();
    throw new AuthError('Invalid credentials');
  }

  // Reset failed attempts on success
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.lastLogin = new Date();
  await user.save();

  const tokens = await createTokenPair(user, jwtSecret, meta);
  return { user, tokens };
}

async function createTokenPair(
  user: IUser,
  jwtSecret: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<TokenPair> {
  const rawRefreshToken = generateRefreshToken();
  const familyId = crypto.randomUUID();

  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawRefreshToken),
    familyId,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    userAgent: meta?.userAgent,
    ipAddress: meta?.ip,
  });

  const accessToken = generateAccessToken(user, jwtSecret);
  return { accessToken, refreshToken: rawRefreshToken };
}

export async function refreshTokens(
  rawToken: string,
  jwtSecret: string,
  meta?: { userAgent?: string; ip?: string }
): Promise<TokenPair> {
  const tokenHash = hashToken(rawToken);
  const storedToken = await RefreshToken.findOne({ tokenHash });

  if (!storedToken) throw new AuthError('Invalid refresh token');

  // Reuse detection: if token is already revoked, invalidate entire family
  if (storedToken.isRevoked) {
    logger.warn('Refresh token reuse detected — revoking entire family', {
      familyId: storedToken.familyId,
      userId: storedToken.user.toString(),
    });
    await RefreshToken.updateMany({ familyId: storedToken.familyId }, { isRevoked: true });
    throw new AuthError('Refresh token reuse detected — please log in again');
  }

  if (storedToken.expiresAt < new Date()) {
    throw new AuthError('Refresh token expired');
  }

  // Revoke the used token
  storedToken.isRevoked = true;
  await storedToken.save();

  const user = await User.findById(storedToken.user).select('+sessionVersion');
  if (!user || !user.isActive || user.status !== 'active') throw new AuthError('User not found or inactive');

  // Issue new token with same familyId for chain tracking
  const rawNewToken = generateRefreshToken();
  await RefreshToken.create({
    user: user._id,
    tokenHash: hashToken(rawNewToken),
    familyId: storedToken.familyId, // same family — reuse detection traces the whole chain
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000),
    userAgent: meta?.userAgent,
    ipAddress: meta?.ip,
  });

  const accessToken = generateAccessToken(user, jwtSecret);
  return { accessToken, refreshToken: rawNewToken };
}

export async function logoutUser(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await RefreshToken.updateOne({ tokenHash }, { isRevoked: true });
}

export async function logoutAllDevices(userId: string): Promise<void> {
  await Promise.all([
    RefreshToken.updateMany({ user: userId, isRevoked: false }, { isRevoked: true }),
    User.updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } }),
  ]);
}

export async function initiatePasswordReset(email: string): Promise<string | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });
  if (!user) return null;

  const resetToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

  user.passwordResetToken = tokenHash;
  user.passwordResetExpiry = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  return resetToken;
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const user = await User.findOne({
    passwordResetToken: tokenHash,
    passwordResetExpiry: { $gt: new Date() },
    isActive: true,
  }).select('+passwordResetToken +passwordResetExpiry +sessionVersion');

  if (!user) throw new AppError(400, 'INVALID_TOKEN', 'Password reset token is invalid or expired');

  user.password = newPassword;
  user.passwordResetToken = undefined;
  user.passwordResetExpiry = undefined;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.sessionVersion += 1;
  await user.save();

  await RefreshToken.updateMany({ user: user._id, isRevoked: false }, { isRevoked: true });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await User.findById(userId).select('+password +sessionVersion');
  if (!user || !await user.comparePassword(currentPassword)) throw new AuthError('Current password is incorrect');
  user.password = newPassword; user.forcePasswordChange = false; user.sessionVersion += 1; await user.save();
  await RefreshToken.updateMany({ user: user._id, isRevoked: false }, { isRevoked: true });
}
