import { Schema, model, Types } from 'mongoose';
import { nextSequence } from './Counter';
import { tenantPlugin } from '../tenant/plugin';

export interface IAvailability {
  day: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  startTime: string; // HH:MM
  endTime: string;
}

export interface IDoctor {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId; // ref User
  doctorId: string;       // DOC-XXXX
  specialization: string;
  qualification: string[];
  licenseNumber?: string;
  licenseExpiry?: Date;
  department?: Types.ObjectId; // ref Department
  availability: IAvailability[];
  consultationFee: number;
  rating: number;
  reviewCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DoctorSchema = new Schema<IDoctor>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    doctorId: { type: String, unique: true, index: true },
    specialization: { type: String, required: true },
    qualification: [{ type: String }],
    licenseNumber: { type: String, trim: true },
    licenseExpiry: Date,
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    availability: [{
      day: { type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], required: true },
      startTime: { type: String, required: true },
      endTime: { type: String, required: true },
    }],
    consultationFee: { type: Number, default: 0, min: 0 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
DoctorSchema.plugin(tenantPlugin);

// For a production multi-instance deployment, use an atomic counter collection or MongoDB sequence pattern.
DoctorSchema.pre('save', async function (next) {
  if (!this.doctorId) {
    this.doctorId = await nextSequence('doctor', 'DOC');
  }
  next();
});

export const Doctor = model<IDoctor>('Doctor', DoctorSchema);
