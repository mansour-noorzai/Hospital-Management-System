import { z } from 'zod';

const profileImage = z.string().superRefine((value, ctx) => {
  if (!value.startsWith('data:image/')) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Profile image must be an uploaded image' });
    return;
  }
  const match = value.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Profile image must be PNG, JPEG, or WebP' });
    return;
  }
  const bytes = Buffer.from(match[2], 'base64');
  const valid = match[1] === 'png'
    ? bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    : match[1] === 'jpeg'
      ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      : bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!valid || bytes.length > 2 * 1024 * 1024) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Profile image must be valid and no larger than 2 MB' });
  }
});

export const RegisterSchema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    'Password must contain uppercase, lowercase, number, and special character'
  ),
  phone: z.string().optional(),
  dob: z.string().datetime().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(100).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/,
    'Password must contain uppercase, lowercase, number, and special character'
  ),
});

export const PreferencesSchema = z.object({
  preferredLanguage: z.enum(['en', 'da', 'ps']).optional(),
  preferredTheme: z.enum(['light', 'dark']).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one preference is required');

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 'Password must contain uppercase, lowercase, number, and special character'),
}).strict();

export const UpdateMeSchema = z.object({
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional(),
  phone: z.string().trim().max(40).optional(),
  preferredLanguage: z.enum(['en', 'da', 'ps']).optional(),
  preferredTheme: z.enum(['light', 'dark']).optional(),
  avatar: z.union([z.string().url(), profileImage, z.literal('')]).optional(),
}).strict().refine(value => Object.keys(value).length > 0, 'At least one field is required');

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
