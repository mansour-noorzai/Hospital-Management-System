import { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import { AuditLog } from '../../models/AuditLog';
import { ValidationError } from '../../middleware/errorHandler';
import { successResponse } from '../../types/api';

export async function listAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const query: Record<string, unknown> = {};
    const action = typeof req.query.action === 'string' ? req.query.action.trim() : '';
    const resourceType = typeof req.query.resourceType === 'string' ? req.query.resourceType.trim() : '';
    const actorId = typeof req.query.actorId === 'string' ? req.query.actorId.trim() : '';
    if (action) query.action = { $regex: action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    if (resourceType) query.resourceType = resourceType;
    if (actorId) {
      if (!Types.ObjectId.isValid(actorId)) throw new ValidationError('Invalid actor id');
      query.actorId = actorId;
    }
    const [data, total] = await Promise.all([
      AuditLog.find(query).populate('actorId', 'firstName lastName email role').sort({ timestamp: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(query),
    ]);
    res.json(successResponse(data, { page, limit, total, totalPages: Math.ceil(total / limit) }));
  } catch (error) { next(error); }
}
