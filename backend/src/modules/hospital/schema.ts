import { z } from 'zod';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a six-digit hex value');
const optionalUrl = z.union([z.string().url(), z.string().startsWith('data:image/')]);

function hasExpectedImageSignature(kind: string, bytes: Buffer): boolean {
  if (kind === 'png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (kind === 'jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (kind === 'webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (kind === 'x-icon') return bytes.length >= 4 && bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0x00;
  return false;
}

function isValidTimezone(value: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; }
  catch { return false; }
}

export const updateHospitalSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  systemName: z.string().trim().min(1).max(160).optional(),
  shortName: z.string().trim().min(1).max(30).optional(),
  logoUrl: optionalUrl.optional(),
  faviconUrl: optionalUrl.optional(),
  address: z.string().trim().max(500).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  registrationNumber: z.string().trim().max(100).optional(),
  emergencyContact: z.string().trim().max(100).optional(),
  primaryColor: color.optional(),
  accentColor: color.optional(),
  currency: z.string().trim().min(3).max(3).transform(v => v.toUpperCase()).optional(),
  timezone: z.string().trim().min(1).max(80).refine(isValidTimezone, 'Timezone must be a valid IANA identifier').optional(),
  dateFormat: z.enum(['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy']).optional(),
  defaultLanguage: z.enum(['en', 'da', 'ps']).optional(),
  defaultTheme: z.enum(['light', 'dark']).optional(),
  invoiceFooter: z.string().max(1000).optional(),
  prescriptionFooter: z.string().max(1000).optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  workingHours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).optional(),
}).strict().superRefine((value, ctx) => {
  for (const key of ['logoUrl', 'faviconUrl'] as const) {
    const candidate = value[key];
    if (!candidate?.startsWith('data:')) continue;
    const match = candidate.match(/^data:image\/(png|jpeg|webp|x-icon);base64,([A-Za-z0-9+/=]+)$/);
    const bytes = match ? Buffer.from(match[2], 'base64') : Buffer.alloc(0);
    if (!match || bytes.length > 2 * 1024 * 1024 || !hasExpectedImageSignature(match[1], bytes)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Image must be PNG, JPEG, WebP or ICO and no larger than 2 MB' });
    }
  }
});
