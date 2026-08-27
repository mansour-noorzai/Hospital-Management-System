import { Schema, model, Types } from 'mongoose';
import { tenantPlugin } from '../tenant/plugin';

export interface IDrug {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  name: string;
  code: string;
  category: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DrugSchema = new Schema<IDrug>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, unique: true, trim: true },
    category: { type: String, required: true, trim: true },
    unit: { type: String, required: true, trim: true },
    stockQuantity: { type: Number, required: true, default: 0, min: 0 },
    reorderLevel: { type: Number, required: true, min: 0 },
    description: { type: String },
  },
  { timestamps: true }
);
DrugSchema.plugin(tenantPlugin);

export const Drug = model<IDrug>('Drug', DrugSchema);
