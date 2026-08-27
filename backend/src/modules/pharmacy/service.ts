import { Types } from 'mongoose';
import { z } from 'zod';
import { Drug } from '../../models/Drug';
import { Prescription } from '../../models/Prescription';
import { Patient } from '../../models/Patient';
import { Doctor } from '../../models/Doctor';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../middleware/errorHandler';
import { emitToCurrentHospital, emitToRole } from '../../socket';
import {
  CreateDrugSchema,
  UpdateDrugSchema,
  CreatePrescriptionSchema,
  ActivatePrescriptionSchema,
  DispensePrescriptionSchema,
  CancelPrescriptionSchema,
  ListDrugsQuerySchema,
  ListPrescriptionsQuerySchema,
} from './schema';

type CreateDrugInput = z.infer<typeof CreateDrugSchema>;
type UpdateDrugInput = z.infer<typeof UpdateDrugSchema>;
type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
type ActivatePrescriptionInput = z.infer<typeof ActivatePrescriptionSchema>;
type DispensePrescriptionInput = z.infer<typeof DispensePrescriptionSchema>;
type CancelPrescriptionInput = z.infer<typeof CancelPrescriptionSchema>;
type ListDrugsQuery = z.infer<typeof ListDrugsQuerySchema>;
type ListPrescriptionsQuery = z.infer<typeof ListPrescriptionsQuerySchema>;

// ---------------------------------------------------------------------------
// Drug services
// ---------------------------------------------------------------------------

export async function createDrug(input: CreateDrugInput) {
  const drug = await Drug.create({
    name: input.name,
    code: input.code,
    category: input.category,
    unit: input.unit,
    stockQuantity: input.stockQuantity ?? 0,
    reorderLevel: input.reorderLevel,
    description: input.description,
  });
  return drug;
}

export async function listDrugs(query: ListDrugsQuery) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const regex = new RegExp(query.search, 'i');
    filter.$or = [{ name: regex }, { code: regex }, { category: regex }];
  }

  const [data, total] = await Promise.all([
    Drug.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Drug.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDrugById(id: string) {
  const drug = await Drug.findById(id);
  if (!drug) throw new NotFoundError('Drug');
  return drug;
}

export async function updateDrug(id: string, input: UpdateDrugInput) {
  const drug = await Drug.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
  if (!drug) throw new NotFoundError('Drug');
  return drug;
}

export async function deleteDrug(id: string) {
  const drug = await Drug.findById(id);
  if (!drug) throw new NotFoundError('Drug');
  const isReferenced = await Prescription.exists({ 'lineItems.drugId': drug._id });
  if (isReferenced) {
    throw new ConflictError('This drug is used in prescription history and cannot be deleted');
  }
  await Drug.deleteOne({ _id: drug._id });
  return { deleted: true };
}

// ---------------------------------------------------------------------------
// Prescription services
// ---------------------------------------------------------------------------


async function assertPrescriptionWriteAccess(
  prescription: { doctorId: Types.ObjectId },
  requestingUserId: string,
  requestingRole: string
) {
  if (requestingRole !== 'doctor') return;
  const doctor = await Doctor.findOne({ userId: requestingUserId }).lean();
  if (!doctor || doctor._id.toString() !== prescription.doctorId.toString()) {
    throw new ForbiddenError('Doctors can only modify their own prescriptions');
  }
}

export async function createPrescription(
  input: CreatePrescriptionInput,
  requestingUserId: string,
  requestingRole: string
) {
  const patient = await Patient.findById(input.patientId);
  if (!patient) throw new NotFoundError('Patient');

  const doctor = await Doctor.findById(input.doctorId);
  if (!doctor) throw new NotFoundError('Doctor');

  if (requestingRole === 'doctor' && doctor.userId.toString() !== requestingUserId) {
    throw new ForbiddenError('Doctors can only create prescriptions under their own profile');
  }

  const drugIds = input.lineItems.map((item) => new Types.ObjectId(item.drugId));
  const drugs = await Drug.find({ _id: { $in: drugIds } }).lean();
  if (drugs.length !== drugIds.length) {
    throw new ValidationError('One or more prescription drugs do not exist');
  }
  const drugsById = new Map(drugs.map((drug) => [drug._id.toString(), drug]));

  const prescription = await Prescription.create({
    patientId: new Types.ObjectId(input.patientId),
    doctorId: new Types.ObjectId(input.doctorId),
    appointmentId: input.appointmentId ? new Types.ObjectId(input.appointmentId) : undefined,
    lineItems: input.lineItems.map(item => ({
      drugId: new Types.ObjectId(item.drugId),
      drugName: drugsById.get(item.drugId)?.name ?? item.drugName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      quantity: item.quantity ?? 1,
    })),
    notes: input.notes,
    status: 'draft',
  });
  emitToCurrentHospital('prescription.created', { prescriptionId: prescription._id.toString() });
  return prescription;
}

export async function listPrescriptions(
  query: ListPrescriptionsQuery,
  requestingUserId: string,
  requestingRole: string,
  ownOnly?: boolean
) {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;
  const filter: Record<string, unknown> = {};

  if (ownOnly) {
    // patient own-read: filter by patient profile
    const patientProfile = await Patient.findOne({ userId: requestingUserId }).lean();
    if (!patientProfile) {
      return { data: [], total: 0, page, limit, totalPages: 0 };
    }
    filter.patientId = (patientProfile._id as Types.ObjectId);
  } else if (requestingRole === 'nurse') {
    // nurse sees active prescriptions only
    filter.status = 'active';
  } else if (query.patientId) {
    filter.patientId = new Types.ObjectId(query.patientId);
  }

  if (query.status && requestingRole !== 'nurse') {
    filter.status = query.status;
  }

  const [data, total] = await Promise.all([
    Prescription.find(filter)
      .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
      .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Prescription.countDocuments(filter),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getPrescriptionById(
  id: string,
  requestingUserId: string,
  ownOnly?: boolean
) {
  const prescription = await Prescription.findById(id)
    .populate({ path: 'patientId', populate: { path: 'userId', select: '-password' } })
    .populate({ path: 'doctorId', populate: { path: 'userId', select: '-password' } });

  if (!prescription) throw new NotFoundError('Prescription');

  if (ownOnly) {
    // Check if patient owns this prescription
    const patientDoc = prescription.patientId as unknown as { userId?: Types.ObjectId | { toString(): string } };
    const patientUserId = patientDoc?.userId?.toString();
    if (!patientUserId || patientUserId !== requestingUserId) {
      throw new ForbiddenError('You can only view your own prescriptions');
    }
  }

  return prescription;
}

export async function activatePrescription(
  id: string,
  input: ActivatePrescriptionInput,
  requestingUserId: string,
  requestingRole: string
) {
  const prescription = await Prescription.findById(id);
  if (!prescription) throw new NotFoundError('Prescription');

  await assertPrescriptionWriteAccess(prescription, requestingUserId, requestingRole);

  // Terminal state guard
  if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
    throw new ValidationError(
      `Cannot activate prescription with status '${prescription.status}'`
    );
  }

  if (prescription.status !== 'draft') {
    throw new ValidationError(
      `Cannot transition from '${prescription.status}' to 'active'`
    );
  }

  prescription.status = 'active';
  if (input.notes) {
    prescription.notes = prescription.notes
      ? `${prescription.notes}\n${input.notes}`
      : input.notes;
  }

  await prescription.save();
  return prescription;
}

export async function dispensePrescription(
  id: string,
  input: DispensePrescriptionInput,
  dispensingUserId: string
) {
  const prescription = await Prescription.findById(id);
  if (!prescription) throw new NotFoundError('Prescription');

  // Terminal state guard
  if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
    throw new ValidationError(
      `Cannot dispense prescription with status '${prescription.status}'`
    );
  }

  if (prescription.status !== 'active') {
    throw new ValidationError(
      `Cannot dispense prescription with status '${prescription.status}'. Must be 'active'.`
    );
  }

  // Deduct stock using atomic per-drug updates. Track every successful decrement
  // so a later failure can compensate earlier changes instead of leaving partial stock updates.
  const appliedDeductions: Array<{ drugId: Types.ObjectId; quantity: number }> = [];
  const lowStockAlerts = new Map<string, { drugId: string; drugName: string; currentStock: number; reorderLevel: number }>();

  try {
    for (const item of prescription.lineItems) {
      const deductQty = item.quantity ?? 1;
      const updated = await Drug.findOneAndUpdate(
        { _id: item.drugId, stockQuantity: { $gte: deductQty } },
        { $inc: { stockQuantity: -deductQty } },
        { new: true }
      );

      if (!updated) {
        const drug = await Drug.findById(item.drugId);
        if (!drug) throw new NotFoundError(`Drug ${item.drugId} not found`);
        throw new ValidationError(
          `Insufficient stock for '${drug.name}'. Available: ${drug.stockQuantity}, required: ${deductQty}`
        );
      }

      appliedDeductions.push({ drugId: updated._id, quantity: deductQty });
      if (updated.stockQuantity <= updated.reorderLevel) {
        lowStockAlerts.set(updated._id.toString(), {
          drugId: updated._id.toString(),
          drugName: updated.name,
          currentStock: updated.stockQuantity,
          reorderLevel: updated.reorderLevel,
        });
      }
    }

    prescription.status = 'dispensed';
    prescription.dispensedBy = new Types.ObjectId(dispensingUserId);
    prescription.dispensedAt = new Date();
    if (input.notes) {
      prescription.notes = prescription.notes
        ? `${prescription.notes}\n${input.notes}`
        : input.notes;
    }

    await prescription.save();
  } catch (error) {
    // Best-effort compensation for standalone MongoDB deployments where a
    // multi-document transaction is not available/configured.
    for (const deduction of appliedDeductions.reverse()) {
      await Drug.updateOne(
        { _id: deduction.drugId },
        { $inc: { stockQuantity: deduction.quantity } },
      );
    }
    throw error;
  }

  for (const alert of lowStockAlerts.values()) {
    emitToRole('admin', 'pharmacy:low-stock', alert);
  }
  emitToCurrentHospital('prescription.dispensed', { prescriptionId: prescription._id.toString() });
  emitToCurrentHospital('inventory.updated', { source: 'prescription', prescriptionId: prescription._id.toString() });
  return prescription;
}

export async function cancelPrescription(
  id: string,
  input: CancelPrescriptionInput,
  requestingUserId: string,
  requestingRole: string
) {
  const prescription = await Prescription.findById(id);
  if (!prescription) throw new NotFoundError('Prescription');

  await assertPrescriptionWriteAccess(prescription, requestingUserId, requestingRole);

  // Terminal state guard
  if (prescription.status === 'dispensed' || prescription.status === 'cancelled') {
    throw new ValidationError(
      `Cannot cancel prescription with status '${prescription.status}'`
    );
  }

  prescription.status = 'cancelled';
  if (input.notes) {
    prescription.notes = prescription.notes
      ? `${prescription.notes}\n${input.notes}`
      : input.notes;
  }

  await prescription.save();
  return prescription;
}
