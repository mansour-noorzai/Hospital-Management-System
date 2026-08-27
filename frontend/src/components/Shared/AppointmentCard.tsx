import { StatusBadge } from '@/components/Shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ReactNode } from 'react';

export interface AppointmentRecord {
  _id: string;
  appointmentId: string;
  date: string;
  timeSlot: string;
  type: string;
  status: string;
  reason?: string;
  notes?: string;
  doctor?: {
    _id: string;
    specialization: string;
    userId?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
  patient?: {
    _id: string;
    patientId: string;
    userId?: {
      firstName: string;
      lastName: string;
      email: string;
    };
  };
}

interface AppointmentCardProps {
  appointment: AppointmentRecord;
  viewAs?: 'doctor' | 'patient' | 'admin';
  onConfirm?: (id: string) => void;
  onStart?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  extraActions?: ReactNode;
}

export function AppointmentCard({
  appointment,
  viewAs = 'admin',
  onConfirm,
  onStart,
  onComplete,
  onCancel,
  extraActions,
}: AppointmentCardProps) {
  const appointmentDate = new Date(appointment.date).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const doctorName = appointment.doctor?.userId
    ? `Dr. ${appointment.doctor.userId.firstName} ${appointment.doctor.userId.lastName}`
    : 'Unknown Doctor';

  const patientName = appointment.patient?.userId
    ? `${appointment.patient.userId.firstName} ${appointment.patient.userId.lastName}`
    : 'Unknown Patient';

  const appointmentDay = new Date(appointment.date);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  appointmentDay.setHours(0, 0, 0, 0);
  const isActionable = ['scheduled', 'confirmed', 'inProgress'].includes(appointment.status) && appointmentDay >= todayStart;

  return (
    <Card className="w-full">
      <CardContent className="pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-mono text-muted-foreground">{appointment.appointmentId}</span>
              <StatusBadge status={appointment.status} />
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded capitalize">
                {appointment.type}
              </span>
            </div>

            <p className="font-semibold text-gray-900 dark:text-white">
              {appointmentDate} at {appointment.timeSlot}
            </p>

            {viewAs !== 'doctor' && (
              <p className="text-sm text-muted-foreground">{doctorName} — {appointment.doctor?.specialization}</p>
            )}

            {viewAs !== 'patient' && (
              <p className="text-sm text-muted-foreground">Patient: {patientName}</p>
            )}

            {appointment.reason && (
              <p className="text-sm text-muted-foreground">Reason: {appointment.reason}</p>
            )}
          </div>

          {(isActionable || extraActions) && (
            <div className="flex flex-wrap gap-2 shrink-0">
              {extraActions}
              {viewAs === 'doctor' && appointment.status === 'scheduled' && onConfirm && (
                <Button size="sm" variant="outline" onClick={() => onConfirm(appointment._id)}>
                  Confirm
                </Button>
              )}
              {viewAs === 'doctor' && appointment.status === 'confirmed' && onStart && (
                <Button size="sm" variant="outline" onClick={() => onStart(appointment._id)}>
                  Start
                </Button>
              )}
              {viewAs === 'doctor' && appointment.status === 'inProgress' && onComplete && (
                <Button size="sm" variant="outline" onClick={() => onComplete(appointment._id)}>
                  Complete
                </Button>
              )}
              {(viewAs === 'patient' || viewAs === 'admin') &&
                (appointment.status === 'scheduled' || appointment.status === 'confirmed') &&
                onCancel && (
                  <Button size="sm" variant="destructive" onClick={() => onCancel(appointment._id)}>
                    Cancel
                  </Button>
                )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
