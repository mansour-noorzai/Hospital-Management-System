import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Doctor { _id: string; userId?: { firstName?: string; lastName?: string } }
interface Department { _id: string; name: string; description?: string; location?: string; bedCount: number; head?: Doctor | null }
const blank = { name: '', description: '', location: '', bedCount: '0', headDoctorId: '' };

export function AdminDepartments() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<Department | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(blank);
  const departments = useQuery<{ data: Department[] }>({ queryKey: ['departments'], queryFn: () => api.get('/departments').then(r => r.data) });
  const doctors = useQuery<{ data: Doctor[] }>({ queryKey: ['doctors', 'department-heads'], queryFn: () => api.get('/doctors?limit=100').then(r => r.data) });
  const save = useMutation({
    mutationFn: () => (editing ? api.patch(`/departments/${editing._id}`, payload()) : api.post('/departments', payload())),
    onSuccess: () => { toast.success(editing ? 'Department updated' : 'Department created'); setOpen(false); void client.invalidateQueries({ queryKey: ['departments'] }); },
    onError: error => toast.error(errorMessage(error)),
  });
  function payload() { return { name: form.name.trim(), description: form.description.trim() || undefined, location: form.location.trim() || undefined, bedCount: Number(form.bedCount) || 0, headDoctorId: form.headDoctorId || undefined }; }
  function create() { setEditing(null); setForm(blank); setOpen(true); }
  function edit(item: Department) { setEditing(item); setForm({ name: item.name, description: item.description ?? '', location: item.location ?? '', bedCount: String(item.bedCount ?? 0), headDoctorId: item.head?._id ?? '' }); setOpen(true); }

  return <div className="space-y-6"><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Departments</h1><p className="text-muted-foreground">Configure clinical and operational departments.</p></div><Button onClick={create}>Add department</Button></div>
    {departments.isError && <ErrorCard error={departments.error} retry={() => void departments.refetch()} />}
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{departments.data?.data.map(item => <Card key={item._id}><CardContent className="space-y-3 pt-6"><div className="flex items-start justify-between"><div><h2 className="font-semibold">{item.name}</h2><p className="text-sm text-muted-foreground">{item.location || 'No location configured'}</p></div><Button size="sm" variant="outline" onClick={() => edit(item)}>Edit</Button></div><p className="text-sm">{item.description || 'No description'}</p><div className="rounded-lg bg-muted p-3 text-sm"><p>Beds: {item.bedCount ?? 0}</p><p>Head: {item.head?.userId ? `${item.head.userId.firstName ?? ''} ${item.head.userId.lastName ?? ''}` : 'Not assigned'}</p></div></CardContent></Card>)}</div>
    {!departments.isLoading && !departments.data?.data.length && <Card><CardContent className="py-12 text-center text-muted-foreground">No departments configured.</CardContent></Card>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent onClose={() => setOpen(false)}><DialogHeader><DialogTitle>{editing ? 'Edit department' : 'Add department'}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); save.mutate(); }}><Field label="Name"><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></Field><Field label="Description"><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="Location"><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></Field><Field label="Bed count"><Input type="number" min="0" value={form.bedCount} onChange={e => setForm({ ...form, bedCount: e.target.value })} /></Field></div><Field label="Head doctor"><Select value={form.headDoctorId} onChange={e => setForm({ ...form, headDoctorId: e.target.value })}><option value="">Not assigned</option>{doctors.data?.data.map(doctor => <option key={doctor._id} value={doctor._id}>{doctor.userId?.firstName} {doctor.userId?.lastName}</option>)}</Select></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={save.isPending || !form.name.trim()}>Save</Button></DialogFooter></form></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div>; }
function errorMessage(error: unknown) { return (error as { response?: { data?: { error?: { message?: string } } }; message?: string })?.response?.data?.error?.message ?? (error as { message?: string }).message ?? 'Operation failed'; }
function ErrorCard({ error, retry }: { error: unknown; retry: () => void }) { return <Card role="alert"><CardContent className="space-y-2 pt-6"><p className="text-destructive">{errorMessage(error)}</p><Button size="sm" variant="outline" onClick={retry}>Try again</Button></CardContent></Card>; }
