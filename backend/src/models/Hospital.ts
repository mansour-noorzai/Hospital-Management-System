import { Schema, model, Types } from 'mongoose';

export type SupportedLanguage = 'en' | 'da' | 'ps';
export type SupportedTheme = 'light' | 'dark';

export interface IHospital {
  _id: Types.ObjectId;
  name: string;
  systemName: string;
  shortName: string;
  slug: string;
  logoUrl?: string;
  faviconUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  registrationNumber?: string;
  emergencyContact?: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  defaultLanguage: SupportedLanguage;
  defaultTheme: SupportedTheme;
  invoiceFooter?: string;
  prescriptionFooter?: string;
  defaultTaxRate: number;
  workingHours?: { start: string; end: string };
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const HospitalSchema = new Schema<IHospital>({
  name: { type: String, required: true, trim: true },
  systemName: { type: String, required: true, trim: true, default: 'Hospital Management System' },
  shortName: { type: String, required: true, trim: true, default: 'HMS' },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  logoUrl: String,
  faviconUrl: String,
  address: String,
  phone: String,
  email: { type: String, lowercase: true, trim: true },
  website: String,
  registrationNumber: String,
  emergencyContact: String,
  primaryColor: { type: String, default: '#0f766e' },
  accentColor: { type: String, default: '#0891b2' },
  currency: { type: String, default: 'AFN', uppercase: true },
  timezone: { type: String, default: 'Asia/Kabul' },
  dateFormat: { type: String, default: 'yyyy-MM-dd' },
  defaultLanguage: { type: String, enum: ['en', 'da', 'ps'], default: 'en' },
  defaultTheme: { type: String, enum: ['light', 'dark'], default: 'light' },
  invoiceFooter: String,
  prescriptionFooter: String,
  defaultTaxRate: { type: Number, default: 0, min: 0, max: 100 },
  workingHours: { start: String, end: String },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
}, { timestamps: true });

export const Hospital = model<IHospital>('Hospital', HospitalSchema);
