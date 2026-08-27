import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../../middleware/errorHandler';
import { changeRoleSchema, createUserSchema, permissionSchema, statusSchema, updateUserSchema } from './schema';
import * as service from './service';
import { MATRIX } from '../../middleware/authorize';

function parse<T>(schema: ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError('Validation failed', result.error.flatten().fieldErrors);
  return result.data;
}
function meta(req: Request) { return { actor: req.user!, ip: req.ip, userAgent: req.headers['user-agent'] }; }

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> { try { const result = await service.listUsers({ search: req.query.search as string, role: req.query.role as string, status: req.query.status as string, page: Number(req.query.page) || 1, limit: Number(req.query.limit) || 20 }); res.json({ success: true, data: result.data, meta: { page: result.page, limit: result.limit, total: result.total, totalPages: result.totalPages } }); } catch (e) { next(e); } }
export async function get(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await service.getUser(req.params.id) }); } catch (e) { next(e); } }
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.status(201).json({ success: true, data: await service.createUser(parse(createUserSchema, req.body), meta(req)) }); } catch (e) { next(e); } }
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await service.updateUser(req.params.id, parse(updateUserSchema, req.body), meta(req)) }); } catch (e) { next(e); } }
export async function changeRole(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await service.changeRole(req.params.id, parse(changeRoleSchema, req.body), meta(req)) }); } catch (e) { next(e); } }
export async function setStatus(req: Request, res: Response, next: NextFunction): Promise<void> { try { const input = parse(statusSchema, req.body); res.json({ success: true, data: await service.setStatus(req.params.id, input.status, meta(req)) }); } catch (e) { next(e); } }
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> { try { res.json({ success: true, data: await service.resetPassword(req.params.id, meta(req)) }); } catch (e) { next(e); } }
export async function setPermissions(req: Request, res: Response, next: NextFunction): Promise<void> { try { const input = parse(permissionSchema, req.body); res.json({ success: true, data: await service.setPermissions(req.params.id, input.grants, input.denies, meta(req)) }); } catch (e) { next(e); } }
export function catalog(_req: Request, res: Response): void { res.json({ success: true, data: service.permissionCatalog() }); }
export function matrix(_req: Request, res: Response): void { res.json({ success: true, data: MATRIX }); }
