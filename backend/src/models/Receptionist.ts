import { Schema, model, Types } from 'mongoose';
import { nextSequence } from './Counter';
import { tenantPlugin } from '../tenant/plugin';

export interface IReceptionist {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  receptionistId: string; // REC-XXXX
  department?: Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReceptionistSchema = new Schema<IReceptionist>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    receptionistId: { type: String, unique: true, index: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department' },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);
ReceptionistSchema.plugin(tenantPlugin);

// For a production multi-instance deployment, use an atomic counter collection or MongoDB sequence pattern.
ReceptionistSchema.pre('save', async function (next) {
  if (!this.receptionistId) {
    this.receptionistId = await nextSequence('receptionist', 'REC');
  }
  next();
});

export const Receptionist = model<IReceptionist>('Receptionist', ReceptionistSchema);
