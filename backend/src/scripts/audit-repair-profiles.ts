import 'dotenv/config';
import { connectDB, disconnectDB } from '../db/mongoose';
import { User } from '../models/User';
import { Patient } from '../models/Patient';
import { Doctor } from '../models/Doctor';
import { Nurse } from '../models/Nurse';
import { Receptionist } from '../models/Receptionist';
import { Hospital } from '../models/Hospital';
import { runWithTenant } from '../tenant/context';
import mongoose from 'mongoose';

interface Finding { type: string; userId?: string; profileId?: string; count?: number; repair: 'automatic' | 'manual'; repaired: boolean }

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectDB();
  const hospital = await Hospital.findOne({ status: 'active' }).sort({ createdAt: 1 });
  if (!hospital) throw new Error('No active hospital exists; run create-admin first');
  const hospitalCount = await Hospital.countDocuments();
  const findings: Finding[] = [];
  const tenantCollections = ['patients', 'doctors', 'nurses', 'receptionists', 'departments', 'appointments', 'laborders', 'labresults', 'prescriptions', 'drugs', 'inventoryitems', 'stockmovements', 'invoices', 'documents', 'auditlogs', 'permissionoverrides'];
  for (const collectionName of tenantCollections) {
    const collection = mongoose.connection.collection(collectionName);
    const count = await collection.countDocuments({ hospitalId: { $exists: false } });
    if (!count) continue;
    const automatic = hospitalCount === 1;
    findings.push({ type: `${collectionName}.missingHospital`, count, repair: automatic ? 'automatic' : 'manual', repaired: apply && automatic });
    if (apply && automatic) await collection.updateMany({ hospitalId: { $exists: false } }, { $set: { hospitalId: hospital._id } });
  }
  const users = await User.find({}).select('+hospitalId').lean();
  for (const user of users) {
    if (!user.hospitalId) { findings.push({ type: 'user.missingHospital', userId: user._id.toString(), repair: 'automatic', repaired: apply }); if (apply) await User.collection.updateOne({ _id: user._id }, { $set: { hospitalId: hospital._id } }); }
    const tenantId = user.hospitalId?.toString() || hospital._id.toString();
    await runWithTenant(tenantId, async () => {
      const Model = (user.role === 'patient' ? Patient : user.role === 'doctor' ? Doctor : user.role === 'nurse' ? Nurse : user.role === 'receptionist' ? Receptionist : null) as typeof Patient | null;
      if (!Model) return;
      const profile = await Model.findOne({ userId: user._id });
      if (!profile) {
        const automatic = user.role !== 'doctor';
        findings.push({ type: `${user.role}.missingProfile`, userId: user._id.toString(), repair: automatic ? 'automatic' : 'manual', repaired: apply && automatic });
        if (apply && automatic) await Model.create({ userId: user._id });
      }
    });
  }
  for (const [name, RawModel] of [['patient', Patient], ['doctor', Doctor], ['nurse', Nurse], ['receptionist', Receptionist]] as const) {
    const Model = RawModel as typeof Patient;
    for (const profile of await Model.find({}).lean()) if (!await User.exists({ _id: profile.userId })) findings.push({ type: `${name}.orphanProfile`, profileId: profile._id.toString(), repair: 'manual', repaired: false });
  }
  process.stdout.write(`${JSON.stringify({ mode: apply ? 'apply' : 'dry-run', generatedAt: new Date().toISOString(), findings }, null, 2)}\n`);
}

main().catch(error => { process.stderr.write(`${(error as Error).stack || error}\n`); process.exitCode = 1; }).finally(() => disconnectDB());
