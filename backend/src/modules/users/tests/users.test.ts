import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Request, Response, NextFunction } from 'express';

jest.mock('../../../middleware/rateLimiter', () => ({
  rateLimiter: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('../../../middleware/requestLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
  requestLogger: (_req: Request, _res: Response, next: NextFunction) => next(),
}));
jest.mock('../../../socket', () => ({
  emitToUser: jest.fn(), emitToRole: jest.fn(), emitToCurrentHospital: jest.fn(),
  emitToHospital: jest.fn(), emitToHospitalRole: jest.fn(),
}));

import { app } from '../../../app';
import { Hospital } from '../../../models/Hospital';
import { User } from '../../../models/User';
import { Doctor } from '../../../models/Doctor';
import { Nurse } from '../../../models/Nurse';
import { Patient } from '../../../models/Patient';
import { AuditLog } from '../../../models/AuditLog';

let mongo: MongoMemoryServer;
let adminToken = '';
let hospitalA = '';
let hospitalB = '';
let otherHospitalUserId = '';

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-for-jwt';
  mongo = await MongoMemoryServer.create({ instance: { args: ['--nounixsocket'] } });
  await mongoose.connect(mongo.getUri());

  const [a, b] = await Hospital.create([
    { name: 'Hospital A', systemName: 'Hospital A', shortName: 'HA', slug: 'hospital-a' },
    { name: 'Hospital B', systemName: 'Hospital B', shortName: 'HB', slug: 'hospital-b' },
  ]);
  hospitalA = a._id.toString();
  hospitalB = b._id.toString();
  await User.create({ hospitalId: a._id, firstName: 'Hospital', lastName: 'Admin', email: 'admin@a.test', password: 'AdminPass1!', role: 'admin' });
  const other = await User.create({ hospitalId: b._id, firstName: 'Other', lastName: 'Tenant', email: 'other@b.test', password: 'OtherPass1!', role: 'patient' });
  await Patient.create({ hospitalId: b._id, userId: other._id });
  otherHospitalUserId = other._id.toString();
  const login = await request(app).post('/api/v1/auth/login').send({ email: 'admin@a.test', password: 'AdminPass1!' });
  adminToken = login.body.data.accessToken;
});

afterAll(async () => { await mongoose.disconnect(); await mongo.stop(); });

describe('central user management', () => {
  let createdUserId = '';
  let temporaryPassword = '';

  it('provisions a complete doctor account and returns the temporary password once', async () => {
    const result = await request(app).post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Sara', lastName: 'Doctor', email: 'sara@a.test', role: 'doctor',
      specialization: 'Cardiology', qualification: ['MD'], licenseNumber: 'LIC-10', consultationFee: 500,
    });
    expect(result.status).toBe(201);
    expect(result.body.data.temporaryPassword).toMatch(/^Hms!/);
    expect(result.body.data.user.password).toBeUndefined();
    createdUserId = result.body.data.user._id;
    temporaryPassword = result.body.data.temporaryPassword;
    const profile = await Doctor.findOne({ userId: createdUserId });
    expect(profile?.specialization).toBe('Cardiology');
    expect(profile?.hospitalId.toString()).toBe(hospitalA);
  });

  it('enforces tenant isolation in list and detail routes', async () => {
    const list = await request(app).get('/api/v1/users?limit=100').set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((u: { _id: string }) => u._id)).not.toContain(otherHospitalUserId);
    const detail = await request(app).get(`/api/v1/users/${otherHospitalUserId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(detail.status).toBe(404);
  });

  it('blocks normal API use until a provisioned user changes the temporary password', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({ email: 'sara@a.test', password: temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.data.user.forcePasswordChange).toBe(true);
    const blocked = await request(app).get('/api/v1/pharmacy/drugs').set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(blocked.status).toBe(403);
  });

  it('changes role only after creating the new role profile and invalidates the old token', async () => {
    const changed = await request(app).patch(`/api/v1/users/${createdUserId}/role`).set('Authorization', `Bearer ${adminToken}`).send({ role: 'nurse', ward: 'ICU', shift: 'night' });
    expect(changed.status).toBe(200);
    expect((await Nurse.findOne({ userId: createdUserId }))?.isActive).toBe(true);
    expect((await Doctor.findOne({ userId: createdUserId }))?.isActive).toBe(false);
    expect((await User.findById(createdUserId))?.role).toBe('nurse');
  });

  it('lists audit records only from the authenticated hospital', async () => {
    const admin = await User.findOne({ email: 'admin@a.test' });
    const other = await User.findById(otherHospitalUserId);
    await AuditLog.create([
      { hospitalId: hospitalA, actorId: admin!._id, actorRole: 'admin', action: 'test.hospitalA', resourceType: 'User', resourceId: admin!._id.toString() },
      { hospitalId: hospitalB, actorId: other!._id, actorRole: 'patient', action: 'test.hospitalB', resourceType: 'User', resourceId: other!._id.toString() },
    ]);

    const result = await request(app)
      .get('/api/v1/audit-logs?limit=100')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(result.status).toBe(200);
    expect(result.body.data.some((entry: { action: string }) => entry.action === 'test.hospitalA')).toBe(true);
    expect(result.body.data.some((entry: { action: string }) => entry.action === 'test.hospitalB')).toBe(false);
  });

  it('updates hospital branding for the current tenant and rejects disguised image data', async () => {
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    const update = await request(app)
      .patch('/api/v1/hospital')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ systemName: 'Hospital A Clinical System', primaryColor: '#123456', logoUrl: logo });

    expect(update.status).toBe(200);
    expect(update.body.data.systemName).toBe('Hospital A Clinical System');
    expect(update.body.data.logoUrl).toBe(logo);

    const branding = await request(app)
      .get('/api/v1/hospital/branding')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(branding.status).toBe(200);
    expect(branding.body.data.systemName).toBe('Hospital A Clinical System');

    const invalid = await request(app)
      .patch('/api/v1/hospital')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ logoUrl: 'data:image/png;base64,aGVsbG8=' });
    expect(invalid.status).toBe(400);
  });
});
