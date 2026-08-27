import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faCapsules, faFileInvoiceDollar, faFileMedical, faFlaskVial } from '@fortawesome/free-solid-svg-icons';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AlertItem } from '@/components/Shared/AlertItem';

interface Appointment {
  _id: string; date?: string; timeSlot?: string; status?: string; reason?: string;
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}
interface Invoice {
  _id: string; invoiceId?: string; total?: number; balance?: number; status?: string; createdAt?: string;
}
interface PrescriptionLineItem {
  drugName?: string; dosage?: string; frequency?: string; duration?: string; quantity?: number;
}
interface Prescription {
  _id: string; status?: string; lineItems?: PrescriptionLineItem[]; createdAt?: string;
}
interface LabResultItem { testName?: string; value?: string; unit?: string; isNormal?: boolean; }
interface LabResult {
  _id: string; status?: 'preliminary' | 'final' | 'amended'; createdAt?: string; resultedAt?: string;
  results?: LabResultItem[];
}

type TimelineEvent =
  | { kind: 'lab';    _id: string; title: string; sub: string; date: string; icon: IconDefinition; iconBg: string }
  | { kind: 'appt';   _id: string; title: string; sub: string; date: string; icon: IconDefinition; iconBg: string }
  | { kind: 'bill';   _id: string; title: string; sub: string; date: string; icon: IconDefinition; iconBg: string }
  | { kind: 'script'; _id: string; title: string; sub: string; date: string; icon: IconDefinition; iconBg: string };

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(d?: string): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatApptDate(dateStr?: string): { day: string; month: string; bg: string; text: string } {
  if (!dateStr) return { day: '—', month: '—', bg: 'bg-muted', text: 'text-muted-foreground' };
  const d = new Date(dateStr);
  const day   = d.getDate().toString();
  const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const daysAway = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (daysAway <= 3)  return { day, month, bg: 'bg-blue-50',    text: 'text-blue-700' };
  if (daysAway <= 14) return { day, month, bg: 'bg-emerald-50', text: 'text-emerald-700' };
  return { day, month, bg: 'bg-muted', text: 'text-muted-foreground' };
}

function localDateParam(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function PatientDashboard() {
  const user = useAppSelector(s => s.auth.user);

  const today = localDateParam();

  const apptQ = useQuery<{ success: boolean; data: Appointment[] }>({
    queryKey: ['patient-dashboard', 'appointments', today],
    queryFn: () => api.get(`/appointments?status=scheduled,confirmed&dateFrom=${today}&limit=5`).then(r => r.data),
  });

  const billsQ = useQuery<{ success: boolean; data: Invoice[] }>({
    queryKey: ['patient-dashboard', 'billing'],
    queryFn: () => api.get('/billing?status=issued,partial,overdue&limit=20').then(r => r.data),
  });

  const rxQ = useQuery<{ success: boolean; data: Prescription[] }>({
    queryKey: ['patient-dashboard', 'prescriptions'],
    queryFn: () => api.get('/pharmacy/prescriptions?status=active&limit=10').then(r => r.data),
  });

  const labQ = useQuery<{ success: boolean; data: LabResult[] }>({
    queryKey: ['patient-dashboard', 'lab'],
    queryFn: () => api.get('/lab/results?limit=5').then(r => r.data),
  });

  const upcomingAppts = apptQ.data?.data ?? [];
  const outstandingBills = billsQ.data?.data ?? [];
  const activePrescriptions = rxQ.data?.data ?? [];
  const labResults = labQ.data?.data ?? [];

  const outstandingAmt = outstandingBills.reduce((sum, bill) => sum + (bill.balance ?? 0), 0);
  const finalizedLabCount = labResults.filter(result => result.status === 'final' || result.status === 'amended').length;

  const upcomingCount = upcomingAppts.filter(
    (a: Appointment) => a.status !== 'completed' && a.status !== 'cancelled'
  ).length;

  const nextAppt = upcomingAppts[0];
  const nextApptLabel = nextAppt?.date
    ? `Next appointment: ${new Date(nextAppt.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`
    : 'No upcoming appointments';

  // Build timeline from live API data only.
  const timeline: TimelineEvent[] = [
    ...labResults.slice(0, 2).map(result => ({
      kind: 'lab' as const,
      _id: result._id,
      title: `Lab Result: ${result.results?.map(item => item.testName).filter(Boolean).join(', ') || 'Test result'}`,
      sub: result.status === 'final' || result.status === 'amended' ? 'Results ready for review' : 'Preliminary result',
      date: formatDate(result.resultedAt ?? result.createdAt),
      icon: faFlaskVial, iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    })),
    ...upcomingAppts.map(appointment => ({
      kind: 'appt' as const,
      _id: appointment._id,
      title: 'Upcoming Appointment',
      sub: appointment.doctor?.userId
        ? `Dr. ${appointment.doctor.userId.firstName} ${appointment.doctor.userId.lastName} · ${appointment.doctor.specialization ?? ''}`
        : appointment.reason ?? 'Scheduled visit',
      date: formatDate(appointment.date),
      icon: faCalendarCheck, iconBg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300',
    })),
    ...activePrescriptions.slice(0, 1).map(prescription => {
      const firstItem = prescription.lineItems?.[0];
      return {
        kind: 'script' as const,
        _id: prescription._id,
        title: 'Prescription Active',
        sub: [firstItem?.drugName, firstItem?.dosage, firstItem?.frequency].filter(Boolean).join(' · ') || 'Active prescription',
        date: formatDate(prescription.createdAt),
        icon: faCapsules, iconBg: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
      };
    }),
  ].slice(0, 5);


  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-heading">
            {greetingByHour()}, {user?.firstName}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">{nextApptLabel}</p>
        </div>
        <Link
          to="/patient/book-appointment"
          className="text-[11px] font-semibold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/15 dark:bg-primary/15 px-3 py-2 rounded-lg transition-colors"
        >
          + Book Appointment
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Upcoming Appointments" value={apptQ.isLoading ? '…' : upcomingCount}
          trend={nextAppt?.date ? `Next: ${new Date(nextAppt.date).toLocaleDateString('en-US', { weekday: 'short' })}` : 'None'}
          trendDir="neutral" color="blue" icon={faCalendarCheck} isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Active Prescriptions" value={rxQ.isLoading ? '…' : activePrescriptions.length}
          trend="Active" trendDir="up" color="green" icon={faCapsules} isLoading={rxQ.isLoading}
        />
        <KpiCard
          title="Lab Results"          value={labQ.isLoading ? '…' : labResults.length}
          trend={finalizedLabCount > 0 ? `${finalizedLabCount} ready` : 'No final results'} trendDir="neutral"
          color="purple" icon={faFlaskVial} isLoading={labQ.isLoading}
        />
        <KpiCard
          title="Outstanding Balance"  value={billsQ.isLoading ? '…' : outstandingAmt > 0 ? `$${outstandingAmt.toLocaleString()}` : '$0'}
          trend={outstandingBills.length > 0 ? `${outstandingBills.length} due` : 'All paid'} trendDir={outstandingBills.length > 0 ? 'down' : 'neutral'}
          color="amber" icon={faFileInvoiceDollar} isLoading={billsQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Appointments */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="text-[13px] font-bold text-foreground">My Appointments</h2>
            <Link to="/patient/book-appointment" className="text-xs font-medium text-primary hover:text-primary/80">Book new →</Link>
          </div>
          <div className="px-4 divide-y divide-border/60">
            {apptQ.isLoading && (
              <div className="space-y-3 py-3">
                {[1,2].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
              </div>
            )}
            {!apptQ.isLoading && upcomingAppts.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[12px] text-muted-foreground mb-3">No upcoming appointments</p>
                <Link to="/patient/book-appointment" className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100">
                  Book Appointment
                </Link>
              </div>
            )}
            {upcomingAppts.map(appt => {
              const dateParts = formatApptDate(appt.date);
              const docName = appt.doctor?.userId
                ? `Dr. ${appt.doctor.userId.firstName} ${appt.doctor.userId.lastName}`
                : 'Doctor TBD';
              return (
                <div key={appt._id} className="flex items-center gap-3 py-3 border-b border-border/60 last:border-0">
                  <div className={`w-10 h-10 ${dateParts.bg} rounded-xl flex flex-col items-center justify-center flex-shrink-0`}>
                    <span className={`text-[14px] font-extrabold ${dateParts.text} leading-none`}>{dateParts.day}</span>
                    <span className={`text-[8px] font-bold ${dateParts.text} opacity-70`}>{dateParts.month}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{docName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {appt.timeSlot ?? '—'} · {appt.doctor?.specialization ?? 'General'}{appt.reason ? ` · ${appt.reason}` : ''}
                    </p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    appt.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                  }`}>
                    {appt.status === 'confirmed' ? 'Confirmed' : 'Scheduled'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-card rounded-2xl border border-border/70 shadow-sm p-4">
            <h2 className="text-[13px] font-bold text-foreground mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: faCalendarCheck, label: 'Book Appt', sub: 'Schedule visit', to: '/patient/book-appointment' },
                { icon: faCapsules, label: 'Refill Rx', sub: 'Request refill', to: '/patient/prescriptions' },
                { icon: faFileInvoiceDollar, label: 'Pay Bill', sub: outstandingAmt > 0 ? `$${outstandingAmt.toLocaleString()} due` : 'No balance due', to: '/patient/billing' },
                { icon: faFileMedical, label: 'My Records', sub: 'Documents', to: '/patient/documents' },
              ].map(({ icon, label, sub, to }) => (
                <Link
                  key={label} to={to}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-border hover:border-indigo-300 hover:bg-indigo-50 transition-colors group"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[11px] bg-primary/10 text-xs text-primary"><FontAwesomeIcon icon={icon} /></span>
                  <div>
                    <p className="text-[11px] font-bold text-foreground group-hover:text-indigo-700">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Active prescriptions */}
          <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h2 className="text-[13px] font-bold text-foreground">Active Prescriptions</h2>
              <Link to="/patient/prescriptions" className="text-[11px] font-semibold text-indigo-600 hover:underline">View all →</Link>
            </div>
            <div className="px-4 py-1">
              {rxQ.isLoading && <div className="h-16 animate-pulse bg-muted/50 rounded-lg m-2" />}
              {!rxQ.isLoading && activePrescriptions.length === 0 && (
                <p className="text-[11px] text-muted-foreground py-4 text-center">No active prescriptions</p>
              )}
              {activePrescriptions.slice(0, 3).map(rx => {
                const firstItem = rx.lineItems?.[0];
                const extraCount = Math.max(0, (rx.lineItems?.length ?? 0) - 1);
                return (
                  <AlertItem key={rx._id} dotColor="#10b981">
                    <strong>{firstItem?.drugName ?? 'Medication'}</strong>
                    {firstItem?.dosage && ` — ${firstItem.dosage}`}
                    {firstItem?.frequency && <span className="text-muted-foreground"> · {firstItem.frequency}</span>}
                    {extraCount > 0 && <span className="text-muted-foreground"> · +{extraCount} more</span>}
                  </AlertItem>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Health Activity Timeline */}
      <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
          <h3 className="text-[13px] font-bold text-foreground">Health Activity Timeline</h3>
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No recent activity</p>
        ) : (
          <div className="divide-y divide-border/60">
            {timeline.map(event => (
              <div key={`${event.kind}-${event._id}`} className="flex items-center gap-3 py-3 px-4">
                <div className={`w-8 h-8 ${event.iconBg} rounded-xl flex items-center justify-center text-xs flex-shrink-0`}>
                  <FontAwesomeIcon icon={event.icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">{event.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{event.sub}</p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">{event.date}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
