import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faCapsules, faFileMedical, faFlaskVial, faHospitalUser } from '@fortawesome/free-solid-svg-icons';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { AlertItem } from '@/components/Shared/AlertItem';

interface Appointment {
  _id: string;
  timeSlot?: string;
  status?: string;
  type?: string;
  reason?: string;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string };
}

interface LabOrder {
  _id: string;
  orderId?: string;
  tests?: Array<{ name?: string; code?: string }>;
  priority?: 'routine' | 'urgent' | 'stat';
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  createdAt?: string;
  patient?: { userId?: { firstName?: string; lastName?: string } };
}

interface Prescription { _id: string; status?: string; }

function toLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(appt: Appointment): string {
  const u = appt.patient?.userId;
  return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : 'PT';
}

function getPatientName(appt: Appointment): string {
  const u = appt.patient?.userId;
  return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unknown Patient';
}

function labDotColor(lab: LabOrder): string {
  if (lab.priority === 'urgent' || lab.priority === 'stat') return '#ef4444';
  if (lab.status === 'pending' || lab.status === 'in_progress') return '#f59e0b';
  return '#22c55e';
}

export function DoctorDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const today = useMemo(() => toLocalDateInput(new Date()), []);

  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['doctor-dashboard', 'appointments', today],
    queryFn: () => api.get(`/appointments?date=${today}`).then((r) => r.data),
  });

  const labQ = useQuery<{ success: boolean; data: LabOrder[] }>({
    queryKey: ['doctor-dashboard', 'lab'],
    queryFn: () => api.get('/lab/orders?status=pending,in_progress&limit=5').then((r) => r.data),
  });

  const rxQ = useQuery<{ success: boolean; data: Prescription[] }>({
    queryKey: ['doctor-dashboard', 'prescriptions'],
    queryFn: () => api.get('/pharmacy/prescriptions?status=active&limit=100').then((r) => r.data),
  });

  const todayAppts = apptQ.data?.data ?? [];
  const labOrders = labQ.data?.data ?? [];
  const activePrescriptions = rxQ.data?.data ?? [];
  const urgentLabs = labOrders.filter((l) => l.priority === 'urgent' || l.priority === 'stat');

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-heading">
          {greetingByHour()}, Dr. {user?.firstName}
        </h1>
        <p className="mt-0.5 text-[12px] text-muted-foreground">
          {dateLabel} · {todayAppts.length} patients today
          {urgentLabs.length > 0 && ` · ${urgentLabs.length} urgent lab order${urgentLabs.length > 1 ? 's' : ''} need review`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          title="Today's Patients"
          value={apptQ.isLoading ? '…' : apptQ.isError ? '—' : todayAppts.length}
          trend={`${todayAppts.filter((a) => a.status === 'confirmed').length} confirmed`}
          trendDir="neutral"
          color="green"
          icon={faCalendarCheck}
          isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Pending Lab Orders"
          value={labQ.isLoading ? '…' : labQ.isError ? '—' : labOrders.length}
          subtitle={`${urgentLabs.length} urgent / STAT`}
          trend={urgentLabs.length > 0 ? `${urgentLabs.length} need attention` : 'No urgent orders'}
          trendDir={urgentLabs.length > 0 ? 'down' : 'neutral'}
          color="purple"
          icon={faFlaskVial}
          isLoading={labQ.isLoading}
        />
        <KpiCard
          title="Active Prescriptions"
          value={rxQ.isLoading ? '…' : rxQ.isError ? '—' : activePrescriptions.length}
          trend="Current active prescriptions"
          trendDir="neutral"
          color="amber"
          icon={faCapsules}
          isLoading={rxQ.isLoading}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <h2 className="text-[13px] font-bold text-foreground">Today's Schedule</h2>
          </div>
          <div className="divide-y divide-border/60 px-4">
            {apptQ.isLoading && (
              <div className="space-y-3 py-3">
                {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />)}
              </div>
            )}
            {apptQ.isError && <p className="px-4 py-2 text-sm text-red-500">Failed to load schedule</p>}
            {!apptQ.isLoading && !apptQ.isError && todayAppts.length === 0 && (
              <p className="py-8 text-center text-[12px] text-muted-foreground">No patients scheduled for today</p>
            )}
            {todayAppts.slice(0, 6).map((appt) => (
              <AppointmentRow
                key={appt._id}
                initials={getInitials(appt)}
                name={getPatientName(appt)}
                meta={[appt.doctor?.specialization, appt.reason, appt.patient?.patientId].filter(Boolean).join(' · ')}
                time={appt.timeSlot ?? '—'}
                status={appt.status ?? 'scheduled'}
              />
            ))}
          </div>
          <div className="border-t border-border/70 px-6 py-3 text-end">
            <Link to="/doctor/schedule" className="text-xs font-medium text-primary hover:underline">
              Full schedule →
            </Link>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
            <h2 className="mb-3 text-[13px] font-bold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: faCapsules, label: 'Prescriptions', sub: 'Create or manage', to: '/doctor/prescriptions' },
                { icon: faFlaskVial, label: 'Lab Orders', sub: 'Request or review', to: '/doctor/lab' },
                { icon: faFileMedical, label: 'Documents', sub: 'Clinical documents', to: '/doctor/documents' },
                { icon: faHospitalUser, label: 'Patients', sub: 'Patient directory', to: '/patients' },
              ].map(({ icon, label, sub, to }) => (
                <Link
                  key={label}
                  to={to}
                  className="group flex items-center gap-2 rounded-xl border border-border/70 p-2.5 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-primary/10 text-xs text-primary"><FontAwesomeIcon icon={icon} /></span>
                  <div>
                    <p className="text-[11px] font-bold text-foreground group-hover:text-primary">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-foreground"><FontAwesomeIcon icon={faFlaskVial} className="text-primary" /> Pending Lab Orders</h2>
              <Link to="/doctor/lab" className="text-[11px] font-semibold text-primary hover:underline">View all →</Link>
            </div>
            <div className="px-4 py-1">
              {labQ.isLoading && <div className="m-2 h-16 animate-pulse rounded-lg bg-muted/50" />}
              {labQ.isError && <p className="px-4 py-2 text-sm text-red-500">Failed to load lab orders</p>}
              {!labQ.isLoading && !labQ.isError && labOrders.length === 0 && (
                <p className="py-4 text-center text-[11px] text-muted-foreground">No pending lab orders</p>
              )}
              {labOrders.slice(0, 4).map((lab) => {
                const patName = lab.patient?.userId
                  ? `${lab.patient.userId.firstName ?? ''} ${lab.patient.userId.lastName ?? ''}`.trim()
                  : '—';
                const testNames = lab.tests?.map((test) => test.name).filter(Boolean).join(', ') || 'Lab order';
                const urgent = lab.priority === 'urgent' || lab.priority === 'stat';
                return (
                  <AlertItem
                    key={lab._id}
                    dotColor={labDotColor(lab)}
                    time={lab.createdAt ? new Date(lab.createdAt).toLocaleDateString() : undefined}
                  >
                    {urgent && <strong>{lab.priority === 'stat' ? 'STAT' : 'URGENT'} — </strong>}
                    {testNames}{patName !== '—' && ` · ${patName}`}
                  </AlertItem>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
