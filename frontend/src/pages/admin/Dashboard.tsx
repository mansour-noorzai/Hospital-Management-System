import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBell, faCalendarCheck, faChartLine, faFileInvoiceDollar, faFlaskVial, faHospitalUser, faMoneyBillTrendUp, faUserDoctor, faUserPlus } from '@fortawesome/free-solid-svg-icons';
import api from '@/lib/api';
import { useAppSelector } from '@/store/hooks';
import { KpiCard } from '@/components/Shared/KpiCard';
import { AppointmentRow } from '@/components/Shared/AppointmentRow';
import { AlertItem } from '@/components/Shared/AlertItem';
import { StatBar } from '@/components/Shared/StatBar';
import { cn } from '@/lib/utils';

// Minimal types for dashboard queries
interface ApiListResponse<T> {
  success: boolean;
  data: T[];
  meta?: { total?: number; page?: number; limit?: number; totalPages?: number };
}
interface Patient { _id: string; }
interface StaffMember { _id: string; }
interface LabOrder {
  _id: string; orderId?: string; status?: string; priority?: string; createdAt?: string;
  tests?: Array<{ name?: string; code?: string; status?: string }>;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { userId?: { firstName?: string; lastName?: string } };
}
interface Appointment {
  _id: string; timeSlot?: string; status?: string; type?: string; reason?: string;
  patient?: { patientId?: string; userId?: { firstName?: string; lastName?: string } };
  doctor?: { specialization?: string; userId?: { firstName?: string; lastName?: string } };
}
interface InventoryItem { _id: string; name?: string; quantity?: number; reorderLevel?: number; }
interface RevenueAnalytics {
  byMonth: Array<{ _id: string; revenue: number; count: number }>;
  outstanding: number;
}
interface AppointmentAnalytics {
  byStatus: Array<{ _id: string; count: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#0ea5e9',
  confirmed: '#10b981',
  inProgress: '#6366f1',
  completed: '#64748b',
  cancelled: '#ef4444',
  noShow: '#f59e0b',
};

function localDateParam(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function greetingByHour(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getInitials(a?: Appointment | null): string {
  const u = a?.patient?.userId;
  return u ? `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase() : 'PT';
}

function getPatientName(a: Appointment): string {
  const u = a.patient?.userId;
  return u ? `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : 'Unknown Patient';
}

function getDoctorMeta(a: Appointment): string {
  const u = a.doctor?.userId;
  const spec = a.doctor?.specialization ?? '';
  return u ? `${spec} · Dr. ${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() : spec;
}

export function AdminDashboard() {
  const user = useAppSelector(s => s.auth.user);
  const [apptTab, setApptTab] = useState<'today' | 'upcoming'>('today');

  const today = localDateParam();

  const patientsQ = useQuery<ApiListResponse<Patient>>({
    queryKey: ['admin-dash', 'patients-count'],
    queryFn: () => api.get('/patients?limit=1').then(r => r.data),
  });

  const staffQ = useQuery<ApiListResponse<StaffMember>>({
    queryKey: ['admin-dash', 'staff-count'],
    queryFn: () => api.get('/staff?isActive=true&limit=1').then(r => r.data),
  });

  const apptQ = useQuery<ApiListResponse<Appointment>>({
    queryKey: ['appointments', 'today', today],
    queryFn: () => api.get(`/appointments?date=${today}&limit=5`).then(r => r.data),
  });

  const upcomingQ = useQuery<ApiListResponse<Appointment>>({
    queryKey: ['appointments', 'upcoming', today],
    queryFn: () => api.get(`/appointments?status=scheduled,confirmed&dateFrom=${today}&limit=5`).then(r => r.data),
  });

  const revenueQ = useQuery<{ success: boolean; data: RevenueAnalytics }>({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => api.get('/analytics/revenue').then(r => r.data),
  });

  const appointmentAnalyticsQ = useQuery<{ success: boolean; data: AppointmentAnalytics }>({
    queryKey: ['analytics', 'appointments', 'status'],
    queryFn: () => api.get('/analytics/appointments?period=month').then(r => r.data),
  });

  const labQ = useQuery<ApiListResponse<LabOrder>>({
    queryKey: ['admin-dash', 'lab'],
    queryFn: () => api.get('/lab/orders?status=pending,in_progress&limit=5').then(r => r.data),
  });

  const lowStockQ = useQuery<ApiListResponse<InventoryItem>>({
    queryKey: ['inventory-low'],
    queryFn: () => api.get('/inventory/items?lowStock=true&limit=3').then(r => r.data),
  });

  const totalPatients = patientsQ.data?.meta?.total ?? 0;
  const totalStaff = staffQ.data?.meta?.total ?? 0;
  const todayAppts = apptQ.data?.data ?? [];
  const todayAppointmentTotal = apptQ.data?.meta?.total ?? todayAppts.length;
  const upcomingAppts = upcomingQ.data?.data ?? [];
  const pendingLabs = labQ.data?.data ?? [];
  const lowStockItems = lowStockQ.data?.data ?? [];

  const currentMonth = monthKey();
  const previousMonthDate = new Date();
  previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
  const previousMonth = monthKey(previousMonthDate);
  const revenueSeries = revenueQ.data?.data.byMonth ?? [];
  const currentRevenue = revenueSeries.find(item => item._id === currentMonth)?.revenue ?? 0;
  const previousRevenue = revenueSeries.find(item => item._id === previousMonth)?.revenue ?? 0;
  const revenueChange = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : null;

  const appointmentStatusStats = appointmentAnalyticsQ.data?.data.byStatus ?? [];
  const maxStatusCount = Math.max(1, ...appointmentStatusStats.map(item => item.count));

  const dateLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const alerts = [
    ...pendingLabs.filter(l => l.priority === 'urgent' || l.priority === 'stat').slice(0, 2).map(l => ({
      dotColor: '#ef4444',
      text: `${l.priority === 'stat' ? 'STAT' : 'Urgent'} lab order — Patient ${l.patient?.patientId || 'unknown'}`,
      time: l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
    })),
    ...lowStockItems.slice(0, 2).map(item => ({
      dotColor: '#f59e0b',
      text: `Low stock: ${item.name ?? 'Inventory item'} (${item.quantity ?? 0}/${item.reorderLevel ?? 0})`,
      time: 'Current',
    })),
  ].slice(0, 4);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-heading">
            {greetingByHour()}, {user?.firstName}
          </h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            {dateLabel} · Hospital Overview
          </p>
        </div>
        <Link
          to="/admin/analytics"
          className="inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/15"
        >
          <FontAwesomeIcon icon={faChartLine} /> Analytics →
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Total Patients"
          value={patientsQ.isLoading ? '…' : patientsQ.isError ? '—' : totalPatients.toLocaleString()}
          trend="Registered patients" trendDir="neutral"
          color="blue" icon={faHospitalUser} isLoading={patientsQ.isLoading}
        />
        <KpiCard
          title="Appointments Today"
          value={apptQ.isLoading ? '…' : todayAppointmentTotal}
          trend={`${todayAppts.filter(a => a.status === 'scheduled').length} shown pending`} trendDir="neutral"
          color="green" icon={faCalendarCheck} isLoading={apptQ.isLoading}
        />
        <KpiCard
          title="Revenue (MTD)"
          value={revenueQ.isLoading ? '…' : revenueQ.isError ? '—' : `$${currentRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          trend={revenueChange === null ? 'Recorded payments' : `${Math.abs(revenueChange).toFixed(1)}% vs last month`}
          trendDir={revenueChange === null || revenueChange === 0 ? 'neutral' : revenueChange > 0 ? 'up' : 'down'}
          color="amber" icon={faMoneyBillTrendUp} isLoading={revenueQ.isLoading}
        />
        <KpiCard
          title="Active Staff"
          value={staffQ.isLoading ? '…' : staffQ.isError ? '—' : totalStaff}
          trend="Active staff profiles" trendDir="neutral"
          color="purple" icon={faUserDoctor} isLoading={staffQ.isLoading}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Appointments card - takes 2 cols */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="text-[13px] font-bold text-foreground">Appointments</h2>
            <div className="flex items-center gap-3">
              <div className="flex gap-1 bg-muted rounded-lg p-0.5">
                {(['today','upcoming'] as const).map(tab => (
                  <button key={tab} onClick={() => setApptTab(tab)}
                    className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors capitalize',
                      apptTab === tab ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    {tab}
                  </button>
                ))}
              </div>
              <Link to="/patients" className="text-[11px] font-semibold text-indigo-600 hover:underline">
                View all →
              </Link>
            </div>
          </div>
          <div className="px-4 divide-y divide-border/60">
            {apptTab === 'today' && (
              <>
                {apptQ.isLoading && (
                  <div className="space-y-3 py-3">
                    {[1,2,3].map(i => <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />)}
                  </div>
                )}
                {!apptQ.isLoading && todayAppts.length === 0 && (
                  <p className="text-[12px] text-muted-foreground py-6 text-center">No appointments scheduled today</p>
                )}
                {todayAppts.map(appt => (
                  <AppointmentRow
                    key={appt._id}
                    initials={getInitials(appt)}
                    name={getPatientName(appt)}
                    meta={getDoctorMeta(appt)}
                    time={appt.timeSlot ?? '—'}
                    status={appt.status ?? 'scheduled'}
                  />
                ))}
              </>
            )}
            {apptTab === 'upcoming' && (
              <>
                {upcomingQ.isLoading && (
                  <div className="space-y-3 py-3">
                    {[1,2,3].map(i => <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />)}
                  </div>
                )}
                {!upcomingQ.isLoading && upcomingAppts.length === 0 && (
                  <p className="text-[12px] text-muted-foreground py-6 text-center">No upcoming appointments</p>
                )}
                {upcomingAppts.map(appt => (
                  <AppointmentRow
                    key={appt._id}
                    initials={getInitials(appt)}
                    name={getPatientName(appt)}
                    meta={getDoctorMeta(appt)}
                    time={appt.timeSlot ?? '—'}
                    status={appt.status ?? 'scheduled'}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <div className="bg-card rounded-2xl border border-border/70 shadow-sm p-4">
            <h2 className="text-[13px] font-bold text-foreground mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: faUserPlus, label: 'New Patient', sub: 'Register', to: '/patients' },
                { icon: faCalendarCheck, label: 'Book Appointment', sub: 'Schedule visit', to: '/admin/appointments' },
                { icon: faFileInvoiceDollar, label: 'Billing', sub: 'Manage bills', to: '/admin/billing' },
                { icon: faUserDoctor, label: 'Staff', sub: 'Manage team', to: '/admin/staff' },
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

          {/* Live Alerts */}
          <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
              <h2 className="flex items-center gap-2 text-[13px] font-bold text-foreground"><FontAwesomeIcon icon={faBell} className="text-amber-500" /> Live Alerts</h2>
            </div>
            <div className="px-4 py-1">
              {alerts.length === 0 ? (
                <p className="py-5 text-center text-[11px] text-muted-foreground">No urgent operational alerts</p>
              ) : alerts.map((a) => (
                <AlertItem key={a.text} dotColor={a.dotColor} time={a.time}>{a.text}</AlertItem>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid — department load + pending labs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl border border-border/70 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-bold text-foreground">Appointment Status</h2>
            <Link to="/admin/analytics" className="text-[11px] text-indigo-600 hover:underline font-semibold">View report →</Link>
          </div>
          {appointmentAnalyticsQ.isLoading ? (
            <div className="space-y-3 py-2">{[1, 2, 3].map(i => <div key={i} className="h-6 rounded bg-muted animate-pulse" />)}</div>
          ) : appointmentStatusStats.length === 0 ? (
            <p className="py-5 text-center text-[11px] text-muted-foreground">No appointment data yet</p>
          ) : appointmentStatusStats.map(item => (
            <StatBar
              key={item._id}
              label={item._id.replace(/([A-Z])/g, ' $1')}
              value={item.count}
              max={maxStatusCount}
              color={STATUS_COLORS[item._id] ?? '#64748b'}
            />
          ))}
        </div>

        <div className="bg-card rounded-2xl border border-border/70 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
            <h2 className="flex items-center gap-2 text-[13px] font-bold text-foreground"><FontAwesomeIcon icon={faFlaskVial} className="text-primary" /> Pending Lab Orders</h2>
            <Link to="/admin/lab" className="text-[11px] text-indigo-600 hover:underline font-semibold">View all →</Link>
          </div>
          <div className="px-4 divide-y divide-border/60">
            {labQ.isLoading && (
              <div className="space-y-2 py-3">
                {[1,2,3].map(i => <div key={i} className="h-7 bg-muted rounded animate-pulse" />)}
              </div>
            )}
            {labQ.isError && <p className="text-sm text-red-500 px-4 py-2">Failed to load lab orders</p>}
            {!labQ.isLoading && pendingLabs.length === 0 && (
              <p className="text-[12px] text-muted-foreground py-6 text-center">No pending lab orders</p>
            )}
            {pendingLabs.map(lab => {
              const patName = lab.patient?.userId
                ? `${lab.patient.userId.firstName ?? ''} ${lab.patient.userId.lastName ?? ''}`.trim()
                : lab.patient?.patientId ?? '—';
              const docName = lab.doctor?.userId
                ? `Dr. ${lab.doctor.userId.firstName ?? ''} ${lab.doctor.userId.lastName ?? ''}`.trim()
                : 'Unknown';
              const createdLabel = lab.createdAt
                ? new Date(lab.createdAt).toLocaleDateString() : '—';
              return (
                <div key={lab._id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-foreground truncate">{lab.tests?.map(test => test.name).filter(Boolean).join(', ') || lab.orderId || '—'}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{patName} · {docName} · {createdLabel}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    lab.priority === 'urgent' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {lab.status ?? 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
