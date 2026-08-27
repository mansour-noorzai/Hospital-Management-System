import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId');

const ymdDate = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Invalid calendar date');

export const CreateAppointmentSchema = z.object({
  doctorId: objectId,
  patientId: objectId,
  date: ymdDate,
  timeSlot: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  type: z.enum(['consultation', 'follow-up', 'emergency', 'procedure']).optional(),
  reason: z.string().max(500).optional(),
});

export const UpdateStatusSchema = z.object({
  status: z.enum(['confirmed', 'inProgress', 'completed', 'cancelled', 'noShow']),
  cancelReason: z.string().optional(),
  notes: z.string().optional(),
});

export const GetSlotsSchema = z.object({
  doctorId: objectId,
  date: ymdDate,
});
const appointmentStatuses = ['scheduled', 'confirmed', 'inProgress', 'completed', 'cancelled', 'noShow'] as const;

export const ListAppointmentsQuerySchema = z.object({
  date: ymdDate.optional(),
  dateFrom: ymdDate.optional(),
  dateTo: ymdDate.optional(),
  doctorId: objectId.optional(),
  patientId: objectId.optional(),
  departmentId: objectId.optional(),
  status: z.string().refine(
    (value) => value.split(',').every(status => appointmentStatuses.includes(status.trim() as typeof appointmentStatuses[number])),
    { message: 'Invalid appointment status value(s)' },
  ).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).refine(
  (value) => !(value.date && (value.dateFrom || value.dateTo)),
  { message: 'Use either date or dateFrom/dateTo, not both' },
).refine(
  (value) => !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
  { message: 'dateFrom must be before or equal to dateTo' },
);
