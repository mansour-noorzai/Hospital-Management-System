import { Schema, model, Types } from 'mongoose';
import { tenantPlugin } from '../tenant/plugin';

export interface IInventoryCategory {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryCategorySchema = new Schema<IInventoryCategory>({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
}, { timestamps: true });

InventoryCategorySchema.plugin(tenantPlugin);
InventoryCategorySchema.index({ hospitalId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export const InventoryCategory = model<IInventoryCategory>('InventoryCategory', InventoryCategorySchema);
