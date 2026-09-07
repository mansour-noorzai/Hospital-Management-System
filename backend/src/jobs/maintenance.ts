import { timingSafeEqual } from 'node:crypto';
import { Request, Response } from 'express';
import { Appointment } from '../models/Appointment';
import { InventoryItem } from '../models/InventoryItem';
import { Invoice } from '../models/Invoice';
import { emitToHospitalRole } from '../socket';

export async function runMaintenance(): Promise<Record<string, number>> {
  const now = new Date();
  const appointments = await Appointment.updateMany(
    { status: 'scheduled', createdAt: { $lt: new Date(now.getTime() - 86400000) } },
    { $set: { status: 'cancelled', cancelReason: 'Auto-cancelled: not confirmed within 24 hours' } }
  );
  const invoices = await Invoice.updateMany(
    { status: 'issued', dueDate: { $lt: now }, balance: { $gt: 0 } },
    { $set: { status: 'overdue' } }
  );
  let inventoryAlerts = 0;
  // Stream the scan so scheduled work does not load an entire inventory into memory.
  const items = InventoryItem.find({ expiryDate: { $lte: new Date(now.getTime() + 30 * 86400000) } }).cursor();
  for await (const item of items) {
    if (!item.hospitalId || !item.expiryDate) continue;
    emitToHospitalRole(item.hospitalId.toString(), 'admin', item.expiryDate < now ? 'inventory:expired' : 'inventory:expiring-soon', {
      itemId: item._id.toString(), itemName: item.name, expiryDate: item.expiryDate,
      daysRemaining: Math.ceil((item.expiryDate.getTime() - now.getTime()) / 86400000),
    });
    inventoryAlerts++;
  }
  return { appointmentsCancelled: appointments.modifiedCount, invoicesOverdue: invoices.modifiedCount, inventoryAlerts };
}

export async function maintenanceHandler(req: Request, res: Response): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret || ''}`);
  const actual = Buffer.from(req.headers.authorization || '');
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    return;
  }
  if (process.env.VERCEL_ENV === 'preview') {
    res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Scheduled jobs are disabled in preview.' } });
    return;
  }
  const data = await runMaintenance();
  res.json({ success: true, data });
}
