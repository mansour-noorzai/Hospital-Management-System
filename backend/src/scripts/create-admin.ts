import 'dotenv/config';
import { connectDB, disconnectDB } from '../db/mongoose';
import { Hospital } from '../models/Hospital';
import { User } from '../models/User';

async function main(): Promise<void> {
  const email = process.env.FIRST_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FIRST_ADMIN_PASSWORD;
  const firstName = process.env.FIRST_ADMIN_FIRST_NAME?.trim() || 'Platform';
  const lastName = process.env.FIRST_ADMIN_LAST_NAME?.trim() || 'Administrator';
  if (!email || !password || password.length < 12) throw new Error('Set FIRST_ADMIN_EMAIL and FIRST_ADMIN_PASSWORD (minimum 12 characters) in backend/.env');
  await connectDB();
  if (await User.exists({ isPlatformAdmin: true })) {
    throw new Error('A platform administrator already exists; bootstrap is disabled. Use npm run recover-admin for an existing administrator account.');
  }
  let hospital = await Hospital.findOne({ slug: process.env.FIRST_HOSPITAL_SLUG || 'default-hospital' });
  if (!hospital) hospital = await Hospital.create({ name: process.env.FIRST_HOSPITAL_NAME || 'My Hospital', systemName: process.env.FIRST_HOSPITAL_SYSTEM_NAME || process.env.FIRST_SYSTEM_NAME || 'Hospital Management System', shortName: process.env.FIRST_HOSPITAL_SHORT_NAME || 'HMS', slug: process.env.FIRST_HOSPITAL_SLUG || 'default-hospital' });
  // The bootstrap owner supplies this password directly, so it is not a
  // generated temporary credential and must not block every admin route.
  const admin = await User.create({ hospitalId: hospital._id, firstName, lastName, email, password, role: 'admin', isPlatformAdmin: true, status: 'active', isActive: true, forcePasswordChange: false });
  process.stdout.write(`Platform administrator created for ${hospital.name}: ${admin.email}\n`);
}

main().catch(error => { process.stderr.write(`${(error as Error).message}\n`); process.exitCode = 1; }).finally(() => disconnectDB());
