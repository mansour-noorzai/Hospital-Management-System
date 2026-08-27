import nodemailer from 'nodemailer';
import { logger } from '../middleware/requestLogger';
import { Hospital } from '../models/Hospital';
import { User } from '../models/User';
import { currentHospitalId } from '../tenant/context';

/**
 * Sends an email with the generated document PDF as an attachment.
 * If required env vars are missing, logs a warning and returns without throwing
 * (graceful no-op for local dev).
 */
export async function sendDocumentEmail(
  to: string,
  documentType: string,
  patientName: string,
  pdfBuffer: Buffer
): Promise<void> {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT ?? '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;

  if (!host || !user || !pass) {
    logger.warn('Email env vars (EMAIL_HOST, EMAIL_USER, EMAIL_PASS) not set — skipping email send');
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
  });

  const formattedType = documentType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  const hospital = currentHospitalId() ? await Hospital.findById(currentHospitalId()).lean() : null;
  const brandName = hospital?.systemName ?? hospital?.name ?? 'Hospital Management System';

  await transporter.sendMail({
    from: user,
    to,
    subject: `Your ${formattedType} - ${brandName}`,
    text: `Dear ${patientName},\n\nPlease find attached your ${formattedType}.\n\nRegards,\n${brandName}`,
    attachments: [
      {
        filename: `${documentType}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });
}


export async function sendPasswordResetEmail(to: string, resetToken: string): Promise<void> {
  const host = process.env.EMAIL_HOST;
  const port = parseInt(process.env.EMAIL_PORT ?? '587', 10);
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:5173';

  if (!host || !user || !pass) {
    logger.warn('Email env vars not set — password reset email was not sent', { to });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const resetUrl = `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const account = await User.collection.findOne({ email: to.trim().toLowerCase() });
  const hospital = account?.hospitalId ? await Hospital.findById(account.hospitalId).lean() : null;
  const brandName = hospital?.systemName ?? hospital?.name ?? 'Hospital Management System';

  await transporter.sendMail({
    from: user,
    to,
    subject: `Reset your ${brandName} password`,
    text: `A password reset was requested for your ${brandName} account.\n\nOpen this link to set a new password:\n${resetUrl}\n\nThis link expires in 60 minutes. If you did not request this, ignore this email.`,
  });
}
