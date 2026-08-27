import 'dotenv/config';
import { connectDB, disconnectDB } from '../db/mongoose';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';

async function main(): Promise<void> {
  const email = process.env.ADMIN_RECOVERY_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_RECOVERY_PASSWORD;
  if (!email || !password || password.length < 12) throw new Error('Set ADMIN_RECOVERY_EMAIL and ADMIN_RECOVERY_PASSWORD (minimum 12 characters) in backend/.env');
  await connectDB();
  const admin = await User.collection.findOne({ email, role: 'admin' });
  if (!admin) throw new Error('No administrator with that email exists');
  const user = await User.findById(admin._id).select('+password +sessionVersion');
  if (!user) throw new Error('Administrator could not be loaded');
  user.password = password;
  user.status = 'active';
  user.isActive = true;
  user.forcePasswordChange = false;
  user.failedLoginAttempts = 0;
  user.lockedUntil = undefined;
  user.sessionVersion += 1;
  await user.save();
  await RefreshToken.updateMany({ user: user._id, isRevoked: false }, { isRevoked: true });
  process.stdout.write(`Administrator access recovered: ${user.email}\n`);
}

main().catch(error => { process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 1; }).finally(() => disconnectDB());
