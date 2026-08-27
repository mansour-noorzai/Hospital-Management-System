import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendarCheck, faCapsules, faChartColumn, faFileInvoiceDollar, faFlaskVial, faRotate } from '@fortawesome/free-solid-svg-icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { usePreferences } from '@/providers/PreferencesProvider';

type Period = 'day' | 'week' | 'month';

interface CountPoint { _id: string; count: number }
interface AppointmentAnalytics {
  volumeByPeriod?: CountPoint[];
  byStatus?: CountPoint[];
  byDoctor?: Array<CountPoint & { doctorName?: string }>;
}
interface RevenueAnalytics {
  byMonth?: Array<{ _id: string; revenue: number }>;
  outstanding?: number;
  paymentMethods?: Array<{ _id: string; count: number; amount?: number; total?: number }>;
}
interface LabAnalytics {
  byPriority?: CountPoint[];
  byStatus?: CountPoint[];
  recentVolume?: CountPoint[];
}
interface PrescriptionAnalytics {
  byStatus?: CountPoint[];
  fillRate?: number;
  topDrugs?: CountPoint[];
}

interface ApiResponse<T> { success: boolean; data: T }

const COLORS = ['#0ea5e9', '#10b981', '#fb923c', '#ef4444', '#6366f1', '#a855f7'];

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-[22px] border border-border/70 bg-card p-6">
      <div className="h-4 w-1/4 rounded bg-muted" />
      <div className="h-64 rounded-2xl bg-muted" />
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-destructive">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}><FontAwesomeIcon icon={faRotate} />Retry</Button>
    </div>
  );
}

function EmptyChart({ message = 'No analytics data is available yet.' }: { message?: string }) {
  return <div className="grid h-[240px] place-items-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">{message}</div>;
}

function MetricCard({ icon, label, value, detail, tone }: { icon: typeof faChartColumn; label: string; value: string; detail: string; tone: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-sm ${tone}`}><FontAwesomeIcon icon={icon} /></div>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function AdminAnalytics() {
  const { hospital, language } = usePreferences();
  const [period, setPeriod] = useState<Period>('month');
  const currency = hospital?.currency ?? 'AFN';
  const locale = language === 'da' ? 'fa-AF' : language === 'ps' ? 'ps-AF' : 'en-US';
  const money = useMemo(() => new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }), [currency, locale]);

  const apptQuery = useQuery<ApiResponse<AppointmentAnalytics>>({
    queryKey: ['analytics', 'appointments', period],
    queryFn: () => api.get(`/analytics/appointments?period=${period}`).then((response) => response.data),
  });
  const revenueQuery = useQuery<ApiResponse<RevenueAnalytics>>({
    queryKey: ['analytics', 'revenue'],
    queryFn: () => api.get('/analytics/revenue').then((response) => response.data),
  });
  const labQuery = useQuery<ApiResponse<LabAnalytics>>({
    queryKey: ['analytics', 'lab'],
    queryFn: () => api.get('/analytics/lab').then((response) => response.data),
  });
  const rxQuery = useQuery<ApiResponse<PrescriptionAnalytics>>({
    queryKey: ['analytics', 'prescriptions'],
    queryFn: () => api.get('/analytics/prescriptions').then((response) => response.data),
  });

  const appointmentVolume = [...(apptQuery.data?.data.volumeByPeriod ?? [])].reverse();
  const appointmentStatus = apptQuery.data?.data.byStatus ?? [];
  const doctors = apptQuery.data?.data.byDoctor ?? [];
  const revenueSeries = [...(revenueQuery.data?.data.byMonth ?? [])].reverse();
  const paymentMethods = revenueQuery.data?.data.paymentMethods ?? [];
  const labPriority = labQuery.data?.data.byPriority ?? [];
  const labStatus = labQuery.data?.data.byStatus ?? [];
  const labVolume = [...(labQuery.data?.data.recentVolume ?? [])].reverse();
  const prescriptionStatus = rxQuery.data?.data.byStatus ?? [];
  const topDrugs = rxQuery.data?.data.topDrugs ?? [];
  const fillRate = rxQuery.data?.data.fillRate ?? 0;
  const totalAppointments = appointmentStatus.reduce((sum, item) => sum + item.count, 0);
  const totalLabs = labStatus.reduce((sum, item) => sum + item.count, 0);

  const refreshAll = () => {
    void Promise.all([apptQuery.refetch(), revenueQuery.refetch(), labQuery.refetch(), rxQuery.refetch()]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-heading">Analytics</h1>
          <p className="page-description">Live operational, clinical, and financial performance.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select aria-label="Appointment analytics period" value={period} onChange={(event) => setPeriod(event.target.value as Period)} className="w-[150px]">
            <option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option>
          </Select>
          <Button type="button" variant="outline" onClick={refreshAll} disabled={apptQuery.isFetching || revenueQuery.isFetching || labQuery.isFetching || rxQuery.isFetching}>
            <FontAwesomeIcon icon={faRotate} className={(apptQuery.isFetching || revenueQuery.isFetching || labQuery.isFetching || rxQuery.isFetching) ? 'animate-spin' : ''} />Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={faCalendarCheck} label="Appointments" value={apptQuery.isLoading ? '—' : totalAppointments.toLocaleString()} detail={`Grouped ${period === 'day' ? 'daily' : period === 'week' ? 'weekly' : 'monthly'}`} tone="bg-sky-500/10 text-sky-600 dark:text-sky-300" />
        <MetricCard icon={faFileInvoiceDollar} label="Outstanding" value={revenueQuery.isLoading ? '—' : money.format(revenueQuery.data?.data.outstanding ?? 0)} detail="Issued and partially paid invoices" tone="bg-orange-500/10 text-orange-600 dark:text-orange-300" />
        <MetricCard icon={faFlaskVial} label="Lab orders" value={labQuery.isLoading ? '—' : totalLabs.toLocaleString()} detail="Across all current statuses" tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" />
        <MetricCard icon={faCapsules} label="Prescription fill rate" value={rxQuery.isLoading ? '—' : `${(fillRate * 100).toFixed(1)}%`} detail="Dispensed among active prescriptions" tone="bg-violet-500/10 text-violet-600 dark:text-violet-300" />
      </div>

      <section className="space-y-4">
        <div><h2 className="section-title">Appointments</h2><p className="text-xs text-muted-foreground">Volume, status distribution, and clinician activity.</p></div>
        {apptQuery.isLoading && <SectionSkeleton />}
        {apptQuery.isError && <SectionError message="Appointment analytics could not be loaded." onRetry={() => void apptQuery.refetch()} />}
        {!apptQuery.isLoading && !apptQuery.isError && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader><CardTitle>Appointment volume</CardTitle></CardHeader>
              <CardContent>
                {appointmentVolume.length === 0 ? <EmptyChart /> : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={appointmentVolume} margin={{ left: -12, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--muted) / 0.5)' }} />
                      <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} maxBarSize={42} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Appointment status</CardTitle></CardHeader>
              <CardContent>
                {appointmentStatus.length === 0 ? <EmptyChart /> : (
                  <>
                    <ResponsiveContainer width="100%" height={205}>
                      <PieChart><Pie data={appointmentStatus} dataKey="count" nameKey="_id" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>{appointmentStatus.map((entry, index) => <Cell key={entry._id} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart>
                    </ResponsiveContainer>
                    <div className="grid grid-cols-2 gap-2">{appointmentStatus.map((item, index) => <div key={item._id} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-2 capitalize text-muted-foreground"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{item._id}</span><strong>{item.count}</strong></div>)}</div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="xl:col-span-3">
              <CardHeader><CardTitle>Top doctors by appointments</CardTitle></CardHeader>
              <CardContent>
                {doctors.length === 0 ? <EmptyChart message="No clinician appointment activity is available." /> : <div className="divide-y divide-border/60">{doctors.map((row, index) => <div key={`${row._id}-${index}`} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-xs font-extrabold text-primary">{index + 1}</span><span className="flex-1 text-sm font-semibold">{row.doctorName || row._id}</span><strong className="text-sm">{row.count}</strong></div>)}</div>}
              </CardContent>
            </Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div><h2 className="section-title">Financial performance</h2><p className="text-xs text-muted-foreground">Collected revenue and payment mix.</p></div>
        {revenueQuery.isLoading && <SectionSkeleton />}
        {revenueQuery.isError && <SectionError message="Revenue analytics could not be loaded." onRetry={() => void revenueQuery.refetch()} />}
        {!revenueQuery.isLoading && !revenueQuery.isError && (
          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2"><CardHeader><CardTitle>Revenue by month</CardTitle></CardHeader><CardContent>{revenueSeries.length === 0 ? <EmptyChart /> : <ResponsiveContainer width="100%" height={280}><LineChart data={revenueSeries} margin={{ left: 8, right: 12 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={72} tickFormatter={(value) => money.format(Number(value))} /><Tooltip formatter={(value: number) => money.format(value)} /><Line type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 3, fill: '#0ea5e9' }} activeDot={{ r: 5 }} /></LineChart></ResponsiveContainer>}</CardContent></Card>
            <Card><CardHeader><CardTitle>Payment methods</CardTitle></CardHeader><CardContent>{paymentMethods.length === 0 ? <EmptyChart /> : <div className="divide-y divide-border/60">{paymentMethods.map((row) => { const collected = row.amount ?? row.total ?? 0; return <div key={row._id} className="py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold capitalize">{row._id || 'Unspecified'}</span><strong className="text-sm">{money.format(collected)}</strong></div><p className="mt-1 text-[11px] text-muted-foreground">{row.count} payment{row.count === 1 ? '' : 's'}</p></div>; })}</div>}</CardContent></Card>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div><h2 className="section-title">Clinical operations</h2><p className="text-xs text-muted-foreground">Laboratory workload and prescription activity.</p></div>
        {(labQuery.isLoading || rxQuery.isLoading) && <SectionSkeleton />}
        {(labQuery.isError || rxQuery.isError) && <SectionError message="Some clinical analytics could not be loaded." onRetry={() => { void labQuery.refetch(); void rxQuery.refetch(); }} />}
        {!labQuery.isLoading && !rxQuery.isLoading && !labQuery.isError && !rxQuery.isError && (
          <div className="grid gap-4 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Lab volume</CardTitle></CardHeader><CardContent>{labVolume.length === 0 ? <EmptyChart /> : <ResponsiveContainer width="100%" height={260}><LineChart data={labVolume}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" /><XAxis dataKey="_id" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer>}<div className="mt-4 flex flex-wrap gap-2">{labPriority.map((row) => <span key={row._id} className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-bold capitalize text-emerald-700 dark:text-emerald-300">{row._id}: {row.count}</span>)}</div></CardContent></Card>
            <Card><CardHeader><CardTitle>Top prescribed drugs</CardTitle></CardHeader><CardContent>{topDrugs.length === 0 ? <EmptyChart /> : <div className="divide-y divide-border/60">{topDrugs.map((row, index) => <div key={`${row._id}-${index}`} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/10 text-xs font-extrabold text-violet-600 dark:text-violet-300">{index + 1}</span><span className="flex-1 text-sm font-semibold">{row._id || 'Unnamed drug'}</span><strong>{row.count}</strong></div>)}</div>}<div className="mt-4 flex flex-wrap gap-2">{prescriptionStatus.map((row) => <span key={row._id} className="rounded-full bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold capitalize text-violet-700 dark:text-violet-300">{row._id}: {row.count}</span>)}</div></CardContent></Card>
          </div>
        )}
      </section>
    </div>
  );
}
