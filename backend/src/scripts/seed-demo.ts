import { connectDB, disconnectDB } from '../db/mongoose';
import { Hospital } from '../models/Hospital';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Doctor } from '../models/Doctor';
import { Nurse } from '../models/Nurse';
import { Receptionist } from '../models/Receptionist';
import { Patient } from '../models/Patient';
import { Appointment } from '../models/Appointment';
import { Drug } from '../models/Drug';
import { Prescription } from '../models/Prescription';
import { InventoryItem } from '../models/InventoryItem';
import { InventoryCategory } from '../models/InventoryCategory';
import { StockMovement } from '../models/StockMovement';
import { Invoice } from '../models/Invoice';
import { LabOrder } from '../models/LabOrder';
import { LabResult } from '../models/LabResult';
import { Document } from '../models/Document';

import mongoose, { Model, Types } from 'mongoose';
import { createHash } from 'node:crypto';

const SEED_VERSION = 'medicore-demo-v1';

/** Stable IDs make interrupted and concurrent seed attempts safe to resume. */
async function ensureRecord<T>(model: Model<T>, key: string, data: Record<string, unknown>) {
  const _id = new Types.ObjectId(createHash('sha256').update(`${SEED_VERSION}:${key}`).digest('hex').slice(0, 24));
  const existing = await model.findById(_id);
  if (existing) return existing;
  try {
    return await model.create({ ...data, _id });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrent = await model.findById(_id);
      if (concurrent) return concurrent;
    }
    throw error;
  }
}


export async function seedDemo() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
    throw new Error('Demo seeding is disabled in production. Set ALLOW_DEMO_SEED=true only for an isolated demo environment.');
  }

  const DEMO_PASSWORD = process.env.DEMO_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'DemoPass123!');
  if (process.env.NODE_ENV === 'production' && (process.env.DEMO_MODE !== 'true' || DEMO_PASSWORD.length < 16)) {
    throw new Error('Production demo seeding requires DEMO_MODE=true and a DEMO_PASSWORD of at least 16 characters.');
  }
  const runs = mongoose.connection.collection<{ _id: string; completedAt?: Date }>('deployment_seeds');
  if (await runs.findOne({ _id: SEED_VERSION, completedAt: { $exists: true } })) {
    console.log('Demo seed already completed; preserving existing records and passwords.');
    return;
  }

  let hospital = await Hospital.findOne({ slug: 'medicore-demo' });
  if (!hospital) {
    hospital = await ensureRecord(Hospital, 'hospital', {
      name: 'MediCore Demo Hospital',
      systemName: 'MediCore Hospital Management System',
      shortName: 'MediCore',
      slug: 'medicore-demo',
      address: 'Herat, Afghanistan',
      phone: '+93 700 000 000',
      email: 'info@medicore.demo',
      emergencyContact: '112',
      currency: 'AFN',
      timezone: 'Asia/Kabul',
      dateFormat: 'yyyy-MM-dd',
      defaultLanguage: 'en',
      defaultTheme: 'light',
      defaultTaxRate: 0,
      workingHours: { start: '08:00', end: '17:00' },
      invoiceFooter: 'Thank you for choosing MediCore.',
      prescriptionFooter: 'Use medicines only as prescribed.',
    });
  }

  const hospitalId = hospital._id;

  await ensureRecord(InventoryCategory, 'category-ppe', { hospitalId, name: 'PPE', description: 'Personal protective equipment' });
  await ensureRecord(InventoryCategory, 'category-consumable', { hospitalId, name: 'Consumable', description: 'Everyday hospital supplies' });

  const cardiology = await ensureRecord(Department, 'cardiology', {
    hospitalId,
    name: 'Cardiology',
    description: 'Cardiac consultation and follow-up services',
    bedCount: 24,
    location: 'Block A - Floor 2',
  });
  const general = await ensureRecord(Department, 'general', {
    hospitalId,
    name: 'General Medicine',
    description: 'General outpatient and inpatient care',
    bedCount: 32,
    location: 'Block B - Floor 1',
  });
  await ensureRecord(Department, 'laboratory', {
    hospitalId,
    name: 'Laboratory',
    description: 'Clinical laboratory services',
    bedCount: 0,
    location: 'Block C - Ground Floor',
  });

  const admin = await ensureRecord(User, 'admin', {
    hospitalId,
    firstName: 'Demo',
    lastName: 'Administrator',
    email: 'admin@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'admin',
    isPlatformAdmin: false,
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
    preferredLanguage: 'en',
  });

  const doctorUser = await ensureRecord(User, 'doctor-user', {
    hospitalId,
    firstName: 'Ahmad',
    lastName: 'Rahimi',
    email: 'doctor@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'doctor',
    phone: '+93 700 000 101',
    gender: 'male',
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
  });
  const doctor = await ensureRecord(Doctor, 'doctor', {
    hospitalId,
    userId: doctorUser._id,
    specialization: 'Cardiology',
    qualification: ['MD', 'Internal Medicine', 'Cardiology'],
    licenseNumber: 'MED-DEMO-1001',
    department: cardiology._id,
    consultationFee: 700,
    rating: 4.8,
    reviewCount: 28,
    availability: [
      { day: 'saturday', startTime: '09:00', endTime: '15:00' },
      { day: 'sunday', startTime: '09:00', endTime: '15:00' },
      { day: 'monday', startTime: '09:00', endTime: '15:00' },
      { day: 'tuesday', startTime: '09:00', endTime: '15:00' },
      { day: 'wednesday', startTime: '09:00', endTime: '15:00' },
    ],
  });

  const nurseUser = await ensureRecord(User, 'nurse-user', {
    hospitalId,
    firstName: 'Maryam',
    lastName: 'Noori',
    email: 'nurse@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'nurse',
    phone: '+93 700 000 102',
    gender: 'female',
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
  });
  await ensureRecord(Nurse, 'nurse', {
    hospitalId,
    userId: nurseUser._id,
    ward: 'General Ward',
    department: general._id,
    shift: 'morning',
    qualification: ['Registered Nurse'],
  });

  const receptionistUser = await ensureRecord(User, 'receptionist-user', {
    hospitalId,
    firstName: 'Farid',
    lastName: 'Ahmadi',
    email: 'receptionist@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'receptionist',
    phone: '+93 700 000 103',
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
  });
  await ensureRecord(Receptionist, 'receptionist', {
    hospitalId,
    userId: receptionistUser._id,
    department: general._id,
  });

  const patientUser = await ensureRecord(User, 'patient-user', {
    hospitalId,
    firstName: 'Sami',
    lastName: 'Karimi',
    email: 'patient@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'patient',
    phone: '+93 700 000 201',
    dob: new Date('1996-05-18'),
    gender: 'male',
    address: { city: 'Herat', state: 'Herat' },
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
  });
  const patient = await ensureRecord(Patient, 'patient', {
    hospitalId,
    userId: patientUser._id,
    bloodGroup: 'O+',
    allergies: ['Penicillin'],
    emergencyContact: { name: 'Omid Karimi', relationship: 'Brother', phone: '+93 700 000 202' },
    medicalHistory: [
      { condition: 'Hypertension', diagnosisDate: new Date('2024-02-10'), treatment: 'Lifestyle modification', notes: 'Monitor blood pressure.' },
    ],
    insuranceInfo: { provider: 'Demo Health Insurance', policyNumber: 'DHI-2026-1001', expiryDate: new Date('2027-12-31') },
  });

  const secondPatientUser = await ensureRecord(User, 'patient2-user', {
    hospitalId,
    firstName: 'Laila',
    lastName: 'Hosseini',
    email: 'patient2@medicore.demo',
    password: DEMO_PASSWORD,
    role: 'patient',
    phone: '+93 700 000 203',
    dob: new Date('1991-09-03'),
    gender: 'female',
    status: 'active',
    isActive: true,
    forcePasswordChange: false,
  });
  const secondPatient = await ensureRecord(Patient, 'patient2', {
    hospitalId,
    userId: secondPatientUser._id,
    bloodGroup: 'A+',
    allergies: [],
    medicalHistory: [],
  });

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  twoDaysAgo.setHours(0, 0, 0, 0);

  const upcomingAppointment = await ensureRecord(Appointment, 'upcoming-appointment', {
    hospitalId,
    patient: patient._id,
    doctor: doctor._id,
    department: cardiology._id,
    date: tomorrow,
    timeSlot: '10:00',
    type: 'consultation',
    status: 'confirmed',
    reason: 'Blood pressure follow-up',
    createdBy: receptionistUser._id,
  });
  const completedAppointment = await ensureRecord(Appointment, 'completed-appointment', {
    hospitalId,
    patient: secondPatient._id,
    doctor: doctor._id,
    department: cardiology._id,
    date: twoDaysAgo,
    timeSlot: '11:00',
    type: 'follow-up',
    status: 'completed',
    reason: 'Routine cardiac follow-up',
    notes: 'Stable. Continue current management.',
    createdBy: receptionistUser._id,
  });

  const paracetamol = await ensureRecord(Drug, 'paracetamol', {
    hospitalId,
    name: 'Paracetamol 500 mg (Demo)',
    code: 'MED-PARA-500-DEMO',
    category: 'Analgesic',
    unit: 'tablet',
    stockQuantity: 180,
    reorderLevel: 40,
    description: 'Pain and fever relief',
  });
  const amlodipine = await ensureRecord(Drug, 'amlodipine', {
    hospitalId,
    name: 'Amlodipine 5 mg (Demo)',
    code: 'MED-AMLO-5-DEMO',
    category: 'Antihypertensive',
    unit: 'tablet',
    stockQuantity: 120,
    reorderLevel: 30,
    description: 'Calcium-channel blocker',
  });

  const prescription = await ensureRecord(Prescription, 'active-prescription', {
    hospitalId,
    patientId: patient._id,
    doctorId: doctor._id,
    appointmentId: upcomingAppointment._id,
    lineItems: [
      { drugId: amlodipine._id, drugName: amlodipine.name, dosage: '5 mg', frequency: 'Once daily', duration: '30 days', quantity: 30 },
    ],
    status: 'active',
    notes: 'Take at the same time each day.',
  });
  await ensureRecord(Prescription, 'dispensed-prescription', {
    hospitalId,
    patientId: secondPatient._id,
    doctorId: doctor._id,
    appointmentId: completedAppointment._id,
    lineItems: [
      { drugId: paracetamol._id, drugName: paracetamol.name, dosage: '500 mg', frequency: 'Every 8 hours as needed', duration: '5 days', quantity: 15 },
    ],
    status: 'dispensed',
    dispensedBy: nurseUser._id,
    dispensedAt: now,
  });

  const gloves = await ensureRecord(InventoryItem, 'gloves', {
    hospitalId,
    name: 'Examination Gloves',
    code: 'SUP-GLOVE-DEMO',
    category: 'PPE',
    quantity: 450,
    unit: 'pair',
    reorderLevel: 100,
    supplier: 'Demo Medical Supply',
  });
  const syringes = await ensureRecord(InventoryItem, 'syringes', {
    hospitalId,
    name: '5 ml Syringe',
    code: 'SUP-SYR-5-DEMO',
    category: 'Consumable',
    quantity: 75,
    unit: 'piece',
    reorderLevel: 100,
    supplier: 'Demo Medical Supply',
  });
  await ensureRecord(StockMovement, 'gloves-opening', {
    hospitalId,
    itemId: gloves._id,
    type: 'in',
    quantity: 450,
    previousQuantity: 0,
    newQuantity: 450,
    reason: 'Opening demo stock',
    performedBy: admin._id,
  });
  await ensureRecord(StockMovement, 'syringes-opening', {
    hospitalId,
    itemId: syringes._id,
    type: 'in',
    quantity: 75,
    previousQuantity: 0,
    newQuantity: 75,
    reason: 'Opening demo stock',
    performedBy: admin._id,
  });

  const invoice = await ensureRecord(Invoice, 'invoice', {
    hospitalId,
    patient: patient._id,
    appointment: upcomingAppointment._id,
    lineItems: [
      { description: 'Cardiology consultation', quantity: 1, unitPrice: 700 },
      { description: 'Blood pressure assessment', quantity: 1, unitPrice: 150 },
    ],
    taxRate: 0,
    discount: 50,
    status: 'issued',
    issuedDate: now,
    dueDate: tomorrow,
    issuedBy: receptionistUser._id,
    notes: 'Demo outpatient invoice',
    payments: [{ amount: 300, method: 'cash', paidAt: now, recordedBy: receptionistUser._id, reference: 'DEMO-CASH-001' }],
  });

  const labOrder = await ensureRecord(LabOrder, 'lab-order', {
    hospitalId,
    patient: patient._id,
    doctor: doctor._id,
    appointment: upcomingAppointment._id,
    tests: [
      { name: 'Complete Blood Count', code: 'CBC', status: 'completed' },
      { name: 'Fasting Blood Sugar', code: 'FBS', status: 'completed' },
    ],
    priority: 'routine',
    status: 'completed',
    notes: 'Baseline follow-up tests',
  });
  await ensureRecord(LabResult, 'lab-result', {
    hospitalId,
    labOrder: labOrder._id,
    patient: patient._id,
    results: [
      { testCode: 'CBC', testName: 'Hemoglobin', value: '14.2', unit: 'g/dL', referenceRange: '13-17', isNormal: true },
      { testCode: 'FBS', testName: 'Fasting Blood Sugar', value: '96', unit: 'mg/dL', referenceRange: '70-99', isNormal: true },
    ],
    status: 'final',
    technician: nurseUser._id,
    verifiedBy: doctor._id,
    collectedAt: now,
    resultedAt: now,
    verifiedAt: now,
    notes: 'Results within expected range.',
  });

  await ensureRecord(Document, 'certificate', {
    hospitalId,
    type: 'medical_certificate',
    patientId: patient._id,
    issuedBy: doctor._id,
    content: 'Patient attended MediCore Demo Hospital for medical assessment and follow-up.',
    status: 'issued',
    issuedAt: now,
    notes: 'Demo certificate',
  });

  await Department.updateOne({ _id: cardiology._id, head: { $exists: false } }, { $set: { head: doctor._id } });
  await runs.updateOne({ _id: SEED_VERSION }, { $set: { completedAt: new Date() } }, { upsert: true });

  console.log('\nDemo hospital data created successfully.');
  console.log(`Hospital: ${hospital.name}`);
  console.log('Demo passwords come from DEMO_PASSWORD; values are never printed.');
  console.log('Admin:        admin@medicore.demo');
  console.log('Doctor:       doctor@medicore.demo');
  console.log('Nurse:        nurse@medicore.demo');
  console.log('Receptionist: receptionist@medicore.demo');
  console.log('Patient:      patient@medicore.demo');
  console.log('Patient #2:   patient2@medicore.demo');
  console.log(`Sample invoice: ${invoice.invoiceId}`);
  console.log(`Sample prescription: ${prescription.prescriptionId}`);
  console.log(`Sample appointment: ${upcomingAppointment.appointmentId}`);
  console.log(`Lab order: ${labOrder.orderId}`);
}

if (require.main === module) {
  connectDB().then(() => seedDemo()).catch(() => {
    console.error('Demo seed failed. Check configuration, database access and existing account conflicts.');
    process.exitCode = 1;
  }).finally(() => disconnectDB());
}
