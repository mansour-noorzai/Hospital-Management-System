import { Schema, model, Types } from 'mongoose';
import { tenantPlugin } from '../tenant/plugin';

export interface IPermissionOverride {
  hospitalId: Types.ObjectId;
  userId: Types.ObjectId;
  grants: string[];
  denies: string[];
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PermissionOverrideSchema = new Schema<IPermissionOverride>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  grants: [{ type: String }],
  denies: [{ type: String }],
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });
PermissionOverrideSchema.index({ hospitalId: 1, userId: 1 }, { unique: true });
PermissionOverrideSchema.plugin(tenantPlugin);

export const PermissionOverride = model<IPermissionOverride>('PermissionOverride', PermissionOverrideSchema);

