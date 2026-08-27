import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faFileInvoiceDollar, faHospitalUser, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ListResponse<T> {
  success: boolean;
  data: T[];
  meta?: { total?: number };
}
interface Patient { _id: string; }
interface Invoice { _id: string; balance?: number; }
interface Appointment {
  _id: string; timeSlot?: string; status?: string;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}

function localDateParam(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ReceptionistDashboard() {
  const user = useAppSelector(state => state.auth.user);
  const today = localDateParam();

  const patientsQ = useQuery<ListResponse<Patient>>({
    queryKey: ['receptionist-dashboard', 'patients'],
    queryFn: () => api.get('/patients?limit=1').then(res => res.data),
  });
  const appointmentsQ = useQuery<ListResponse<Appointment>>({
    queryKey: ['receptionist-dashboard', 'appointments', today],
    queryFn: () => api.get(`/appointments?date=${today}&limit=5`).then(res => res.data),
  });
  const billingQ = useQuery<ListResponse<Invoice>>({
    queryKey: ['receptionist-dashboard', 'billing'],
    queryFn: () => api.get('/billing?status=issued,partial,overdue&limit=100').then(res => res.data),
  });

  const appointments = appointmentsQ.data?.data ?? [];
  const outstandingInvoices = billingQ.data?.data ?? [];
  const outstandingBalance = outstandingInvoices.reduce((sum, invoice) => sum + (invoice.balance ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-heading">Front Desk</h1>
        <p className="text-sm text-muted-foreground">Welcome, {user?.firstName}. Manage today’s patient flow and billing.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard title="Registered Patients" value={patientsQ.isLoading ? '…' : patientsQ.data?.meta?.total ?? 0} trend="Patient directory" trendDir="neutral" color="blue" icon={faHospitalUser} isLoading={patientsQ.isLoading} />
        <KpiCard title="Appointments Today" value={appointmentsQ.isLoading ? '…' : appointmentsQ.data?.meta?.total ?? appointments.length} trend="Today’s schedule" trendDir="neutral" color="green" icon={faCalendarCheck} isLoading={appointmentsQ.isLoading} />
        <KpiCard title="Outstanding Billing" value={billingQ.isLoading ? '…' : `$${outstandingBalance.toLocaleString()}`} trend={`${outstandingInvoices.length} open invoice${outstandingInvoices.length === 1 ? '' : 's'}`} trendDir="neutral" color="amber" icon={faFileInvoiceDollar} isLoading={billingQ.isLoading} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-base">Today’s Appointments</CardTitle>
            <Link to="/admin/appointments" className="text-sm font-semibold text-primary hover:underline">Manage all →</Link>
          </CardHeader>
          <CardContent>
            {appointmentsQ.isLoading && <p className="text-sm text-muted-foreground">Loading appointments...</p>}
            {!appointmentsQ.isLoading && appointments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No appointments scheduled today.</p>}
            <div className="divide-y divide-border/60">
              {appointments.map(appointment => {
                const patient = appointment.patient?.userId;
                const doctor = appointment.doctor?.userId;
                return (
                  <AppointmentRow
                    key={appointment._id}
                    initials={patient ? `${patient.firstName?.[0] ?? ''}${patient.lastName?.[0] ?? ''}`.toUpperCase() : 'PT'}
                    name={patient ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() : appointment.patient?.patientId ?? 'Patient'}
                    meta={doctor ? `Dr. ${doctor.firstName ?? ''} ${doctor.lastName ?? ''} · ${appointment.doctor?.specialization ?? ''}` : 'Doctor'}
                    time={appointment.timeSlot ?? '—'}
                    status={appointment.status ?? 'scheduled'}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
          <CardContent className="grid gap-2">
            <Link to="/admin/appointments" className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold transition hover:border-primary/35 hover:bg-primary/5"><FontAwesomeIcon icon={faCalendarCheck} className="text-primary" /> Book appointment</Link>
            <Link to="/patients" className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold transition hover:border-primary/35 hover:bg-primary/5"><FontAwesomeIcon icon={faUserPlus} className="text-primary" /> Register patient</Link>
            <Link to="/admin/billing" className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm font-semibold transition hover:border-primary/35 hover:bg-primary/5"><FontAwesomeIcon icon={faFileInvoiceDollar} className="text-primary" /> Manage billing</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
