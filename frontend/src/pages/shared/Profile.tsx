import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCamera, faTrash } from '@fortawesome/free-solid-svg-icons';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { clearCredentials, updateCurrentUser, type AuthUser } from '@/store/authSlice';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { usePreferences } from '@/providers/PreferencesProvider';
import type { Language } from '@/lib/i18n';

interface ProfileForm {
  firstName: string;
  lastName: string;
  phone: string;
  preferredLanguage: Language;
  preferredTheme: 'light' | 'dark';
  avatar: string;
}

const EMPTY_FORM: ProfileForm = {
  firstName: '',
  lastName: '',
  phone: '',
  preferredLanguage: 'en',
  preferredTheme: 'light',
  avatar: '',
};

export function MyProfile() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const current = useAppSelector(state => state.auth.user);
  const { setLanguage, setTheme } = usePreferences();
  const [form, setForm] = useState<ProfileForm>(EMPTY_FORM);
  const profile = useQuery<{ user: AuthUser & { phone?: string; lastLogin?: string; createdAt?: string } }>({
    queryKey: ['auth', 'me'],
    queryFn: () => api.get('/auth/me').then(response => response.data.data),
  });

  useEffect(() => {
    const user = profile.data?.user;
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone ?? '',
      preferredLanguage: user.preferredLanguage ?? 'en',
      preferredTheme: user.preferredTheme ?? 'light',
      avatar: user.avatar ?? '',
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => api.patch('/auth/me', { ...form, phone: form.phone || undefined }).then(response => response.data.data.user as AuthUser),
    onSuccess: user => {
      dispatch(updateCurrentUser(user));
      if (user.preferredLanguage) setLanguage(user.preferredLanguage);
      if (user.preferredTheme) setTheme(user.preferredTheme);
      toast.success('Profile updated');
      void profile.refetch();
    },
    onError: error => toast.error(message(error)),
  });

  const logoutAll = useMutation({
    mutationFn: () => api.post('/auth/logout-all'),
    onSuccess: () => { disconnectSocket(); dispatch(clearCredentials()); navigate('/sign-in', { replace: true }); },
    onError: error => toast.error(message(error)),
  });

  function handleAvatar(file?: File) {
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast.error('Profile image must be PNG, JPEG, or WebP and no larger than 2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm(currentForm => ({ ...currentForm, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  if (profile.isLoading) return <p className="py-10 text-center text-muted-foreground">Loading profile…</p>;
  if (profile.isError) return <ErrorPanel text={message(profile.error)} retry={() => void profile.refetch()} />;

  const initials = `${form.firstName?.[0] ?? ''}${form.lastName?.[0] ?? ''}`.toUpperCase();

  return <div className="mx-auto max-w-3xl space-y-6">
    <div><h1 className="text-2xl font-bold">My Profile</h1><p className="text-muted-foreground">Manage your personal information, preferences, and active sessions.</p></div>
    <Card>
      <CardHeader><CardTitle>Profile photo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {form.avatar ? (
            <img src={form.avatar} alt="Profile" className="h-24 w-24 shrink-0 rounded-3xl border border-border/70 object-cover shadow-sm" />
          ) : (
            <div className="grid h-24 w-24 shrink-0 place-items-center rounded-3xl bg-primary/10 text-2xl font-extrabold text-primary">{initials || 'U'}</div>
          )}
          <div className="min-w-0 flex-1 space-y-3">
            <div><p className="text-sm font-semibold">Upload your profile image</p><p className="mt-1 text-xs leading-5 text-muted-foreground">PNG, JPEG, or WebP. Maximum size 2 MB. The saved image is used in the sidebar and top navigation.</p></div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-card px-4 text-xs font-bold transition hover:border-primary/35 hover:bg-primary/5 hover:text-primary">
                <FontAwesomeIcon icon={faCamera} />Choose image
                <input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => handleAvatar(event.target.files?.[0])} />
              </label>
              {form.avatar && <Button type="button" variant="outline" size="sm" onClick={() => setForm(currentForm => ({ ...currentForm, avatar: '' }))}><FontAwesomeIcon icon={faTrash} />Remove image</Button>}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Account information</CardTitle></CardHeader><CardContent><form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="First name"><Input required value={form.firstName} onChange={event => setForm({ ...form, firstName: event.target.value })} /></Field><Field label="Last name"><Input required value={form.lastName} onChange={event => setForm({ ...form, lastName: event.target.value })} /></Field></div>
      <Field label="Email"><Input disabled value={profile.data?.user.email ?? ''} /></Field>
      <Field label="Phone"><Input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Language"><Select value={form.preferredLanguage} onChange={event => setForm({ ...form, preferredLanguage: event.target.value as Language })}><option value="en">🇬🇧 English</option><option value="da">🇦🇫 دری</option><option value="ps">🇦🇫 پښتو</option></Select></Field><Field label="Theme"><Select value={form.preferredTheme} onChange={event => setForm({ ...form, preferredTheme: event.target.value as 'light' | 'dark' })}><option value="light">Light</option><option value="dark">Dark</option></Select></Field></div>
      <div className="rounded-xl bg-muted p-4 text-sm"><p><strong>Role:</strong> <span className="capitalize">{current?.role}</span></p><p><strong>Last login:</strong> {profile.data?.user.lastLogin ? new Date(profile.data.user.lastLogin).toLocaleString() : 'Not recorded'}</p></div>
      <Button disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save profile'}</Button>
    </form></CardContent></Card>
    <Card><CardHeader><CardTitle>Security</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" onClick={() => navigate('/change-password')}>Change password</Button><Button variant="destructive" disabled={logoutAll.isPending} onClick={() => logoutAll.mutate()}>Sign out all devices</Button></CardContent></Card>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function message(error: unknown) { return (error as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message ?? (error as { message?: string }).message ?? 'Operation failed'; }
function ErrorPanel({ text, retry }: { text: string; retry: () => void }) { return <Card role="alert" className="border-destructive/30"><CardContent className="space-y-3"><p className="font-medium text-destructive">Unable to load this page</p><p className="text-sm text-muted-foreground">{text}</p><Button variant="outline" onClick={retry}>Try again</Button></CardContent></Card>; }
