import { createHash } from 'node:crypto';
import mongoose, { Types } from 'mongoose';
import { User } from '../models/User';
import { RefreshToken } from '../models/RefreshToken';

/** Explicit, once-per-ID recovery for only the six deterministic demo accounts. */
export async function rotateDemoPassword() {
  const rotationId = process.env.DEMO_PASSWORD_ROTATION_ID;
  if (!rotationId) return;
  const password = process.env.DEMO_PASSWORD || '';
  if (process.env.DEMO_MODE !== 'true' || process.env.ALLOW_DEMO_SEED !== 'true' ||
      password.length < 16 || !/^[a-zA-Z0-9_-]{1,80}$/.test(rotationId)) {
    throw new Error('Demo credential recovery requires explicit demo settings and a strong password.');
  }
  const runs = mongoose.connection.collection<{ _id: string; completedAt: Date }>('deployment_seeds');
  const marker = `demo-password-rotation:${rotationId}`;
  if (await runs.findOne({ _id: marker })) return;
  const keys = ['admin', 'doctor-user', 'nurse-user', 'receptionist-user', 'patient-user', 'patient2-user'];
  const ids = keys.map(key => new Types.ObjectId(createHash('sha256').update(`medicore-demo-v1:${key}`).digest('hex').slice(0, 24)));
  const users = await User.find({ _id: { $in: ids }, email: /@medicore\.demo$/ }).select('+password +sessionVersion');
  if (users.length !== 6) throw new Error('Expected all six seeded demo accounts before recovery.');
  for (const user of users) {
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
  console.log('One-time demo credential recovery completed; passwords are never printed.');
}
