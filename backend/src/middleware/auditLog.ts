import { Request, Response, NextFunction } from 'express';
import { AuditLog } from '../models/AuditLog';
import { logger } from './requestLogger';

interface AuditOptions {
  resourceType: string;
  action: string;
  /**
   * Optional function to sanitize/redact PII or sensitive fields from the request body
   * before storing it in the audit log. If not provided, the raw body is stored as-is.
   * Example: `sanitize: (body) => { const { password, ...safe } = body as Record<string, unknown>; return safe; }`
   */
  sanitize?: (body: unknown) => Record<string, unknown>;
}

export function auditLog(options: AuditOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Note: `before` state is not captured automatically.
    // Controllers that need before-state should attach it to res.locals.auditBefore
    // before calling next(). The auditLog middleware will include it if present.

    // Capture original json method to intercept response body
    const originalJson = res.json.bind(res);

    res.json = function(body: unknown) {
      // Only audit successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        AuditLog.create({
          actorId: req.user._id,
          actorRole: req.user.role,
          action: options.action,
          resourceType: options.resourceType,
          resourceId: (req.params.id ?? (body as Record<string, unknown>)?._id ?? 'unknown') as string,
          before: res.locals.auditBefore as Record<string, unknown> | undefined,
          after: options.sanitize ? options.sanitize(body) : body as Record<string, unknown>,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }).catch(err => logger.error('AuditLog write failed', { error: (err as Error).message }));
      }
      return originalJson(body);
    };

    next();
  };
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECRET_FIELDS = new Set(['password', 'currentPassword', 'newPassword', 'temporaryPassword', 'token', 'refreshToken']);

/** Audits successful legacy module mutations without copying medical or secret payload values. */
export function auditMutations(req: Request, res: Response, next: NextFunction): void {
  if (!MUTATING_METHODS.has(req.method) || req.path.startsWith('/auth/') || req.path.startsWith('/users') || req.path.startsWith('/hospital')) return next();
  const originalJson = res.json.bind(res);
  res.json = function(body: unknown) {
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const response = body as { data?: { _id?: unknown; user?: { _id?: unknown }; patient?: { _id?: unknown } } };
      const resourceId = String(req.params.id ?? response?.data?._id ?? response?.data?.user?._id ?? response?.data?.patient?._id ?? 'collection');
      const changedFields = Object.keys((req.body ?? {}) as Record<string, unknown>).filter(key => !SECRET_FIELDS.has(key));
      AuditLog.create({ actorId: req.user._id, actorRole: req.user.role, action: `${req.method.toLowerCase()}.${req.path}`, resourceType: req.path.split('/').filter(Boolean)[0] ?? 'unknown', resourceId, after: { changedFields, statusCode: res.statusCode }, ip: req.ip, userAgent: req.headers['user-agent'] }).catch(error => logger.error('AuditLog write failed', { error: (error as Error).message }));
    }
    return originalJson(body);
  };
  next();
}
