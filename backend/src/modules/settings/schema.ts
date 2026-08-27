import { z } from 'zod';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format');

export const updateSettingsSchema = z.object({
  hospitalName: z.string().min(1).optional(),
  address: z.string().optional(),
  logoUrl: z.string().url().optional(),
  defaultTaxRate: z.number().min(0).max(100).optional(),
  workingHours: z
    .object({
      start: hhmm,
      end: hhmm,
    })
    .optional(),
  timezone: z.string().optional(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
