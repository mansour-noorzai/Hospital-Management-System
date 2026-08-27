import { Schema, model, Types } from 'mongoose';
import { tenantPlugin } from '../tenant/plugin';

export interface IDepartment {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  name: string;
  description?: string;
  head?: Types.ObjectId; // ref Doctor
  bedCount: number;
  location?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    head: { type: Schema.Types.ObjectId, ref: 'Doctor' },
    bedCount: { type: Number, default: 0, min: 0 },
    location: { type: String },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
DepartmentSchema.plugin(tenantPlugin);
DepartmentSchema.index({ hospitalId: 1, name: 1 }, { unique: true });

export const Department = model<IDepartment>('Department', DepartmentSchema);
