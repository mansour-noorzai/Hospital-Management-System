import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { AppointmentCard, type AppointmentRecord } from '@/components/Shared/AppointmentCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import toast from 'react-hot-toast';
import { PrintReportButton, type PrintableReport } from '@/components/Shared/PrintReportButton';

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta?: { total?: number };
}

interface PatientProfile {
  _id: string;
  patientId: string;
  userId?: { firstName?: string; lastName?: string; email?: string };
}

interface DoctorProfile {
  _id: string;
  doctorId?: string;
  specialization?: string;
  userId?: { firstName?: string; lastName?: string; email?: string };
}

function localDateParam(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function appointmentReport(appointment: AppointmentRecord): PrintableReport {
  const patient = appointment.patient?.userId
    ? `${appointment.patient.userId.firstName} ${appointment.patient.userId.lastName}`
    : '—';
  const doctor = appointment.doctor?.userId
    ? `Dr. ${appointment.doctor.userId.firstName} ${appointment.doctor.userId.lastName}`
    : '—';
  return {
    title: 'Appointment Confirmation',
    reference: appointment.appointmentId,
    fields: [
      { label: 'Appointment ID', value: appointment.appointmentId },
      { label: 'Patient', value: patient },
      { label: 'Patient ID', value: appointment.patient?.patientId },
      { label: 'Doctor', value: doctor },
      { label: 'Specialization', value: appointment.doctor?.specialization },
      { label: 'Date', value: new Date(appointment.date).toLocaleDateString() },
      { label: 'Time', value: appointment.timeSlot },
      { label: 'Type', value: appointment.type },
      { label: 'Status', value: appointment.status },
      { label: 'Reason', value: appointment.reason },
      { label: 'Notes', value: appointment.notes },
    ],
  };
}

export function AdminAppointments() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(localDateParam());
  const [status, setStatus] = useState('');
  const [bookingOpen, setBookingOpen] = useState(false);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(localDateParam());
  const [timeSlot, setTimeSlot] = useState('');
  const [type, setType] = useState<'consultation' | 'follow-up' | 'emergency' | 'procedure'>('consultation');
  const [reason, setReason] = useState('');

  const appointmentQuery = useMemo(() => {
    const params = new URLSearchParams({ date, limit: '100' });
    if (status) params.set('status', status);
    return params.toString();
  }, [date, status]);

  const appointmentsQ = useQuery<ListResponse<AppointmentRecord>>({
    queryKey: ['appointments', 'management', date, status],
    queryFn: () => api.get(`/appointments?${appointmentQuery}`).then(res => res.data),
  });

  const patientsQ = useQuery<ListResponse<PatientProfile>>({
    queryKey: ['appointment-booking', 'patients'],
    queryFn: () => api.get('/patients?limit=100').then(res => res.data),
    enabled: bookingOpen,
  });

  const doctorsQ = useQuery<ListResponse<DoctorProfile>>({
    queryKey: ['appointment-booking', 'doctors'],
    queryFn: () => api.get('/doctors?limit=100').then(res => res.data),
    enabled: bookingOpen,
  });

  const slotsQ = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ['appointment-booking', 'slots', doctorId, bookingDate],
    queryFn: () => api.get(`/appointments/slots?doctorId=${doctorId}&date=${bookingDate}`).then(res => res.data),
    enabled: bookingOpen && Boolean(doctorId && bookingDate),
  });

  const bookMutation = useMutation({
    mutationFn: () => api.post('/appointments', {
      patientId,
      doctorId,
      date: bookingDate,
      timeSlot,
      type,
      reason: reason.trim() || undefined,
    }),
    onSuccess: () => {
      toast.success('Appointment booked successfully');
      setBookingOpen(false);
      setPatientId('');
      setDoctorId('');
      setTimeSlot('');
      setReason('');
      setDate(bookingDate);
      void queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (error: unknown) => {
      const message = (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      toast.error(message ?? 'Failed to book appointment');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/appointments/${id}`, { data: { cancelReason: 'Cancelled by staff' } }),
    onSuccess: () => {
      toast.success('Appointment cancelled');
      void queryClient.invalidateQueries({ queryKey: ['appointments', 'management'] });
    },
    onError: () => toast.error('Failed to cancel appointment'),
  });

  const appointments = appointmentsQ.data?.data ?? [];
  const slots = slotsQ.data?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointment Management</h1>
          <p className="text-sm text-muted-foreground">Book, review, and cancel hospital appointments.</p>
        </div>
        <Button onClick={() => setBookingOpen(true)}>Book Appointment</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="appointment-date">Date</Label>
              <Input id="appointment-date" type="date" value={date} onChange={event => setDate(event.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="appointment-status">Status</Label>
              <select
                id="appointment-status"
                value={status}
                onChange={event => setStatus(event.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">All statuses</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="inProgress">In progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="noShow">No show</option>
              </select>
            </div>
          </div>

          {appointmentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading appointments...</p>}
          {appointmentsQ.isError && <p className="text-sm text-destructive">Failed to load appointments.</p>}
          {!appointmentsQ.isLoading && appointments.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No appointments match these filters.</p>
          )}
          <div className="space-y-3">
            {appointments.map(appointment => (
              <AppointmentCard
                key={appointment._id}
                appointment={appointment}
                viewAs="admin"
                onCancel={id => cancelMutation.mutate(id)}
                extraActions={<PrintReportButton report={appointmentReport(appointment)} />}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Patient</Label>
              <select value={patientId} onChange={event => setPatientId(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="">Select patient</option>
                {(patientsQ.data?.data ?? []).map(patient => (
                  <option key={patient._id} value={patient._id}>
                    {patient.patientId} — {patient.userId?.firstName ?? ''} {patient.userId?.lastName ?? ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Doctor</Label>
              <select
                value={doctorId}
                onChange={event => { setDoctorId(event.target.value); setTimeSlot(''); }}
                className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="">Select doctor</option>
                {(doctorsQ.data?.data ?? []).map(doctor => (
                  <option key={doctor._id} value={doctor._id}>
                    Dr. {doctor.userId?.firstName ?? ''} {doctor.userId?.lastName ?? ''} — {doctor.specialization ?? 'General'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                min={localDateParam()}
                value={bookingDate}
                onChange={event => { setBookingDate(event.target.value); setTimeSlot(''); }}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Type</Label>
              <select value={type} onChange={event => setType(event.target.value as typeof type)} className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                <option value="consultation">Consultation</option>
                <option value="follow-up">Follow-up</option>
                <option value="emergency">Emergency</option>
                <option value="procedure">Procedure</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <Label>Available time</Label>
              <div className="mt-2 flex min-h-10 flex-wrap gap-2 rounded-xl border border-border p-2">
                {slotsQ.isLoading && <span className="text-sm text-muted-foreground">Loading slots...</span>}
                {!slotsQ.isLoading && doctorId && slots.length === 0 && <span className="text-sm text-muted-foreground">No available slots.</span>}
                {!doctorId && <span className="text-sm text-muted-foreground">Select a doctor first.</span>}
                {slots.map(slot => (
                  <button
                    type="button"
                    key={slot}
                    onClick={() => setTimeSlot(slot)}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition ${timeSlot === slot ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'}`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="appointment-reason">Reason</Label>
              <Input id="appointment-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} placeholder="Optional reason for visit" className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBookingOpen(false)}>Cancel</Button>
            <Button
              disabled={!patientId || !doctorId || !bookingDate || !timeSlot || bookMutation.isPending}
              onClick={() => bookMutation.mutate()}
            >
              {bookMutation.isPending ? 'Booking...' : 'Confirm Booking'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
