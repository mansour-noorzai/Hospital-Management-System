import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/Shared/StatusBadge';
import { DataTable, ColumnDef } from '@/components/Shared/DataTable';
import type { Drug, Prescription, PrescriptionStatus } from '@/types/pharmacy';
import toast from 'react-hot-toast';
import { PrintReportButton, type PrintableReport } from '@/components/Shared/PrintReportButton';

interface DrugsResponse {
  success: boolean;
  data: Drug[];
}

interface PrescriptionsResponse {
  success: boolean;
  data: Prescription[];
}

type StatusFilter = 'all' | PrescriptionStatus;
type ActiveTab = 'prescriptions' | 'drugs';

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function prescriptionReport(prescription: Prescription): PrintableReport {
  const patient = `${prescription.patientId?.userId?.firstName ?? ''} ${prescription.patientId?.userId?.lastName ?? ''}`.trim() || '—';
  const doctor = `${prescription.doctorId?.userId?.firstName ?? ''} ${prescription.doctorId?.userId?.lastName ?? ''}`.trim() || '—';
  return {
    title: 'Prescription', reference: prescription.prescriptionId, subtitle: patient,
    fields: [
      { label: 'Prescription ID', value: prescription.prescriptionId },
      { label: 'Patient', value: patient },
      { label: 'Doctor', value: doctor },
      { label: 'Status', value: prescription.status },
      { label: 'Created', value: new Date(prescription.createdAt).toLocaleString() },
      { label: 'Dispensed at', value: prescription.dispensedAt ? new Date(prescription.dispensedAt).toLocaleString() : '—' },
      { label: 'Dispensed by', value: prescription.dispensedBy ? `${prescription.dispensedBy.firstName} ${prescription.dispensedBy.lastName}` : '—' },
    ],
    tables: [{ title: 'Medications', columns: ['Drug', 'Dosage', 'Frequency', 'Duration', 'Quantity'], rows: prescription.lineItems.map((item) => [item.drugName, item.dosage, item.frequency, item.duration, item.quantity]) }],
    notes: prescription.notes,
  };
}

function drugReport(drug: Drug): PrintableReport {
  return {
    title: 'Drug Record', reference: drug.code, subtitle: drug.name,
    fields: [
      { label: 'Code', value: drug.code }, { label: 'Name', value: drug.name },
      { label: 'Category', value: drug.category }, { label: 'Unit', value: drug.unit },
      { label: 'Stock quantity', value: drug.stockQuantity }, { label: 'Reorder level', value: drug.reorderLevel },
      { label: 'Stock status', value: drug.stockQuantity === 0 ? 'Out of stock' : drug.stockQuantity <= drug.reorderLevel ? 'Low stock' : 'In stock' },
      { label: 'Description', value: drug.description },
    ],
  };
}

function prescriptionListReport(prescriptions: Prescription[]): PrintableReport {
  return { title: 'Prescription Register', fields: [{ label: 'Total prescriptions', value: prescriptions.length }], tables: [{ columns: ['ID', 'Patient', 'Doctor', 'Date', 'Status'], rows: prescriptions.map((item) => [item.prescriptionId, `${item.patientId?.userId?.firstName ?? ''} ${item.patientId?.userId?.lastName ?? ''}`.trim(), `${item.doctorId?.userId?.firstName ?? ''} ${item.doctorId?.userId?.lastName ?? ''}`.trim(), new Date(item.createdAt).toLocaleDateString(), item.status]) }] };
}

function drugListReport(drugs: Drug[]): PrintableReport {
  return { title: 'Drug Inventory', fields: [{ label: 'Total drugs', value: drugs.length }], tables: [{ columns: ['Code', 'Name', 'Category', 'Unit', 'Stock', 'Reorder level'], rows: drugs.map((item) => [item.code, item.name, item.category, item.unit, item.stockQuantity, item.reorderLevel]) }] };
}

export function AdminPharmacyManagement() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('prescriptions');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);

  // Drug form state
  const [createDrugOpen, setCreateDrugOpen] = useState(false);
  const [editStockOpen, setEditStockOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [drugName, setDrugName] = useState('');
  const [drugCode, setDrugCode] = useState('');
  const [drugCategory, setDrugCategory] = useState('');
  const [drugUnit, setDrugUnit] = useState('');
  const [drugStock, setDrugStock] = useState('');
  const [drugReorderLevel, setDrugReorderLevel] = useState('');
  const [drugDescription, setDrugDescription] = useState('');

  // Edit stock state
  const [editStock, setEditStock] = useState('');
  const [editReorderLevel, setEditReorderLevel] = useState('');

  // Prescriptions query
  const { data: prescriptionsData, isLoading: prescriptionsLoading, isError: prescriptionsError } =
    useQuery<PrescriptionsResponse>({
      queryKey: ['prescriptions', 'admin', statusFilter],
      queryFn: async () => {
        const params = new URLSearchParams({ limit: '100' });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        const res = await api.get(`/pharmacy/prescriptions?${params}`);
        return res.data;
      },
      enabled: activeTab === 'prescriptions',
    });

  // Drugs query
  const { data: drugsData, isLoading: drugsLoading, isError: drugsError } = useQuery<DrugsResponse>({
    queryKey: ['drugs'],
    queryFn: async () => {
      const res = await api.get('/pharmacy/drugs?limit=100');
      return res.data;
    },
    enabled: activeTab === 'drugs',
  });

  // Detail query
  const { data: detailData, isLoading: detailLoading } = useQuery<{ success: boolean; data: Prescription }>({
    queryKey: ['prescription', detailId],
    queryFn: async () => {
      const res = await api.get(`/pharmacy/prescriptions/${detailId}`);
      return res.data;
    },
    enabled: !!detailId,
  });

  const prescriptions = prescriptionsData?.data ?? [];
  const drugs = drugsData?.data ?? [];
  const detailPrescription = detailData?.data ?? null;

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/pharmacy/prescriptions/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Prescription cancelled');
      void queryClient.invalidateQueries({ queryKey: ['prescriptions', 'admin'] });
      void queryClient.invalidateQueries({ queryKey: ['prescription', detailId] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to cancel prescription';
      toast.error(msg);
    },
  });

  const createDrugMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: drugName.trim(),
        code: drugCode.trim(),
        category: drugCategory.trim(),
        unit: drugUnit.trim(),
        stockQuantity: Number(drugStock),
        reorderLevel: Number(drugReorderLevel),
        description: drugDescription.trim() || undefined,
      };
      const res = await api.post('/pharmacy/drugs', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Drug created');
      setCreateDrugOpen(false);
      resetDrugForm();
      void queryClient.invalidateQueries({ queryKey: ['drugs'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to create drug';
      toast.error(msg);
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDrug) return;
      const body = {
        name: drugName.trim(), code: drugCode.trim(), category: drugCategory.trim(), unit: drugUnit.trim(),
        stockQuantity: Number(editStock), reorderLevel: Number(editReorderLevel), description: drugDescription.trim(),
      };
      const res = await api.patch(`/pharmacy/drugs/${selectedDrug._id}`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Drug updated');
      setEditStockOpen(false);
      setSelectedDrug(null);
      void queryClient.invalidateQueries({ queryKey: ['drugs'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to update stock';
      toast.error(msg);
    },
  });

  const deleteDrugMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/pharmacy/drugs/${id}`),
    onSuccess: () => { toast.success('Drug deleted'); void queryClient.invalidateQueries({ queryKey: ['drugs'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to delete drug'),
  });

  const resetDrugForm = () => {
    setDrugName('');
    setDrugCode('');
    setDrugCategory('');
    setDrugUnit('');
    setDrugStock('');
    setDrugReorderLevel('');
    setDrugDescription('');
  };

  const handleCreateDrugSubmit = () => {
    if (!drugName.trim() || !drugCode.trim() || !drugCategory.trim() || !drugUnit.trim()) {
      toast.error('Name, code, category and unit are required');
      return;
    }
    if (drugStock === '' || isNaN(Number(drugStock))) {
      toast.error('Valid stock quantity is required');
      return;
    }
    if (drugReorderLevel === '' || isNaN(Number(drugReorderLevel))) {
      toast.error('Valid reorder level is required');
      return;
    }
    createDrugMutation.mutate();
  };

  const openEditStock = (drug: Drug) => {
    setSelectedDrug(drug);
    setDrugName(drug.name);
    setDrugCode(drug.code);
    setDrugCategory(drug.category);
    setDrugUnit(drug.unit);
    setDrugDescription(drug.description ?? '');
    setEditStock(String(drug.stockQuantity));
    setEditReorderLevel(String(drug.reorderLevel));
    setEditStockOpen(true);
  };

  const prescriptionColumns: ColumnDef<Prescription>[] = [
    {
      header: 'Prescription ID',
      accessorKey: 'prescriptionId',
    },
    {
      header: 'Patient',
      accessorKey: 'patientId',
      cell: (row) =>
        `${row.patientId?.userId?.firstName ?? ''} ${row.patientId?.userId?.lastName ?? ''}`.trim() || '—',
    },
    {
      header: 'Doctor',
      accessorKey: 'doctorId',
      cell: (row) =>
        `${row.doctorId?.userId?.firstName ?? ''} ${row.doctorId?.userId?.lastName ?? ''}`.trim() || '—',
    },
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      header: 'Status',
      accessorKey: 'status',
      cell: (row) => <StatusBadge status={row.status} />,
    },
    {
      header: 'Actions',
      accessorKey: '_id',
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDetailId(row._id)}>
            View
          </Button>
          <PrintReportButton report={prescriptionReport(row)} />
          {(row.status === 'draft' || row.status === 'active') && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelMutation.mutate(row._id)}
              disabled={cancelMutation.isPending}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ];

  const drugColumns: ColumnDef<Drug>[] = [
    {
      header: 'Code',
      accessorKey: 'code',
    },
    {
      header: 'Name',
      accessorKey: 'name',
    },
    {
      header: 'Category',
      accessorKey: 'category',
    },
    {
      header: 'Unit',
      accessorKey: 'unit',
    },
    {
      header: 'Stock',
      accessorKey: 'stockQuantity',
      cell: (row) => (
        <span
          className={
            row.stockQuantity === 0
              ? 'text-red-600 font-semibold'
              : row.stockQuantity <= row.reorderLevel
              ? 'text-amber-600 font-semibold'
              : undefined
          }
        >
          {row.stockQuantity}
        </span>
      ),
    },
    {
      header: 'Reorder Level',
      accessorKey: 'reorderLevel',
    },
    {
      header: 'Actions',
      accessorKey: '_id',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button variant="outline" size="sm" onClick={() => openEditStock(row)}>Edit</Button>
          <PrintReportButton report={drugReport(row)} />
          <Button variant="destructive" size="sm" disabled={deleteDrugMutation.isPending} onClick={() => { if (window.confirm(`Delete ${row.name}?`)) deleteDrugMutation.mutate(row._id); }}>Delete</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pharmacy Management</h1>
          <p className="text-muted-foreground">Manage drugs and prescriptions</p>
        </div>
        {activeTab === 'drugs' && (
          <Button onClick={() => { setCreateDrugOpen(true); resetDrugForm(); }}>
            Add Drug
          </Button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border">
        {(['prescriptions', 'drugs'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setDetailId(null); }}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-gray-900 dark:hover:text-white',
            ].join(' ')}
          >
            {tab === 'prescriptions' ? 'Prescriptions' : 'Drugs'}
          </button>
        ))}
      </div>

      {/* Prescriptions Tab */}
      {activeTab === 'prescriptions' && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setStatusFilter(tab.value)}
                  className={[
                    'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    statusFilter === tab.value
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
              </div>
              <PrintReportButton report={prescriptionListReport(prescriptions)} label="Print all / Save PDF" />
            </div>
          </CardHeader>
          <CardContent>
            {prescriptionsError ? (
              <p className="text-center py-8 text-red-600">Failed to load prescriptions. Please try again.</p>
            ) : (
              <DataTable
                data={prescriptions}
                columns={prescriptionColumns}
                isLoading={prescriptionsLoading}
                emptyMessage="No prescriptions found"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Drugs Tab */}
      {activeTab === 'drugs' && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">
              Items highlighted in <span className="text-red-600 font-medium">red</span> are out of stock.
              Items in <span className="text-amber-600 font-medium">amber</span> are at or below reorder level.
            </p><PrintReportButton report={drugListReport(drugs)} label="Print all / Save PDF" /></div>
          </CardHeader>
          <CardContent>
            {drugsError ? (
              <p className="text-center py-8 text-red-600">Failed to load drugs. Please try again.</p>
            ) : (
              <DataTable
                data={drugs}
                columns={drugColumns}
                isLoading={drugsLoading}
                emptyMessage="No drugs found"
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Prescription Detail Panel */}
      {detailId && activeTab === 'prescriptions' && (
        <Card className="mt-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Prescription Detail</h2>
              <Button variant="outline" size="sm" onClick={() => setDetailId(null)}>
                ✕ Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <div className="space-y-3 animate-pulse py-4">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            ) : detailPrescription ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold">{detailPrescription.prescriptionId}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span>Date: {new Date(detailPrescription.createdAt).toLocaleDateString()}</span>
                      <span>
                        Patient:{' '}
                        {`${detailPrescription.patientId?.userId?.firstName ?? ''} ${detailPrescription.patientId?.userId?.lastName ?? ''}`.trim() || '—'}
                      </span>
                      <span>
                        Doctor:{' '}
                        {`${detailPrescription.doctorId?.userId?.firstName ?? ''} ${detailPrescription.doctorId?.userId?.lastName ?? ''}`.trim() || '—'}
                      </span>
                    </div>
                  </div>
                  <StatusBadge status={detailPrescription.status} />
                </div>

                <div>
                  <p className="text-sm font-medium mb-2">Medications</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-start text-muted-foreground">
                          <th className="pb-2 pr-4 font-medium">Drug</th>
                          <th className="pb-2 pr-4 font-medium">Dosage</th>
                          <th className="pb-2 pr-4 font-medium">Frequency</th>
                          <th className="pb-2 pr-4 font-medium">Duration</th>
                          <th className="pb-2 font-medium">Qty</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {detailPrescription.lineItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 pr-4">{item.drugName}</td>
                            <td className="py-2 pr-4">{item.dosage}</td>
                            <td className="py-2 pr-4">{item.frequency}</td>
                            <td className="py-2 pr-4">{item.duration}</td>
                            <td className="py-2">{item.quantity ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {detailPrescription.notes && (
                  <div>
                    <p className="text-sm font-medium mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{detailPrescription.notes}</p>
                  </div>
                )}

                {detailPrescription.dispensedBy && (
                  <div className="text-xs text-muted-foreground">
                    Dispensed by: {detailPrescription.dispensedBy.firstName} {detailPrescription.dispensedBy.lastName}
                    {detailPrescription.dispensedAt && (
                      <span className="ms-2">on {new Date(detailPrescription.dispensedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <PrintReportButton report={prescriptionReport(detailPrescription)} />
                  {(detailPrescription.status === 'draft' || detailPrescription.status === 'active') && (
                    <Button
                      variant="destructive"
                      onClick={() => cancelMutation.mutate(detailPrescription._id)}
                      disabled={cancelMutation.isPending}
                    >
                      {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Prescription'}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => setDetailId(null)}>
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4">Prescription not found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Drug Dialog */}
      <Dialog open={createDrugOpen} onOpenChange={setCreateDrugOpen}>
        <DialogContent className="max-w-lg" onClose={() => setCreateDrugOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Drug</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="drugName">Name</Label>
                <Input
                  id="drugName"
                  placeholder="e.g. Amoxicillin"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="drugCode">Code</Label>
                <Input
                  id="drugCode"
                  placeholder="e.g. AMX-500"
                  value={drugCode}
                  onChange={(e) => setDrugCode(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="drugCategory">Category</Label>
                <Input
                  id="drugCategory"
                  placeholder="e.g. Antibiotic"
                  value={drugCategory}
                  onChange={(e) => setDrugCategory(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="drugUnit">Unit</Label>
                <Input
                  id="drugUnit"
                  placeholder="e.g. tablet"
                  value={drugUnit}
                  onChange={(e) => setDrugUnit(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="drugStock">Stock Quantity</Label>
                <Input
                  id="drugStock"
                  type="number"
                  placeholder="e.g. 100"
                  value={drugStock}
                  onChange={(e) => setDrugStock(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="drugReorderLevel">Reorder Level</Label>
                <Input
                  id="drugReorderLevel"
                  type="number"
                  placeholder="e.g. 20"
                  value={drugReorderLevel}
                  onChange={(e) => setDrugReorderLevel(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="drugDescription">Description (optional)</Label>
              <Textarea
                id="drugDescription"
                value={drugDescription}
                onChange={(e) => setDrugDescription(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDrugOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDrugSubmit} disabled={createDrugMutation.isPending}>
              {createDrugMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stock Dialog */}
      <Dialog open={editStockOpen} onOpenChange={setEditStockOpen}>
        <DialogContent className="max-w-sm" onClose={() => setEditStockOpen(false)}>
          <DialogHeader>
            <DialogTitle>Edit Drug — {selectedDrug?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="editDrugName">Name</Label><Input id="editDrugName" value={drugName} onChange={(e) => setDrugName(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="editDrugCode">Code</Label><Input id="editDrugCode" value={drugCode} onChange={(e) => setDrugCode(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="editDrugCategory">Category</Label><Input id="editDrugCategory" value={drugCategory} onChange={(e) => setDrugCategory(e.target.value)} className="mt-1" /></div>
              <div><Label htmlFor="editDrugUnit">Unit</Label><Input id="editDrugUnit" value={drugUnit} onChange={(e) => setDrugUnit(e.target.value)} className="mt-1" /></div>
            </div>
            <div>
              <Label htmlFor="editStock">Stock Quantity</Label>
              <Input
                id="editStock"
                type="number"
                value={editStock}
                onChange={(e) => setEditStock(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="editReorderLevel">Reorder Level</Label>
              <Input
                id="editReorderLevel"
                type="number"
                value={editReorderLevel}
                onChange={(e) => setEditReorderLevel(e.target.value)}
                className="mt-1"
              />
            </div>
            <div><Label htmlFor="editDrugDescription">Description</Label><Textarea id="editDrugDescription" value={drugDescription} onChange={(e) => setDrugDescription(e.target.value)} rows={2} className="mt-1" /></div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => updateStockMutation.mutate()} disabled={updateStockMutation.isPending}>
              {updateStockMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
