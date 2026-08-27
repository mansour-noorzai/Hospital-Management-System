import { NextFunction, Request, Response } from 'express';
import { Hospital } from '../../models/Hospital';
import { AuditLog } from '../../models/AuditLog';
import { NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { updateHospitalSchema } from './schema';
import { emitToHospital } from '../../socket';

const PUBLIC_FIELDS = 'name systemName shortName logoUrl faviconUrl address phone email website registrationNumber primaryColor accentColor defaultLanguage defaultTheme currency timezone dateFormat invoiceFooter prescriptionFooter';

export async function getPublicHospital(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hospital = await Hospital.findOne({ status: 'active' }).sort({ createdAt: 1 }).select(PUBLIC_FIELDS).lean();
    if (!hospital) throw new NotFoundError('Hospital configuration');
    res.json({ success: true, data: hospital });
  } catch (error) { next(error); }
}

export async function getHospital(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hospital = await Hospital.findById(req.user!.hospitalId).lean();
    if (!hospital) throw new NotFoundError('Hospital');
    res.json({ success: true, data: hospital });
  } catch (error) { next(error); }
}

export async function getCurrentBranding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const hospital = await Hospital.findById(req.user!.hospitalId).select(PUBLIC_FIELDS).lean();
    if (!hospital) throw new NotFoundError('Hospital');
    res.json({ success: true, data: hospital });
  } catch (error) { next(error); }
}

export async function updateHospital(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateHospitalSchema.safeParse(req.body);
    if (!parsed.success) throw new ValidationError('Invalid hospital settings', parsed.error.flatten().fieldErrors);
    const before = await Hospital.findById(req.user!.hospitalId).lean();
    const hospital = await Hospital.findByIdAndUpdate(req.user!.hospitalId, { $set: parsed.data }, { new: true, runValidators: true }).lean();
    if (!hospital) throw new NotFoundError('Hospital');
    await AuditLog.create({ actorId: req.user!._id, actorRole: req.user!.role, action: 'hospital.settings.updated', resourceType: 'Hospital', resourceId: hospital._id.toString(), before, after: parsed.data, ip: req.ip, userAgent: req.headers['user-agent'] });
    const publicBranding = Object.fromEntries(
      PUBLIC_FIELDS.split(' ').map(field => [field, hospital[field as keyof typeof hospital]]),
    );
    emitToHospital(req.user!.hospitalId, 'hospital.settings.updated', { hospital: publicBranding });
    res.json({ success: true, data: hospital });
  } catch (error) { next(error); }
}
