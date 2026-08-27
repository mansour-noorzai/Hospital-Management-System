import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBuilding,
  faCheck,
  faClock,
  faFileInvoiceDollar,
  faFloppyDisk,
  faGlobe,
  faImage,
  faPalette,
  faRotate,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface HospitalSettingsResponse {
  _id: string;
  hospitalName?: string;
  name: string;
  systemName: string;
  shortName: string;
  address?: string;
  logoUrl?: string;
  faviconUrl?: string;
  defaultTaxRate: number;
  workingHours?: { start: string; end: string };
  timezone: string;
  phone?: string;
  email?: string;
  website?: string;
  registrationNumber?: string;
  emergencyContact?: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  dateFormat: string;
  defaultLanguage: 'en' | 'da' | 'ps';
  defaultTheme: 'light' | 'dark';
  invoiceFooter?: string;
  prescriptionFooter?: string;
}

interface HospitalSettingsForm {
  hospitalName: string;
  systemName: string;
  shortName: string;
  address: string;
  logoUrl: string;
  faviconUrl: string;
  defaultTaxRate: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
  phone: string;
  email: string;
  website: string;
  registrationNumber: string;
  emergencyContact: string;
  primaryColor: string;
  accentColor: string;
  currency: string;
  dateFormat: string;
  defaultLanguage: 'en' | 'da' | 'ps';
  defaultTheme: 'light' | 'dark';
  invoiceFooter: string;
  prescriptionFooter: string;
}

interface SettingsResponse { success: boolean; data: HospitalSettingsResponse }

const COLOR_PRESETS = [
  { name: 'Medical Blue', primary: '#0284c7', accent: '#0891b2' },
  { name: 'Teal', primary: '#0f766e', accent: '#0d9488' },
  { name: 'Indigo', primary: '#4f46e5', accent: '#6366f1' },
  { name: 'Emerald', primary: '#059669', accent: '#10b981' },
  { name: 'Slate', primary: '#475569', accent: '#64748b' },
  { name: 'Violet', primary: '#7c3aed', accent: '#8b5cf6' },
  { name: 'Rose', primary: '#e11d48', accent: '#f43f5e' },
  { name: 'Amber', primary: '#d97706', accent: '#f59e0b' },
] as const;

const EMPTY_FORM: HospitalSettingsForm = {
  hospitalName: '',
  systemName: '',
  shortName: '',
  address: '',
  logoUrl: '',
  faviconUrl: '',
  defaultTaxRate: 0,
  workingHoursStart: '08:00',
  workingHoursEnd: '17:00',
  timezone: 'Asia/Kabul',
  phone: '',
  email: '',
  website: '',
  registrationNumber: '',
  emergencyContact: '',
  primaryColor: '#0ea5e9',
  accentColor: '#14b8a6',
  currency: 'AFN',
  dateFormat: 'yyyy-MM-dd',
  defaultLanguage: 'en',
  defaultTheme: 'light',
  invoiceFooter: '',
  prescriptionFooter: '',
};

function toForm(data: HospitalSettingsResponse): HospitalSettingsForm {
  return {
    hospitalName: data.name ?? data.hospitalName ?? '',
    systemName: data.systemName ?? '',
    shortName: data.shortName ?? '',
    address: data.address ?? '',
    logoUrl: data.logoUrl ?? '',
    faviconUrl: data.faviconUrl ?? '',
    defaultTaxRate: data.defaultTaxRate ?? 0,
    workingHoursStart: data.workingHours?.start ?? '08:00',
    workingHoursEnd: data.workingHours?.end ?? '17:00',
    timezone: data.timezone ?? 'Asia/Kabul',
    phone: data.phone ?? '',
    email: data.email ?? '',
    website: data.website ?? '',
    registrationNumber: data.registrationNumber ?? '',
    emergencyContact: data.emergencyContact ?? '',
    primaryColor: data.primaryColor ?? '#0ea5e9',
    accentColor: data.accentColor ?? '#14b8a6',
    currency: data.currency ?? 'AFN',
    dateFormat: data.dateFormat ?? 'yyyy-MM-dd',
    defaultLanguage: data.defaultLanguage ?? 'en',
    defaultTheme: data.defaultTheme ?? 'light',
    invoiceFooter: data.invoiceFooter ?? '',
    prescriptionFooter: data.prescriptionFooter ?? '',
  };
}

function getApiError(error: unknown) {
  return (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Settings could not be saved.';
}

function SectionHeading({ icon, title, description }: { icon: typeof faBuilding; title: string; description: string }) {
  return (
    <CardHeader className="border-b border-border/60 pb-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-primary/10 text-sm text-primary"><FontAwesomeIcon icon={icon} /></span>
        <div><CardTitle>{title}</CardTitle><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p></div>
      </div>
    </CardHeader>
  );
}

function BrandImageField({ id, label, value, onUrlChange, onFile }: { id: string; label: string; value: string; onUrlChange: (value: string) => void; onFile: (file?: File) => void }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Input id={id} type="url" value={value.startsWith('data:') ? '' : value} onChange={(event) => onUrlChange(event.target.value)} placeholder="https://example.com/brand.png" />
        <label className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-xs font-bold transition hover:border-primary/35 hover:bg-primary/5 hover:text-primary">
          <FontAwesomeIcon icon={faImage} />Upload image
          <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/x-icon" onChange={(event) => onFile(event.target.files?.[0])} />
        </label>
      </div>
      {value && <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3"><img src={value} alt={`${label} preview`} className="h-14 w-14 rounded-xl border border-border/60 bg-white object-contain p-1.5" /><div><p className="text-xs font-bold">Preview</p><p className="text-[11px] text-muted-foreground">PNG, JPEG, WebP, or ICO · maximum 2 MB</p></div></div>}
    </div>
  );
}


function PalettePicker({ primaryColor, accentColor, onChange }: { primaryColor: string; accentColor: string; onChange: (primary: string, accent: string) => void }) {
  return (
    <div className="space-y-3">
      <div><Label>System color</Label><p className="mt-1 text-[11px] leading-5 text-muted-foreground">Choose one professional color preset. The system automatically applies the matching accent color.</p></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {COLOR_PRESETS.map((preset) => {
          const selected = primaryColor.toLowerCase() === preset.primary.toLowerCase() && accentColor.toLowerCase() === preset.accent.toLowerCase();
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => onChange(preset.primary, preset.accent)}
              className={`flex min-h-12 items-center gap-3 rounded-xl border px-3 py-2.5 text-start text-xs font-bold transition ${selected ? 'border-primary bg-primary/10 ring-2 ring-primary/15' : 'border-border/80 bg-card hover:border-primary/35 hover:bg-muted/50'}`}
              aria-pressed={selected}
            >
              <span className="relative h-7 w-7 shrink-0 rounded-full border border-black/10 shadow-sm" style={{ backgroundColor: preset.primary }}>
                <span className="absolute bottom-0 end-0 h-3 w-3 rounded-full border-2 border-card" style={{ backgroundColor: preset.accent }} />
              </span>
              <span className="min-w-0 flex-1 truncate">{preset.name}</span>
              {selected && <FontAwesomeIcon icon={faCheck} className="text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<HospitalSettingsForm>(EMPTY_FORM);
  const [isDirty, setIsDirty] = useState(false);

  const settingsQuery = useQuery<SettingsResponse>({
    queryKey: ['hospital'],
    queryFn: () => api.get('/hospital').then((response) => response.data),
  });

  useEffect(() => {
    if (!settingsQuery.data?.data) return;
    setForm(toForm(settingsQuery.data.data));
    setIsDirty(false);
  }, [settingsQuery.data]);

  const saveMutation = useMutation<SettingsResponse, unknown, HospitalSettingsForm>({
    mutationFn: (payload) => api.patch('/hospital', {
      name: payload.hospitalName.trim(),
      systemName: payload.systemName.trim(),
      shortName: payload.shortName.trim(),
      address: payload.address.trim(),
      ...(payload.logoUrl.trim() ? { logoUrl: payload.logoUrl.trim() } : {}),
      ...(payload.faviconUrl.trim() ? { faviconUrl: payload.faviconUrl.trim() } : {}),
      timezone: payload.timezone.trim(),
      phone: payload.phone.trim(),
      ...(payload.email.trim() ? { email: payload.email.trim() } : {}),
      ...(payload.website.trim() ? { website: payload.website.trim() } : {}),
      registrationNumber: payload.registrationNumber.trim(),
      emergencyContact: payload.emergencyContact.trim(),
      primaryColor: payload.primaryColor,
      accentColor: payload.accentColor,
      currency: payload.currency.trim().toUpperCase(),
      dateFormat: payload.dateFormat,
      defaultLanguage: payload.defaultLanguage,
      defaultTheme: payload.defaultTheme,
      invoiceFooter: payload.invoiceFooter,
      prescriptionFooter: payload.prescriptionFooter,
      defaultTaxRate: payload.defaultTaxRate,
      workingHours: { start: payload.workingHoursStart, end: payload.workingHoursEnd },
    }).then((response) => response.data),
    onSuccess: (response) => {
      queryClient.setQueryData(['hospital'], response);
      queryClient.setQueriesData({ queryKey: ['hospital', 'branding'] }, response.data);
      void queryClient.invalidateQueries({ queryKey: ['hospital'] });
      setForm(toForm(response.data));
      setIsDirty(false);
      toast.success('Settings saved and applied');
    },
    onError: (error) => toast.error(getApiError(error)),
  });

  function handleChange<K extends keyof HospitalSettingsForm>(field: K, value: HospitalSettingsForm[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
  }

  function handleBrandImage(field: 'logoUrl' | 'faviconUrl', file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/x-icon'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error('Image must be PNG, JPEG, WebP, or ICO and no larger than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => handleChange(field, String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.hospitalName.trim() || !form.systemName.trim() || !form.shortName.trim()) {
      toast.error('Hospital name, system name, and short name are required.');
      return;
    }
    if (form.workingHoursEnd <= form.workingHoursStart) {
      toast.error('Working hours end must be later than the start time.');
      return;
    }
    saveMutation.mutate(form);
  }

  if (settingsQuery.isLoading) {
    return <div className="space-y-4 animate-pulse"><div className="h-9 w-56 rounded-xl bg-muted" /><div className="h-[620px] rounded-[24px] bg-muted" /></div>;
  }

  if (settingsQuery.isError) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-[24px] border border-destructive/20 bg-card p-8 text-center shadow-[var(--card-shadow)]">
        <div><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10 text-destructive"><FontAwesomeIcon icon={faTriangleExclamation} /></span><h1 className="mt-4 text-lg font-bold">Settings could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">Check the connection and try again.</p><Button className="mt-5" variant="outline" onClick={() => void settingsQuery.refetch()}><FontAwesomeIcon icon={faRotate} />Retry</Button></div>
      </div>
    );
  }

  const navigation = [
    { id: 'identity', label: 'Hospital identity', icon: faBuilding },
    { id: 'branding', label: 'Branding', icon: faPalette },
    { id: 'contact', label: 'Contact details', icon: faGlobe },
    { id: 'regional', label: 'Regional defaults', icon: faGlobe },
    { id: 'operations', label: 'Operations', icon: faClock },
    { id: 'billing-print', label: 'Billing & print', icon: faFileInvoiceDollar },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="page-heading">Settings</h1><p className="page-description">Manage hospital identity, branding, regional defaults, and operations.</p></div>
        <div className="flex items-center gap-3">
          <span className={`hidden items-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold sm:flex ${isDirty ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}><FontAwesomeIcon icon={isDirty ? faTriangleExclamation : faCheck} />{isDirty ? 'Unsaved changes' : 'All changes saved'}</span>
          <Button type="submit" disabled={saveMutation.isPending || !isDirty}><FontAwesomeIcon icon={faFloppyDisk} />{saveMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[230px_minmax(0,1fr)]">
        <Card className="sticky top-24 hidden xl:block"><CardContent className="p-3"><nav aria-label="Settings sections" className="space-y-1">{navigation.map((item) => <a key={item.id} href={`#${item.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-primary/5 hover:text-primary"><span className="grid h-8 w-8 place-items-center rounded-[11px] bg-muted text-[11px]"><FontAwesomeIcon icon={item.icon} /></span>{item.label}</a>)}</nav></CardContent></Card>

        <div className="space-y-5">
          <Card id="identity" className="scroll-mt-24"><SectionHeading icon={faBuilding} title="Hospital identity" description="Names used throughout navigation, page titles, and official records." /><CardContent className="grid gap-5 pt-6 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label htmlFor="hospitalName">Legal hospital name</Label><Input id="hospitalName" value={form.hospitalName} onChange={(event) => handleChange('hospitalName', event.target.value)} placeholder="City General Hospital" required /></div><div className="space-y-2"><Label htmlFor="systemName">System display name</Label><Input id="systemName" value={form.systemName} onChange={(event) => handleChange('systemName', event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="shortName">Short name</Label><Input id="shortName" maxLength={30} value={form.shortName} onChange={(event) => handleChange('shortName', event.target.value)} required /></div><div className="space-y-2"><Label htmlFor="registrationNumber">Registration / license number</Label><Input id="registrationNumber" value={form.registrationNumber} onChange={(event) => handleChange('registrationNumber', event.target.value)} /></div></CardContent></Card>

          <Card id="branding" className="scroll-mt-24"><SectionHeading icon={faPalette} title="Branding" description="Logo, favicon, and a professional system color update across the interface after saving." /><CardContent className="space-y-6 pt-6"><BrandImageField id="logoUrl" label="Hospital logo" value={form.logoUrl} onUrlChange={(value) => handleChange('logoUrl', value)} onFile={(file) => handleBrandImage('logoUrl', file)} /><BrandImageField id="faviconUrl" label="Browser favicon" value={form.faviconUrl} onUrlChange={(value) => handleChange('faviconUrl', value)} onFile={(file) => handleBrandImage('faviconUrl', file)} /><PalettePicker primaryColor={form.primaryColor} accentColor={form.accentColor} onChange={(primary, accent) => { setForm((current) => ({ ...current, primaryColor: primary, accentColor: accent })); setIsDirty(true); }} /></CardContent></Card>

          <Card id="contact" className="scroll-mt-24"><SectionHeading icon={faGlobe} title="Contact details" description="Official information used in hospital communications and records." /><CardContent className="grid gap-5 pt-6 md:grid-cols-2"><div className="space-y-2 md:col-span-2"><Label htmlFor="address">Address</Label><Input id="address" value={form.address} onChange={(event) => handleChange('address', event.target.value)} placeholder="Street, district, city" /></div><div className="space-y-2"><Label htmlFor="phone">Phone</Label><Input id="phone" type="tel" value={form.phone} onChange={(event) => handleChange('phone', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="emergencyContact">Emergency contact</Label><Input id="emergencyContact" type="tel" value={form.emergencyContact} onChange={(event) => handleChange('emergencyContact', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(event) => handleChange('email', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="website">Website</Label><Input id="website" type="url" value={form.website} onChange={(event) => handleChange('website', event.target.value)} placeholder="https://hospital.example" /></div></CardContent></Card>

          <Card id="regional" className="scroll-mt-24"><SectionHeading icon={faGlobe} title="Regional defaults" description="Set default language, appearance, currency, dates, and time zone." /><CardContent className="grid gap-5 pt-6 md:grid-cols-2"><div className="space-y-2"><Label htmlFor="defaultLanguage">Default language</Label><Select id="defaultLanguage" value={form.defaultLanguage} onChange={(event) => handleChange('defaultLanguage', event.target.value as HospitalSettingsForm['defaultLanguage'])}><option value="en">🇬🇧 English</option><option value="da">🇦🇫 دری</option><option value="ps">🇦🇫 پښتو</option></Select></div><div className="space-y-2"><Label htmlFor="defaultTheme">Default theme</Label><Select id="defaultTheme" value={form.defaultTheme} onChange={(event) => handleChange('defaultTheme', event.target.value as HospitalSettingsForm['defaultTheme'])}><option value="light">Light</option><option value="dark">Dark</option></Select></div><div className="space-y-2"><Label htmlFor="currency">Currency</Label><Input id="currency" maxLength={3} value={form.currency} onChange={(event) => handleChange('currency', event.target.value.toUpperCase())} placeholder="AFN" /></div><div className="space-y-2"><Label htmlFor="dateFormat">Date format</Label><Select id="dateFormat" value={form.dateFormat} onChange={(event) => handleChange('dateFormat', event.target.value)}><option value="yyyy-MM-dd">YYYY-MM-DD</option><option value="dd/MM/yyyy">DD/MM/YYYY</option><option value="MM/dd/yyyy">MM/DD/YYYY</option></Select></div><div className="space-y-2 md:col-span-2"><Label htmlFor="timezone">Time zone</Label><Input id="timezone" list="timezone-options" value={form.timezone} onChange={(event) => handleChange('timezone', event.target.value)} placeholder="Asia/Kabul" /><datalist id="timezone-options"><option value="Asia/Kabul" /><option value="UTC" /><option value="Asia/Dubai" /><option value="Asia/Karachi" /><option value="Europe/Berlin" /><option value="America/New_York" /></datalist><p className="text-[11px] text-muted-foreground">Use a valid IANA time-zone name such as Asia/Kabul.</p></div></CardContent></Card>

          <Card id="operations" className="scroll-mt-24"><SectionHeading icon={faClock} title="Operations" description="Configure standard working hours for scheduling and daily workflows." /><CardContent className="grid gap-5 pt-6 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="workingHoursStart">Working day starts</Label><Input id="workingHoursStart" type="time" value={form.workingHoursStart} onChange={(event) => handleChange('workingHoursStart', event.target.value)} /></div><div className="space-y-2"><Label htmlFor="workingHoursEnd">Working day ends</Label><Input id="workingHoursEnd" type="time" value={form.workingHoursEnd} onChange={(event) => handleChange('workingHoursEnd', event.target.value)} /></div></CardContent></Card>

          <Card id="billing-print" className="scroll-mt-24"><SectionHeading icon={faFileInvoiceDollar} title="Billing & print defaults" description="Control the default tax rate and footer text on generated documents." /><CardContent className="grid gap-5 pt-6"><div className="space-y-2 sm:max-w-xs"><Label htmlFor="defaultTaxRate">Default tax rate (%)</Label><Input id="defaultTaxRate" type="number" min={0} max={100} step={0.01} value={form.defaultTaxRate} onChange={(event) => handleChange('defaultTaxRate', Number(event.target.value) || 0)} /></div><div className="space-y-2"><Label htmlFor="invoiceFooter">Invoice footer</Label><Textarea id="invoiceFooter" value={form.invoiceFooter} onChange={(event) => handleChange('invoiceFooter', event.target.value)} maxLength={1000} placeholder="Payment terms or contact information" /></div><div className="space-y-2"><Label htmlFor="prescriptionFooter">Prescription footer</Label><Textarea id="prescriptionFooter" value={form.prescriptionFooter} onChange={(event) => handleChange('prescriptionFooter', event.target.value)} maxLength={1000} placeholder="Clinical notice or contact information" /></div></CardContent></Card>

          <div className="sticky bottom-3 z-20 flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/95 p-3 shadow-xl backdrop-blur-xl"><p className="hidden text-xs font-medium text-muted-foreground sm:block">{isDirty ? 'Review and save your changes.' : 'Settings are synchronized.'}</p><Button type="submit" className="ms-auto" disabled={saveMutation.isPending || !isDirty}><FontAwesomeIcon icon={faFloppyDisk} />{saveMutation.isPending ? 'Saving…' : 'Save changes'}</Button></div>
        </div>
      </div>
    </form>
  );
}
