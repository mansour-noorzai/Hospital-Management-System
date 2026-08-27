import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { DataTable, ColumnDef } from '@/components/Shared/DataTable';
import { StatusBadge } from '@/components/Shared/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import { PrintReportButton, type PrintableReport } from '@/components/Shared/PrintReportButton';

interface StaffUser {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  phone?: string;
}

interface DoctorProfile {
  _id: string;
  doctorId?: string;
  nurseId?: string;
  receptionistId?: string;
  specialization?: string;
  department?: { _id: string; name: string } | null;
  userId: StaffUser;
  isActive: boolean;
  qualification?: string[];
  licenseNumber?: string;
  consultationFee?: number;
  ward?: string;
  shift?: string;
  createdAt?: string;
}

interface StaffEntry {
  role: string;
  profile: DoctorProfile;
}

interface StaffResponse {
  success: boolean;
  data: DoctorProfile[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface DepartmentRecord {
  _id: string;
  name: string;
}

interface CreateStaffForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'doctor' | 'nurse' | 'receptionist';
  specialization: string;
  departmentId: string;
  qualification: string;
  shift: 'morning' | 'afternoon' | 'night';
}

const columns: ColumnDef<StaffEntry>[] = [
  {
    header: 'Staff ID',
    accessorKey: 'profile',
    cell: (row) =>
      row.profile.doctorId ?? row.profile.nurseId ?? row.profile.receptionistId ?? '—',
  },
  {
    header: 'Name',
    accessorKey: 'profile.userId',
    cell: (row) =>
      `${row.profile.userId?.firstName ?? ''} ${row.profile.userId?.lastName ?? ''}`,
  },
  {
    header: 'Role',
    accessorKey: 'role',
    cell: (row) => (
      <span className="capitalize">{row.role}</span>
    ),
  },
  {
    header: 'Specialization',
    accessorKey: 'profile.specialization',
    cell: (row) => row.profile.specialization ?? '—',
  },
  {
    header: 'Department',
    accessorKey: 'profile.department',
    cell: (row) => row.profile.department?.name ?? '—',
  },
  {
    header: 'Email',
    accessorKey: 'profile.userId.email',
    cell: (row) => row.profile.userId?.email ?? '—',
  },
  {
    header: 'Status',
    accessorKey: 'profile.isActive',
    cell: (row) => (
      <StatusBadge status={row.profile.isActive ? 'active' : 'inactive'} />
    ),
  },
  { header: 'Actions', accessorKey: 'profile', cell: (row) => <PrintReportButton report={staffReport(row)} /> },
];

const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':\"\\|,.<>/?]).{8,100}$/;

const defaultForm: CreateStaffForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'doctor',
  specialization: '',
  departmentId: '',
  qualification: '',
  shift: 'morning',
};

function staffReport(entry: StaffEntry): PrintableReport {
  const profile = entry.profile;
  const staffId = profile.doctorId ?? profile.nurseId ?? profile.receptionistId ?? profile._id;
  return { title: 'Staff Record', subtitle: `${profile.userId?.firstName ?? ''} ${profile.userId?.lastName ?? ''}`.trim(), reference: staffId, fields: [
    { label: 'Staff ID', value: staffId }, { label: 'Name', value: `${profile.userId?.firstName ?? ''} ${profile.userId?.lastName ?? ''}`.trim() },
    { label: 'Email', value: profile.userId?.email }, { label: 'Phone', value: profile.userId?.phone }, { label: 'Role', value: entry.role },
    { label: 'Department', value: profile.department?.name }, { label: 'Specialization', value: profile.specialization },
    { label: 'Qualifications', value: profile.qualification?.join(', ') }, { label: 'License number', value: profile.licenseNumber },
    { label: 'Consultation fee', value: profile.consultationFee }, { label: 'Ward', value: profile.ward }, { label: 'Shift', value: profile.shift },
    { label: 'Status', value: profile.isActive ? 'Active' : 'Inactive' }, { label: 'Created', value: profile.createdAt ? new Date(profile.createdAt).toLocaleString() : '—' },
  ] };
}

function staffListReport(staff: StaffEntry[]): PrintableReport {
  return { title: 'All Hospital Staff', fields: [{ label: 'Total staff', value: staff.length }], tables: [{ columns: ['Staff ID', 'Name', 'Role', 'Department', 'Specialization / Ward', 'Shift', 'Email', 'Status'], rows: staff.map((entry) => [entry.profile.doctorId ?? entry.profile.nurseId ?? entry.profile.receptionistId, `${entry.profile.userId?.firstName ?? ''} ${entry.profile.userId?.lastName ?? ''}`.trim(), entry.role, entry.profile.department?.name, entry.profile.specialization ?? entry.profile.ward, entry.profile.shift, entry.profile.userId?.email, entry.profile.isActive ? 'Active' : 'Inactive']) }] };
}

export function AdminStaff() {
  const [modalOpen, setModalOpen] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [form, setForm] = useState<CreateStaffForm>(defaultForm);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StaffResponse>({
    queryKey: ['staff', page],
    queryFn: async () => {
      const res = await api.get(`/staff?page=${page}&limit=20`);
      return res.data;
    },
  });

  const { data: allStaffData } = useQuery<StaffResponse>({
    queryKey: ['staff', 'print-all'],
    queryFn: async () => (await api.get('/staff?page=1&limit=100')).data,
  });

  const { data: deptData } = useQuery<{ success: boolean; data: DepartmentRecord[] }>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get('/departments');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload: {
      firstName: string;
      lastName: string;
      email: string;
      role: CreateStaffForm['role'];
      temporaryPassword: string;
      qualification: string[];
      specialization?: string;
      departmentId?: string;
      shift?: CreateStaffForm['shift'];
    }) => {
      const res = await api.post('/users', payload);
      return res.data.data as { temporaryPassword: string };
    },
    onSuccess: (result) => {
      toast.success('Staff member created successfully');
      setModalOpen(false);
      setGeneratedPassword(result.temporaryPassword);
      setForm(defaultForm);
      void queryClient.invalidateQueries({ queryKey: ['staff'] });
      void queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to create staff member';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!STRONG_PASSWORD.test(form.password)) {
      toast.error('Password must include uppercase, lowercase, number, and special character');
      return;
    }
    createMutation.mutate({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      role: form.role,
      temporaryPassword: form.password,
      ...(form.departmentId ? { departmentId: form.departmentId } : {}),
      ...(form.role === 'doctor' ? { specialization: form.specialization.trim() } : {}),
      ...(form.role === 'nurse' ? { shift: form.shift } : {}),
      qualification: form.qualification
        ? form.qualification.split(',').map((q) => q.trim()).filter(Boolean)
        : [],
    });
  };

  const staff: StaffEntry[] = (data?.data ?? []).map(profile => ({ role: profile.userId?.role ?? 'staff', profile }));
  const allStaff: StaffEntry[] = (allStaffData?.data ?? data?.data ?? []).map(profile => ({ role: profile.userId?.role ?? 'staff', profile }));
  const meta = data?.meta;
  const departments = deptData?.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Staff</h1>
          <p className="text-muted-foreground">Manage hospital staff members</p>
        </div>
        <div className="flex flex-wrap gap-2"><PrintReportButton report={staffListReport(allStaff)} label="Print all / Save PDF" /><Button onClick={() => setModalOpen(true)}>Add Staff</Button></div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Staff List</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={staff}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No staff members found"
          />

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Page {meta.page} of {meta.totalPages} — {meta.total} total staff
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= (meta.totalPages ?? 1)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent onClose={() => setModalOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as CreateStaffForm['role'] })
                }
                required
              >
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="receptionist">Receptionist</option>
              </Select>
            </div>

            {form.role === 'doctor' && (
              <div className="space-y-1">
                <Label htmlFor="specialization">Specialization</Label>
                <Input
                  id="specialization"
                  value={form.specialization}
                  onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                  required={form.role === 'doctor'}
                />
              </div>
            )}

            {form.role === 'nurse' && (
              <div className="space-y-1">
                <Label htmlFor="shift">Shift</Label>
                <Select
                  id="shift"
                  value={form.shift}
                  onChange={(e) =>
                    setForm({ ...form, shift: e.target.value as CreateStaffForm['shift'] })
                  }
                >
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                  <option value="night">Night</option>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="departmentId">Department</Label>
              <Select
                id="departmentId"
                value={form.departmentId}
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
                placeholder="Select department (optional)"
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="qualification">Qualifications (comma-separated)</Label>
              <Input
                id="qualification"
                placeholder="e.g. MBBS, MD"
                value={form.qualification}
                onChange={(e) => setForm({ ...form, qualification: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Staff'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!generatedPassword} onOpenChange={(open) => !open && setGeneratedPassword('')}>
        <DialogContent onClose={() => setGeneratedPassword('')}>
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy this password now. The staff member must change it on first sign-in.
          </p>
          <code className="rounded-lg bg-muted p-4 text-base">{generatedPassword}</code>
          <DialogFooter>
            <Button
              onClick={() => {
                void navigator.clipboard.writeText(generatedPassword);
                toast.success('Copied');
              }}
            >
              Copy
            </Button>
            <Button variant="outline" onClick={() => setGeneratedPassword('')}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
