import mongoose, { Schema, model, Types } from 'mongoose';
import bcrypt from 'bcryptjs';
import { tenantPlugin } from '../tenant/plugin';

export type UserRole = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient';

export interface IUser {
  _id: Types.ObjectId;
  hospitalId: Types.ObjectId;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  isPlatformAdmin: boolean;
  phone?: string;
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  avatar?: string; // S3 URL
  isActive: boolean;
  status: 'active' | 'suspended' | 'pendingActivation';
  forcePasswordChange: boolean;
  sessionVersion: number;
  preferredLanguage?: 'en' | 'da' | 'ps';
  preferredTheme?: 'light' | 'dark';
  failedLoginAttempts: number;
  lockedUntil?: Date;
  lastLogin?: Date;
  passwordResetToken?: string;
  passwordResetExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Instance method type
export interface IUserMethods {
  comparePassword(candidate: string): Promise<boolean>;
  isLocked(): boolean;
}

type UserModel = mongoose.Model<IUser, Record<string, never>, IUserMethods>;

const UserSchema = new Schema<IUser, UserModel, IUserMethods>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false }, // never returned by default
    role: { type: String, enum: ['admin', 'doctor', 'nurse', 'receptionist', 'patient'], required: true, index: true },
    isPlatformAdmin: { type: Boolean, default: false, index: true },
    phone: { type: String },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
    },
    avatar: { type: String },
    isActive: { type: Boolean, default: true, index: true },
    status: { type: String, enum: ['active', 'suspended', 'pendingActivation'], default: 'active', index: true },
    forcePasswordChange: { type: Boolean, default: false },
    sessionVersion: { type: Number, default: 0, select: false },
    preferredLanguage: { type: String, enum: ['en', 'da', 'ps'] },
    preferredTheme: { type: String, enum: ['light', 'dark'] },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    lastLogin: { type: Date },
    passwordResetToken: { type: String, select: false, index: true },
    passwordResetExpiry: { type: Date, select: false },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        delete ret.password;
        delete ret.sessionVersion;
        delete ret.failedLoginAttempts;
        delete ret.lockedUntil;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpiry;
        return ret;
      },
    },
  }
);
UserSchema.plugin(tenantPlugin);

// Hash password before save
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

// Check if account is locked
UserSchema.methods.isLocked = function (): boolean {
  if (!this.lockedUntil) return false;
  return this.lockedUntil > new Date();
};

export const User = model<IUser, UserModel>('User', UserSchema);
