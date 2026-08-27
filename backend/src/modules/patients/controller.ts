import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ValidationError, AuthError, ForbiddenError } from '../../middleware/errorHandler';
import { successResponse } from '../../types/api';
import { CreatePatientSchema, UpdatePatientSchema } from './schema';
import * as PatientService from './service';

function parseZodError(err: ZodError): ValidationError {
  const details: Record<string, unknown> = {};
  for (const issue of err.errors) {
    details[issue.path.join('.')] = issue.message;
  }
  return new ValidationError('Validation failed', details);
}

export async function listPatients(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AuthError());

    if (req.ownOnly && req.user.role === 'patient') {
      const patient = await PatientService.getPatientByUserId(req.user._id);
      res.json(successResponse([patient], { page: 1, limit: 1, total: 1, totalPages: 1 }));
      return;
    }

    const { page, limit, search } = req.query as Record<string, string>;
    const safePage = page ? Math.max(1, parseInt(page, 10) || 1) : undefined;
    const safeLimit = limit ? Math.min(100, Math.max(1, parseInt(limit, 10) || 20)) : undefined;
    const result = await PatientService.listPatients({ page: safePage, limit: safeLimit, search, requestingUserId: req.user._id, requestingRole: req.user.role });
    res.json(
      successResponse(result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: result.totalPages,
      })
    );
  } catch (err) {
    next(err);
  }
}

export async function createPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AuthError());
    if (req.ownOnly || req.user.role === 'patient') {
      return next(new ForbiddenError('Patients cannot create additional patient profiles'));
    }

    const parsed = CreatePatientSchema.safeParse(req.body);
    if (!parsed.success) return next(parseZodError(parsed.error));

    const result = await PatientService.createPatient(parsed.data);
    res.status(201).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}

export async function getPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!req.user) return next(new AuthError());

    const patient = await PatientService.getPatient(id, req.user._id, req.user.role);
    res.json(successResponse(patient));
  } catch (err) {
    next(err);
  }
}

export async function updatePatient(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!req.user) return next(new AuthError());

    const parsed = UpdatePatientSchema.safeParse(req.body);
    if (!parsed.success) return next(parseZodError(parsed.error));

    const patient = await PatientService.updatePatient(id, parsed.data, req.user._id, req.user.role);
    res.json(successResponse(patient));
  } catch (err) {
    next(err);
  }
}

export async function getOwnProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AuthError());
    const patient = await PatientService.getPatientByUserId(req.user._id);
    res.json(successResponse(patient));
  } catch (err) {
    next(err);
  }
}

export async function updateOwnProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AuthError());
    const parsed = UpdatePatientSchema.safeParse(req.body);
    if (!parsed.success) return next(parseZodError(parsed.error));

    const patient = await PatientService.updateOwnPatientProfile(req.user._id, parsed.data);
    res.json(successResponse(patient));
  } catch (err) {
    next(err);
  }
}
