import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { User, UserRole } from '../../models/User';
import { Doctor } from '../../models/Doctor';
import { Nurse } from '../../models/Nurse';
import { Receptionist } from '../../models/Receptionist';
import { Patient } from '../../models/Patient';
import { Department } from '../../models/Department';
import { RefreshToken } from '../../models/RefreshToken';
import { PermissionOverride } from '../../models/PermissionOverride';
import { AuditLog } from '../../models/AuditLog';
import { AuthUser, MATRIX } from '../../middleware/authorize';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { emitToHospital, emitToUser } from '../../socket';

interface ProfileInput { departmentId?: string | null; specialization?: string; qualification?: string[]; licenseNumber?: string; licenseExpiry?: string; consultationFee?: number; ward?: string; shift?: 'morning' | 'afternoon' | 'night' }
interface ActorMeta { actor: AuthUser; ip?: string; userAgent?: string }

function temporaryPassword(): string { return `Hms!${crypto.randomBytes(9).toString('base64url')}aA1`; }

async function validateDepartment(id?: string | null): Promise<Types.ObjectId | null | undefined> {
  if (id === null) return null;
  if (!id) return undefined;
  const department = await Department.findById(id);
  if (!department) throw new ValidationError('Department does not belong to this hospital');
  return department._id;
}

async function ensureProfile(userId: Types.ObjectId, role: UserRole, input: ProfileInput): Promise<unknown> {
  const department = input.departmentId !== undefined ? await validateDepartment(input.departmentId) : undefined;
  if (role === 'doctor') {
    const fields = Object.fromEntries(Object.entries({ specialization: input.specialization, qualification: input.qualification, licenseNumber: input.licenseNumber, licenseExpiry: input.licenseExpiry ? new Date(input.licenseExpiry) : undefined, consultationFee: input.consultationFee, department }).filter(([, value]) => value !== undefined));
    return Doctor.findOneAndUpdate({ userId }, { $set: { ...fields, isActive: true } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  }
  if (role === 'nurse') {
    const fields = Object.fromEntries(Object.entries({ qualification: input.qualification, ward: input.ward, shift: input.shift, department }).filter(([, value]) => value !== undefined));
    return Nurse.findOneAndUpdate({ userId }, { $set: { ...fields, isActive: true } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  }
  if (role === 'receptionist') return Receptionist.findOneAndUpdate({ userId }, { $set: { ...(department !== undefined ? { department } : {}), isActive: true } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  if (role === 'patient') return Patient.findOneAndUpdate({ userId }, { $setOnInsert: { userId } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true });
  return null;
}

interface ProfileSnapshot { applicable: boolean; exists: boolean; isActive?: boolean }

async function snapshotProfile(userId: Types.ObjectId, role: UserRole): Promise<ProfileSnapshot> {
  if (role === 'doctor') { const profile = await Doctor.findOne({ userId }).lean(); return { applicable: true, exists: !!profile, isActive: profile?.isActive }; }
  if (role === 'nurse') { const profile = await Nurse.findOne({ userId }).lean(); return { applicable: true, exists: !!profile, isActive: profile?.isActive }; }
  if (role === 'receptionist') { const profile = await Receptionist.findOne({ userId }).lean(); return { applicable: true, exists: !!profile, isActive: profile?.isActive }; }
  if (role === 'patient') return { applicable: true, exists: !!(await Patient.exists({ userId })) };
  return { applicable: false, exists: false };
}

async function restoreProfile(userId: Types.ObjectId, role: UserRole, snapshot: ProfileSnapshot): Promise<void> {
  if (!snapshot.applicable) return;
  if (!snapshot.exists) {
    if (role === 'doctor') await Doctor.deleteOne({ userId });
    if (role === 'nurse') await Nurse.deleteOne({ userId });
    if (role === 'receptionist') await Receptionist.deleteOne({ userId });
    if (role === 'patient') await Patient.deleteOne({ userId });
    return;
  }
  if (role === 'doctor') await Doctor.updateOne({ userId }, { isActive: snapshot.isActive });
  if (role === 'nurse') await Nurse.updateOne({ userId }, { isActive: snapshot.isActive });
  if (role === 'receptionist') await Receptionist.updateOne({ userId }, { isActive: snapshot.isActive });
}

async function audit(meta: ActorMeta, action: string, resourceId: string, before?: unknown, after?: unknown): Promise<void> {
  await AuditLog.create({ actorId: meta.actor._id, actorRole: meta.actor.role, action, resourceType: 'User', resourceId, before, after, ip: meta.ip, userAgent: meta.userAgent });
}

export async function listUsers(filters: { search?: string; role?: string; status?: string; page?: number; limit?: number }) {
  const page = Math.max(1, filters.page ?? 1); const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const query: Record<string, unknown> = {};
  if (filters.role) query.role = filters.role;
  if (filters.status) query.status = filters.status;
  if (filters.search) query.$or = [{ firstName: { $regex: filters.search, $options: 'i' } }, { lastName: { $regex: filters.search, $options: 'i' } }, { email: { $regex: filters.search, $options: 'i' } }];
  const [data, total] = await Promise.all([User.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), User.countDocuments(query)]);
  const ids = data.map(u => u._id);
  const [doctors, nurses, receptionists, patients] = await Promise.all([Doctor.find({ userId: { $in: ids } }).populate('department', 'name').lean(), Nurse.find({ userId: { $in: ids } }).populate('department', 'name').lean(), Receptionist.find({ userId: { $in: ids } }).populate('department', 'name').lean(), Patient.find({ userId: { $in: ids } }).lean()]);
  const profileMap = new Map([...doctors, ...nurses, ...receptionists, ...patients].map(p => [p.userId.toString(), p]));
  return { data: data.map(user => ({ ...user, profile: profileMap.get(user._id.toString()) ?? null })), page, limit, total, totalPages: Math.ceil(total / limit) };
}

export async function getUser(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ValidationError('Invalid user id');
  const user = await User.findById(id).lean(); if (!user) throw new NotFoundError('User');
  const profile = user.role === 'doctor' ? await Doctor.findOne({ userId: id }).populate('department').lean() : user.role === 'nurse' ? await Nurse.findOne({ userId: id }).populate('department').lean() : user.role === 'receptionist' ? await Receptionist.findOne({ userId: id }).populate('department').lean() : user.role === 'patient' ? await Patient.findOne({ userId: id }).lean() : null;
  const permissions = await PermissionOverride.findOne({ userId: id }).lean();
  return { user, profile, permissions: permissions ?? { grants: [], denies: [] } };
}

export async function createUser(input: { firstName: string; lastName: string; email: string; role: UserRole; phone?: string; temporaryPassword?: string } & ProfileInput, meta: ActorMeta) {
  if (input.role === 'admin' && !meta.actor.isPlatformAdmin) throw new ForbiddenError('Only a platform administrator can create another administrator');
  // Email is globally unique. Bypass tenant query scoping for this preflight check so
  // another hospital's address is rejected cleanly without revealing that tenant.
  if (await User.collection.findOne({ email: input.email.toLowerCase() })) throw new ConflictError('Email already registered');
  const password = input.temporaryPassword ?? temporaryPassword();
  const user = await User.create({ hospitalId: meta.actor.hospitalId, firstName: input.firstName, lastName: input.lastName, email: input.email.toLowerCase(), phone: input.phone, password, role: input.role, status: 'active', isActive: true, forcePasswordChange: true });
  try { await ensureProfile(user._id, input.role, input); }
  catch (error) { await User.deleteOne({ _id: user._id }); throw error; }
  await audit(meta, 'user.created', user._id.toString(), undefined, { email: user.email, role: user.role });
  emitToHospital(meta.actor.hospitalId, 'user.created', { userId: user._id, role: user.role });
  return { user, temporaryPassword: password };
}

export async function updateUser(id: string, input: Record<string, unknown> & ProfileInput, meta: ActorMeta) {
  const before = await User.findById(id).lean(); if (!before) throw new NotFoundError('User');
  const allowed = ['firstName', 'lastName', 'phone', 'preferredLanguage', 'preferredTheme'];
  const userFields = Object.fromEntries(Object.entries(input).filter(([key]) => allowed.includes(key)));
  const user = await User.findByIdAndUpdate(id, { $set: userFields }, { new: true, runValidators: true });
  await ensureProfile(before._id, before.role, input);
  await audit(meta, 'user.updated', id, before, userFields);
  emitToHospital(meta.actor.hospitalId, 'user.updated', { userId: id });
  return user;
}

export async function changeRole(id: string, input: { role: UserRole } & ProfileInput, meta: ActorMeta) {
  const user = await User.findById(id).select('+sessionVersion'); if (!user) throw new NotFoundError('User');
  if (input.role === 'admin' && !meta.actor.isPlatformAdmin) throw new ForbiddenError('Only a platform administrator can grant the administrator role');
  if (user.isPlatformAdmin && input.role !== 'admin') throw new ForbiddenError('The platform administrator role cannot be removed here');
  const oldRole = user.role;
  if (oldRole === input.role) throw new ConflictError('User already has this role');
  const oldProfile = await snapshotProfile(user._id, oldRole);
  const targetProfile = await snapshotProfile(user._id, input.role);
  const oldForcePasswordChange = user.forcePasswordChange;
  const oldSessionVersion = user.sessionVersion;
  let userChanged = false;
  await ensureProfile(user._id, input.role, input);
  try {
    if (oldRole === 'doctor') await Doctor.updateOne({ userId: id }, { isActive: false });
    if (oldRole === 'nurse') await Nurse.updateOne({ userId: id }, { isActive: false });
    if (oldRole === 'receptionist') await Receptionist.updateOne({ userId: id }, { isActive: false });
    user.role = input.role; user.sessionVersion += 1; user.forcePasswordChange = true; await user.save(); userChanged = true;
    await RefreshToken.updateMany({ user: user._id, isRevoked: false }, { isRevoked: true });
  } catch (error) {
    if (userChanged) {
      user.role = oldRole;
      user.forcePasswordChange = oldForcePasswordChange;
      user.sessionVersion = oldSessionVersion + 1;
      await user.save();
    }
    await restoreProfile(user._id, input.role, targetProfile);
    await restoreProfile(user._id, oldRole, oldProfile);
    throw error;
  }
  await audit(meta, 'user.roleChanged', id, { role: oldRole }, { role: input.role });
  emitToUser(id, 'user.roleChanged', { role: input.role, sessionsRevoked: true }); emitToHospital(meta.actor.hospitalId, 'user.updated', { userId: id });
  return getUser(id);
}

export async function setStatus(id: string, status: 'active' | 'suspended', meta: ActorMeta) {
  if (id === meta.actor._id && status === 'suspended') throw new ForbiddenError('You cannot suspend your own account');
  const user = await User.findById(id).select('+sessionVersion'); if (!user) throw new NotFoundError('User');
  if (user.isPlatformAdmin && status === 'suspended') throw new ForbiddenError('The platform administrator cannot be suspended');
  const before = user.status; user.status = status; user.isActive = status === 'active'; user.sessionVersion += 1; await user.save();
  await RefreshToken.updateMany({ user: id, isRevoked: false }, { isRevoked: true });
  await audit(meta, status === 'active' ? 'user.reactivated' : 'user.deactivated', id, { status: before }, { status });
  emitToUser(id, status === 'active' ? 'user.reactivated' : 'user.deactivated', { sessionsRevoked: true }); emitToHospital(meta.actor.hospitalId, 'user.updated', { userId: id });
  return user;
}

export async function resetPassword(id: string, meta: ActorMeta) {
  const user = await User.findById(id).select('+password +sessionVersion'); if (!user) throw new NotFoundError('User');
  const password = temporaryPassword(); user.password = password; user.forcePasswordChange = true; user.sessionVersion += 1; await user.save();
  await RefreshToken.updateMany({ user: id, isRevoked: false }, { isRevoked: true }); await audit(meta, 'user.passwordReset', id);
  emitToUser(id, 'user.sessionsRevoked', { reason: 'passwordReset' }); return { temporaryPassword: password };
}

const VALID_PERMISSIONS = new Set(Object.keys(MATRIX).flatMap(resource => ['read', 'write', 'create_draft', 'dispense', 'issue', 'void'].map(action => `${resource}.${action}`)));
export async function setPermissions(id: string, grants: string[], denies: string[], meta: ActorMeta) {
  if (grants.some(p => !VALID_PERMISSIONS.has(p)) || denies.some(p => !VALID_PERMISSIONS.has(p))) throw new ValidationError('Unknown permission');
  const target = await User.findById(id).select('+sessionVersion'); if (!target) throw new NotFoundError('User');
  const override = await PermissionOverride.findOneAndUpdate({ userId: id }, { $set: { grants: [...new Set(grants)], denies: [...new Set(denies)], updatedBy: meta.actor._id } }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
  target.sessionVersion += 1; await target.save(); await RefreshToken.updateMany({ user: id, isRevoked: false }, { isRevoked: true });
  await audit(meta, 'permission.updated', id, undefined, { grants: override.grants, denies: override.denies }); emitToUser(id, 'permission.updated', { sessionsRevoked: true });
  return override;
}

export function permissionCatalog() { return Array.from(VALID_PERMISSIONS).sort(); }
