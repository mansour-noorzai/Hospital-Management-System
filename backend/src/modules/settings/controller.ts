import { Request, Response, NextFunction } from 'express';
import { Hospital } from '../../models/Hospital';
import { updateSettingsSchema } from './schema';

export async function getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = req.user!.hospitalId
      ? await Hospital.findById(req.user!.hospitalId).lean()
      : await Hospital.findOne({ status: 'active' }).sort({ createdAt: 1 }).lean();
    res.json({ success: true, data: settings ? { ...settings, hospitalName: settings.name } : null });
  } catch (err) {
    next(err);
  }
}

export async function updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: parsed.error.errors },
      });
      return;
    }

    const { hospitalName, ...rest } = parsed.data;
    const target = req.user!.hospitalId
      ? { _id: req.user!.hospitalId }
      : { status: 'active' as const };
    const updated = await Hospital.findOneAndUpdate(
      target,
      { $set: { ...rest, ...(hospitalName ? { name: hospitalName } : {}) } },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ success: true, data: updated ? { ...updated, hospitalName: updated.name } : null });
  } catch (err) {
    next(err);
  }
}
