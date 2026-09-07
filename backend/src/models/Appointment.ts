import { Schema, model, Types } from 'mongoose';
import { nextSequence } from './Counter';
import { tenantPlugin } from '../tenant/plugin';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'inProgress' | 'completed' | 'cancelled' | 'noShow';
export type AppointmentType = 'consultation' | 'follow-up' | 'emergency' | 'procedure';

export interface IAppointment {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  appointmentId: string; // APT-XXXX
  patient: Types.ObjectId;    // ref Patient
  doctor: Types.ObjectId;     // ref Doctor
  department?: Types.ObjectId; // ref Department
  date: Date;
  timeSlot: string; // e.g., '09:00' (HH:MM)
  type: AppointmentType;
  status: AppointmentStatus;
  reason?: string;
  notes?: string;
  createdBy: Types.ObjectId; // ref User
  cancelledBy?: Types.ObjectId; // ref User
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AppointmentSchema = new Schema<IAppointment>(
  {
    appointmentId: { type: String, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'Patient', required: true, index: true },
    doctor: { type: Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    date: { type: Date, required: true, index: true },
    timeSlot: { type: String, required: true },
    type: { type: String, enum: ['consultation', 'follow-up', 'emergency', 'procedure'], default: 'consultation' },
    status: { type: String, enum: ['scheduled', 'confirmed', 'inProgress', 'completed', 'cancelled', 'noShow'], default: 'scheduled', index: true },
    reason: { type: String },
    notes: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancelReason: { type: String },
  },
  { timestamps: true }
);
AppointmentSchema.plugin(tenantPlugin);

// CRITICAL: Compound unique index prevents double-booking at DB layer
// Partial index: only applies to non-cancelled appointments
AppointmentSchema.index(
  { hospitalId: 1, doctor: 1, date: 1, timeSlot: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['scheduled', 'confirmed', 'inProgress', 'completed'] } } }
);

// Auto-generate appointmentId
AppointmentSchema.pre('save', async function (next) {
  if (!this.appointmentId) {
    this.appointmentId = await nextSequence('appointment', 'APT');
  }
  next();
});

export const Appointment = model<IAppointment>('Appointment', AppointmentSchema);
