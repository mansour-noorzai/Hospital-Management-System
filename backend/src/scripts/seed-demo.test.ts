import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { seedDemo } from './seed-demo';
import { rotateDemoPassword } from './rotate-demo-password';
import { User } from '../models/User';
import { Hospital } from '../models/Hospital';
import { Patient } from '../models/Patient';
import { Appointment } from '../models/Appointment';
import { Invoice } from '../models/Invoice';
import { Document } from '../models/Document';
import { app } from '../app';

jest.mock('../middleware/rateLimiter', () => ({ rateLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock('../socket', () => ({ emitToUser: jest.fn(), emitToCurrentHospital: jest.fn(), emitToHospitalRole: jest.fn(), emitToHospital: jest.fn(), emitToRole: jest.fn() }));

let database: MongoMemoryServer;
beforeAll(async () => {
  database = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
  await mongoose.connect(database.getUri());
  for (const model of Object.values(mongoose.models)) await model.init();
}, 120000);
afterAll(async () => { await mongoose.disconnect(); await database?.stop(); });

test('seed creates all roles, repeat runs preserve edits, and demo records are accessible through the API', async () => {
  await Promise.all([seedDemo(), seedDemo()]);
  expect(await User.countDocuments()).toBe(6);
  expect(await Patient.countDocuments()).toBe(2);
  expect(await Appointment.countDocuments()).toBe(2);
  expect(await Invoice.countDocuments()).toBe(1);
  expect(await Document.countDocuments()).toBe(1);

  const admin = await User.findOne({ email: 'admin@medicore.demo' }).select('+password');
  admin!.firstName = 'Preserved edit';
  admin!.password = 'ChangedDemoPassword-2026!';
  await admin!.save();
  const before = (await User.find().sort('_id').lean()).map(user => String(user._id));
  await seedDemo();
  expect((await User.find().sort('_id').lean()).map(user => String(user._id))).toEqual(before);
  expect((await User.findById(admin!._id))!.firstName).toBe('Preserved edit');

  const login = await request(app).post('/api/v1/auth/login').send({ email: 'admin@medicore.demo', password: 'ChangedDemoPassword-2026!' });
  expect(login.status).toBe(200);
  expect(login.body.data.user.role).toBe('admin');
  const token = login.body.data.accessToken;
  for (const path of ['/patients', '/doctors', '/departments', '/appointments', '/billing', '/pharmacy/drugs', '/pharmacy/prescriptions', '/inventory/items', '/documents', '/analytics/appointments']) {
    const response = await request(app).get(`/api/v1${path}`).set('Authorization', `Bearer ${token}`);
    expect({ path, status: response.status }).toEqual({ path, status: 200 });
    expect(response.body.success).toBe(true);
  }
  for (const role of ['doctor', 'nurse', 'receptionist', 'patient']) {
    const result = await request(app).post('/api/v1/auth/login').send({ email: `${role}@medicore.demo`, password: 'DemoPass123!' });
    expect({ role, status: result.status }).toEqual({ role, status: 200 });
    expect(result.body.data.user.role).toBe(role);
  }
  const invoice = await Invoice.findOne();
  expect(invoice!.total).toBe(800);
  expect(invoice!.balance).toBe(500);
}, 120000);

test('an interrupted seed resumes without duplicates or data loss', async () => {
  const hospital = await Hospital.findOne({ slug: 'medicore-demo' });
  const ids = (await User.find({ hospitalId: hospital!._id }).lean()).map(user => String(user._id)).sort();
  // Remove only the completion marker in this isolated test database.
  await mongoose.connection.collection('deployment_seeds').deleteMany({});
  await seedDemo();
  expect((await User.find({ hospitalId: hospital!._id }).lean()).map(user => String(user._id)).sort()).toEqual(ids);
  expect(await Appointment.countDocuments()).toBe(2);
  expect(await Invoice.countDocuments()).toBe(1);
  expect((await User.findOne({ email: 'admin@medicore.demo' }))!.firstName).toBe('Preserved edit');
});

test('maintenance rejects unauthenticated callers', async () => {
  const result = await request(app).get('/api/v1/internal/maintenance');
  expect(result.status).toBe(401);
});

test('explicit demo recovery rotates once and preserves subsequent password edits', async () => {
  const saved = { ...process.env };
  try {
    process.env.DEMO_PASSWORD_ROTATION_ID = 'test-handover';
    await expect(rotateDemoPassword()).rejects.toThrow('explicit demo settings');
    process.env.DEMO_MODE = 'true';
    process.env.ALLOW_DEMO_SEED = 'true';
    process.env.DEMO_PASSWORD = 'Recovered-Demo-Password-2026!';
    await rotateDemoPassword();
    const users = await User.find().select('+password +sessionVersion');
    expect(users).toHaveLength(6);
    for (const user of users) expect(await user.comparePassword(process.env.DEMO_PASSWORD)).toBe(true);
    const admin = users.find(user => user.role === 'admin')!;
    expect(admin.firstName).toBe('Preserved edit');
    const version = admin.sessionVersion;
    admin.password = 'Owner-Changed-Password-2026!';
    await admin.save();
    await rotateDemoPassword();
    const preserved = await User.findById(admin._id).select('+password +sessionVersion');
    expect(await preserved!.comparePassword('Owner-Changed-Password-2026!')).toBe(true);
    expect(preserved!.sessionVersion).toBe(version);
    expect(await Appointment.countDocuments()).toBe(2);
    expect(await Invoice.countDocuments()).toBe(1);
  } finally { process.env = saved; }
}, 120000);
