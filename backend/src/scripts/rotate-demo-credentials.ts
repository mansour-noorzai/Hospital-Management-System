import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';

const accountKeys = ['admin', 'doctor-user', 'nurse-user', 'receptionist-user', 'patient-user', 'patient2-user'] as const;
const loginNames = ['admin', 'doctor', 'nurse', 'receptionist', 'patient', 'patient2'] as const;

/** Rotate only the six deterministic demo accounts; leave all other users alone. */
export async function rotateDemoCredentials() {
  const rotationId = process.env.DEMO_CREDENTIAL_ROTATION_ID;
  if (!rotationId) return;
  const password = process.env.DEMO_PASSWORD || '';
  if (process.env.DEMO_MODE !== 'true' || process.env.ALLOW_DEMO_SEED !== 'true' ||
      password.length < 16 || !/^[a-z0-9_-]{1,40}$/.test(rotationId)) {
    throw new Error('Demo credential rotation requires explicit demo settings, a strong password, and a lowercase rotation ID.');
  }

  const runs = mongoose.connection.collection<{ _id: string; completedAt: Date }>('deployment_seeds');
  const marker = `demo-credential-rotation:v2:${rotationId}`;
  if (await runs.findOne({ _id: marker })) return;

  const ids = accountKeys.map(key => new Types.ObjectId(createHash('sha256').update(`medicore-demo-v1:${key}`).digest('hex').slice(0, 24)));
  const users = await User.find({ _id: { $in: ids }, email: /@medicore\.demo$/ }).select('+password +sessionVersion');
  if (users.length !== ids.length) throw new Error('Expected all six seeded demo accounts before credential rotation.');
  const emails = loginNames.map(name => `${name}@medicore.demo`);
  if (await User.exists({ email: { $in: emails }, _id: { $nin: ids } })) {
    throw new Error('A requested demo email already belongs to another account.');
  }

  for (let i = 0; i < ids.length; i++) {
    const user = users.find(candidate => candidate._id.equals(ids[i]))!;
    user.email = emails[i];
    user.password = password;
    user.failedLoginAttempts = 0;
    user.lockedUntil = undefined;
    user.passwordResetToken = undefined;
    user.passwordResetExpiry = undefined;
    user.sessionVersion += 1;
    await user.save();
    await RefreshToken.updateMany({ user: user._id, isRevoked: false }, { isRevoked: true });
  }
  await runs.updateOne({ _id: marker }, { $setOnInsert: { completedAt: new Date() } }, { upsert: true });
  console.log('One-time canonical demo credential rotation completed for six accounts.');
}
