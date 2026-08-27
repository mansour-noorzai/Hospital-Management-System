import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

interface Actor { firstName?: string; lastName?: string; email?: string; role?: string }
interface AuditEntry { _id: string; actorId?: Actor; actorRole: string; action: string; resourceType: string; resourceId: string; timestamp: string; ip?: string }
interface Response { data: AuditEntry[]; meta: { page: number; total: number; totalPages: number } }

export function AdminAuditLogs() {
  const [page, setPage] = useState(1); const [action, setAction] = useState(''); const [resourceType, setResourceType] = useState('');
  const params = useMemo(() => new URLSearchParams({ page: String(page), limit: '25', ...(action ? { action } : {}), ...(resourceType ? { resourceType } : {}) }).toString(), [action, page, resourceType]);
  const logs = useQuery<Response>({ queryKey: ['audit-logs', page, action, resourceType], queryFn: () => api.get(`/audit-logs?${params}`).then(r => r.data) });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Audit Logs</h1><p className="text-muted-foreground">Append-only record of sensitive administrative and clinical workflow changes.</p></div><Card><CardContent className="pt-6"><div className="mb-5 grid gap-3 sm:grid-cols-2"><Input placeholder="Filter by action" value={action} onChange={e => { setAction(e.target.value); setPage(1); }} /><Select value={resourceType} onChange={e => { setResourceType(e.target.value); setPage(1); }}><option value="">All resources</option>{['User','Hospital','Patient','Appointment','Invoice','LabOrder','LabResult','Prescription','InventoryItem','Document'].map(item => <option key={item} value={item}>{item}</option>)}</Select></div>
    <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead><tr className="border-b text-muted-foreground">{['Time','Actor','Action','Resource','Record','IP'].map(item => <th key={item} className="p-3 text-start font-medium">{item}</th>)}</tr></thead><tbody>{logs.data?.data.map(entry => <tr key={entry._id} className="border-b last:border-0"><td className="whitespace-nowrap p-3">{new Date(entry.timestamp).toLocaleString()}</td><td className="p-3"><p>{entry.actorId ? `${entry.actorId.firstName ?? ''} ${entry.actorId.lastName ?? ''}` : 'System/removed user'}</p><p className="text-xs text-muted-foreground">{entry.actorId?.email ?? entry.actorRole}</p></td><td className="p-3 font-medium">{entry.action}</td><td className="p-3">{entry.resourceType}</td><td className="max-w-[180px] truncate p-3 font-mono text-xs">{entry.resourceId}</td><td className="p-3 text-xs">{entry.ip ?? '—'}</td></tr>)}</tbody></table></div>
    {logs.isLoading && <p className="py-10 text-center text-muted-foreground">Loading audit records…</p>}{logs.isError && <div role="alert" className="py-8 text-center"><p className="text-destructive">Unable to load audit logs.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => void logs.refetch()}>Try again</Button></div>}{!logs.isLoading && !logs.isError && !logs.data?.data.length && <p className="py-10 text-center text-muted-foreground">No audit records match this filter.</p>}
    <div className="mt-4 flex items-center justify-between"><span className="text-sm text-muted-foreground">{logs.data?.meta.total ?? 0} records</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page >= (logs.data?.meta.totalPages ?? 1)} onClick={() => setPage(value => value + 1)}>Next</Button></div></div>
    </CardContent></Card></div>;
}
