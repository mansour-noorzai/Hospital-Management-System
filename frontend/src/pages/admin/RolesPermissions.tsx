import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/Shared/StatusBadge';

type Role = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'patient';
type Permission = 'all' | 'own-read' | 'own-rw' | false | string[];
type Matrix = Record<string, Record<Role, Permission>>;
const roles: Role[] = ['admin', 'doctor', 'nurse', 'receptionist', 'patient'];

export function AdminRolesPermissions() {
  const matrix = useQuery<{ data: Matrix }>({ queryKey: ['permissions', 'matrix'], queryFn: () => api.get('/users/permissions/matrix').then(r => r.data) });
  return <div className="space-y-6"><div><h1 className="text-2xl font-bold">Roles & Permissions</h1><p className="text-muted-foreground">Review the hospital’s server-enforced default permission matrix. User-specific overrides are managed from User Management.</p></div>
    <Card><CardHeader><CardTitle>Default role permissions</CardTitle></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead><tr className="border-b"><th className="p-3 text-start">Resource</th>{roles.map(role => <th key={role} className="p-3 text-start capitalize">{role}</th>)}</tr></thead><tbody>{matrix.data && Object.entries(matrix.data.data).map(([resource, values]) => <tr key={resource} className="border-b last:border-0"><td className="p-3 font-medium capitalize">{resource}</td>{roles.map(role => <td key={role} className="p-3"><PermissionCell value={values[role]} /></td>)}</tr>)}</tbody></table></div>{matrix.isLoading && <p className="py-10 text-center text-muted-foreground">Loading permission matrix…</p>}{matrix.isError && <p role="alert" className="py-6 text-destructive">Unable to load the server permission matrix.</p>}</CardContent></Card>
    <Card><CardContent className="pt-6 text-sm text-muted-foreground"><p><strong className="text-foreground">All</strong> permits every supported action. <strong className="text-foreground">Own read/write</strong> requires ownership enforcement in the service. Explicit user denial overrides a role permission.</p></CardContent></Card>
  </div>;
}

function PermissionCell({ value }: { value: Permission }) {
  if (value === false) return <StatusBadge status="inactive" label="No access" />;
  if (value === 'all') return <StatusBadge status="active" label="All" />;
  if (value === 'own-read') return <StatusBadge status="pending" label="Own read" />;
  if (value === 'own-rw') return <StatusBadge status="issued" label="Own read/write" />;
  return <div className="flex flex-wrap gap-1">{value.map(action => <span key={action} className="rounded-md bg-muted px-2 py-1 text-xs">{action}</span>)}</div>;
}
