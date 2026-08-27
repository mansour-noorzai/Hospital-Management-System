import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useAppDispatch } from '@/store/hooks';
import { clearCredentials } from '@/store/authSlice';
import { disconnectSocket } from '@/lib/socket';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [saving, setSaving] = useState(false);
  const dispatch = useAppDispatch(); const navigate = useNavigate();
  async function submit(event: React.FormEvent) { event.preventDefault(); if (newPassword !== confirm) { toast.error('Passwords do not match'); return; } setSaving(true); try { await api.post('/auth/change-password', { currentPassword, newPassword }); disconnectSocket(); dispatch(clearCredentials()); toast.success('Password changed. Sign in again.'); navigate('/sign-in', { replace: true }); } catch (error) { toast.error((error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Password change failed'); } finally { setSaving(false); } }
  return <div className="grid min-h-dvh place-items-center bg-background p-4"><Card className="w-full max-w-md"><CardHeader><CardTitle>Change your temporary password</CardTitle><p className="text-sm text-muted-foreground">You must choose a new password before using the system.</p></CardHeader><CardContent><form onSubmit={submit} className="space-y-4"><Field label="Current password"><Input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required /></Field><Field label="New password"><Input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} /></Field><Field label="Confirm new password"><Input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} required /></Field><Button className="w-full" disabled={saving}>{saving ? 'Changing…' : 'Change password'}</Button></form></CardContent></Card></div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }

