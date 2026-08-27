import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier');
const role = z.enum(['admin', 'doctor', 'nurse', 'receptionist', 'patient']);

const roleProfileFields = {
  departmentId: objectId.nullable().optional(), specialization: z.string().trim().min(1).max(120).optional(),
  qualification: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  licenseNumber: z.string().trim().max(100).optional(), licenseExpiry: z.string().datetime().optional(),
  consultationFee: z.number().min(0).optional(), ward: z.string().trim().max(100).optional(),
  shift: z.enum(['morning', 'afternoon', 'night']).optional(),
};

export const createUserSchema = z.object({
  firstName: z.string().trim().min(1).max(50), lastName: z.string().trim().min(1).max(50),
  email: z.string().email(), phone: z.string().trim().max(40).optional(),
  role, temporaryPassword: z.string().min(10).max(100).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 'Temporary password must contain uppercase, lowercase, number and special character').optional(),
  ...roleProfileFields,
}).strict().superRefine((value, ctx) => {
  if (value.role === 'doctor' && !value.specialization) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['specialization'], message: 'Specialization is required for doctors' });
});

export const updateUserSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(), lastName: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(40).optional(),
  preferredLanguage: z.enum(['en', 'da', 'ps']).optional(), preferredTheme: z.enum(['light', 'dark']).optional(),
  ...roleProfileFields,
}).strict();

export const changeRoleSchema = z.object({ role, ...roleProfileFields }).strict().superRefine((value, ctx) => {
  if (value.role === 'doctor' && !value.specialization) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['specialization'], message: 'Specialization is required for doctors' });
});

export const statusSchema = z.object({ status: z.enum(['active', 'suspended']) }).strict();
export const permissionSchema = z.object({ grants: z.array(z.string()).max(100), denies: z.array(z.string()).max(100) }).strict();
