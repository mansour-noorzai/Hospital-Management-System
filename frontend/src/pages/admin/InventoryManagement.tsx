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
import type { InventoryItem, StockMovement, MovementType } from '@/types/inventory';
import toast from 'react-hot-toast';
import { PrintReportButton, type PrintableReport } from '@/components/Shared/PrintReportButton';

interface ItemsResponse {
  success: boolean;
  data: InventoryItem[];
}

interface MovementsResponse {
  success: boolean;
  data: StockMovement[];
}

interface InventoryCategory {
  _id: string;
  name: string;
  description?: string;
  createdAt: string;
}

type ActiveTab = 'items' | 'movements' | 'categories';

const MOVEMENT_TYPE_OPTIONS: { value: MovementType; label: string }[] = [
  { value: 'in', label: 'Stock In' },
  { value: 'out', label: 'Stock Out' },
  { value: 'adjustment', label: 'Adjustment' },
  { value: 'waste', label: 'Waste' },
];

function itemReport(item: InventoryItem): PrintableReport {
  return { title: 'Inventory Item', reference: item.itemId || item.code, subtitle: item.name, fields: [
    { label: 'Item ID', value: item.itemId }, { label: 'Code', value: item.code }, { label: 'Name', value: item.name },
    { label: 'Category', value: item.category }, { label: 'Quantity', value: `${item.quantity} ${item.unit}` },
    { label: 'Reorder level', value: item.reorderLevel }, { label: 'Expiry date', value: item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—' },
    { label: 'Supplier', value: item.supplier }, { label: 'Description', value: item.description }, { label: 'Created', value: new Date(item.createdAt).toLocaleString() },
  ] };
}

function movementReport(movement: StockMovement): PrintableReport {
  const item = typeof movement.itemId === 'object' ? movement.itemId : undefined;
  return { title: 'Stock Movement', reference: movement._id, fields: [
    { label: 'Item', value: item?.name ?? movement.itemId }, { label: 'Code', value: item?.code }, { label: 'Category', value: item?.category },
    { label: 'Type', value: movement.type }, { label: 'Quantity', value: movement.quantity },
    { label: 'Previous quantity', value: movement.previousQuantity }, { label: 'New quantity', value: movement.newQuantity },
    { label: 'Reason', value: movement.reason }, { label: 'Performed by', value: movement.performedBy ? `${movement.performedBy.firstName} ${movement.performedBy.lastName}` : '—' },
    { label: 'Date', value: new Date(movement.createdAt).toLocaleString() },
  ] };
}

function itemListReport(items: InventoryItem[]): PrintableReport {
  return { title: 'Inventory Items', fields: [{ label: 'Total items', value: items.length }], tables: [{ columns: ['Code', 'Name', 'Category', 'Quantity', 'Unit', 'Reorder level', 'Expiry'], rows: items.map((item) => [item.code, item.name, item.category, item.quantity, item.unit, item.reorderLevel, item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—']) }] };
}

function movementListReport(movements: StockMovement[]): PrintableReport {
  return { title: 'Inventory Movements', fields: [{ label: 'Total movements', value: movements.length }], tables: [{ columns: ['Date', 'Item', 'Type', 'Quantity', 'Change', 'Reason', 'Performed by'], rows: movements.map((movement) => [new Date(movement.createdAt).toLocaleString(), typeof movement.itemId === 'object' ? movement.itemId.name : movement.itemId, movement.type, movement.quantity, `${movement.previousQuantity} → ${movement.newQuantity}`, movement.reason, movement.performedBy ? `${movement.performedBy.firstName} ${movement.performedBy.lastName}` : '—']) }] };
}

export function AdminInventoryManagement() {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('items');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryDescription, setCategoryDescription] = useState('');

  // Create item dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemUnit, setItemUnit] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemReorderLevel, setItemReorderLevel] = useState('');
  const [itemExpiryDate, setItemExpiryDate] = useState('');
  const [itemSupplier, setItemSupplier] = useState('');
  const [itemDescription, setItemDescription] = useState('');

  // Adjust stock dialog state
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustType, setAdjustType] = useState<MovementType>('in');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');

  // Items query
  const { data: itemsData, isLoading: itemsLoading, isError: itemsError } =
    useQuery<ItemsResponse>({
      queryKey: ['inventory-items', search, categoryFilter, lowStockOnly],
      queryFn: async () => {
        const params = new URLSearchParams();
        if (search.trim()) params.set('search', search.trim());
        if (categoryFilter.trim()) params.set('category', categoryFilter.trim());
        if (lowStockOnly) params.set('lowStock', 'true');
        params.set('limit', '100');
        const res = await api.get(`/inventory/items?${params}`);
        return res.data;
      },
      enabled: activeTab === 'items',
    });

  // All movements query
  const { data: movementsData, isLoading: movementsLoading, isError: movementsError } =
    useQuery<MovementsResponse>({
      queryKey: ['inventory-movements'],
      queryFn: async () => {
        const res = await api.get('/inventory/movements?limit=100');
        return res.data;
      },
      enabled: activeTab === 'movements',
    });

  // Item-specific movements query
  const { data: itemMovementsData, isLoading: itemMovementsLoading } =
    useQuery<MovementsResponse>({
      queryKey: ['inventory-item-movements', expandedItemId],
      queryFn: async () => {
        const res = await api.get(`/inventory/items/${expandedItemId}/movements`);
        return res.data;
      },
      enabled: !!expandedItemId && activeTab === 'items',
    });

  const items = itemsData?.data ?? [];
  const movements = movementsData?.data ?? [];
  const itemMovements = itemMovementsData?.data ?? [];

  const categoriesQuery = useQuery<{ success: boolean; data: InventoryCategory[] }>({
    queryKey: ['inventory-categories'],
    queryFn: () => api.get('/inventory/categories').then((response) => response.data),
  });
  const categories = categoriesQuery.data?.data ?? [];

  const createCategoryMutation = useMutation({
    mutationFn: () => api.post('/inventory/categories', { name: categoryName.trim(), description: categoryDescription.trim() || undefined }),
    onSuccess: () => { toast.success('Category created'); setCategoryName(''); setCategoryDescription(''); void queryClient.invalidateQueries({ queryKey: ['inventory-categories'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to create category'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/categories/${id}`),
    onSuccess: () => { toast.success('Category deleted'); void queryClient.invalidateQueries({ queryKey: ['inventory-categories'] }); },
    onError: (err: unknown) => toast.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to delete category'),
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name: itemName.trim(),
        code: itemCode.trim(),
        category: itemCategory.trim(),
        unit: itemUnit.trim(),
        reorderLevel: Number(itemReorderLevel),
      };
      if (itemQuantity !== '') body.quantity = Number(itemQuantity);
      if (itemExpiryDate) body.expiryDate = itemExpiryDate;
      if (itemSupplier.trim()) body.supplier = itemSupplier.trim();
      if (itemDescription.trim()) body.description = itemDescription.trim();
      const res = await api.post('/inventory/items', body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Item created');
      setCreateOpen(false);
      resetCreateForm();
      void queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to create item';
      toast.error(msg);
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedItem) return;
      const body = {
        type: adjustType,
        quantity: Number(adjustQuantity),
        reason: adjustReason.trim() || undefined,
      };
      const res = await api.post(`/inventory/items/${selectedItem._id}/stock`, body);
      return res.data;
    },
    onSuccess: () => {
      toast.success('Stock adjusted');
      setAdjustOpen(false);
      setSelectedItem(null);
      resetAdjustForm();
      void queryClient.invalidateQueries({ queryKey: ['inventory-items'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-item-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to adjust stock';
      toast.error(msg);
    },
  });

  const resetCreateForm = () => {
    setItemName('');
    setItemCode('');
    setItemCategory('');
    setItemUnit('');
    setItemQuantity('');
    setItemReorderLevel('');
    setItemExpiryDate('');
    setItemSupplier('');
    setItemDescription('');
  };

  const resetAdjustForm = () => {
    setAdjustType('in');
    setAdjustQuantity('');
    setAdjustReason('');
  };

  const handleCreateSubmit = () => {
    if (!itemName.trim() || !itemCode.trim() || !itemCategory.trim() || !itemUnit.trim()) {
      toast.error('Name, code, category and unit are required');
      return;
    }
    if (itemReorderLevel === '' || isNaN(Number(itemReorderLevel))) {
      toast.error('Valid reorder level is required');
      return;
    }
    createItemMutation.mutate();
  };

  const handleAdjustSubmit = () => {
    const qty = Number(adjustQuantity);
    const isAbsolute = adjustType === 'adjustment';
    if (adjustQuantity === '' || isNaN(qty) || qty < 0 || (!isAbsolute && qty < 1)) {
      toast.error(isAbsolute ? 'Quantity must be 0 or more' : 'Quantity must be at least 1');
      return;
    }
    adjustStockMutation.mutate();
  };

  const openAdjust = (item: InventoryItem) => {
    setSelectedItem(item);
    resetAdjustForm();
    setAdjustOpen(true);
  };

  const toggleExpand = (itemId: string) => {
    setExpandedItemId((prev) => (prev === itemId ? null : itemId));
  };

  const itemColumns: ColumnDef<InventoryItem>[] = [
    { header: 'Code', accessorKey: 'code' },
    { header: 'Name', accessorKey: 'name' },
    { header: 'Category', accessorKey: 'category' },
    {
      header: 'Quantity',
      accessorKey: 'quantity',
      cell: (row) => (
        <span
          className={
            row.quantity === 0
              ? 'text-red-600 font-semibold'
              : row.quantity <= row.reorderLevel
              ? 'text-amber-600 font-semibold'
              : undefined
          }
        >
          {row.quantity}
        </span>
      ),
    },
    { header: 'Unit', accessorKey: 'unit' },
    { header: 'Reorder Level', accessorKey: 'reorderLevel' },
    {
      header: 'Expiry Date',
      accessorKey: 'expiryDate',
      cell: (row) =>
        row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '—',
    },
    {
      header: 'Actions',
      accessorKey: '_id',
      cell: (row) => (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toggleExpand(row._id)}
          >
            {expandedItemId === row._id ? 'Hide History' : 'History'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openAdjust(row)}
          >
            Adjust Stock
          </Button>
          <PrintReportButton report={itemReport(row)} />
        </div>
      ),
    },
  ];

  const movementColumns: ColumnDef<StockMovement>[] = [
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      header: 'Item Name',
      accessorKey: 'itemId',
      cell: (row) =>
        typeof row.itemId === 'object' ? row.itemId.name : String(row.itemId),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: (row) => <StatusBadge status={row.type} />,
    },
    {
      header: 'Change',
      accessorKey: 'previousQuantity',
      cell: (row) => `${row.previousQuantity} → ${row.newQuantity}`,
    },
    {
      header: 'Reason',
      accessorKey: 'reason',
      cell: (row) => row.reason ?? '—',
    },
    {
      header: 'Performed By',
      accessorKey: 'performedBy',
      cell: (row) =>
        `${row.performedBy?.firstName ?? ''} ${row.performedBy?.lastName ?? ''}`.trim() || '—',
    },
    { header: 'Actions', accessorKey: '_id', cell: (row) => <PrintReportButton report={movementReport(row)} /> },
  ];

  // Inline movement history columns (no item name column needed)
  const itemMovementColumns: ColumnDef<StockMovement>[] = [
    {
      header: 'Date',
      accessorKey: 'createdAt',
      cell: (row) => new Date(row.createdAt).toLocaleDateString(),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      cell: (row) => <StatusBadge status={row.type} />,
    },
    {
      header: 'Change',
      accessorKey: 'previousQuantity',
      cell: (row) => `${row.previousQuantity} → ${row.newQuantity}`,
    },
    {
      header: 'Qty',
      accessorKey: 'quantity',
    },
    {
      header: 'Reason',
      accessorKey: 'reason',
      cell: (row) => row.reason ?? '—',
    },
    {
      header: 'Performed By',
      accessorKey: 'performedBy',
      cell: (row) =>
        `${row.performedBy?.firstName ?? ''} ${row.performedBy?.lastName ?? ''}`.trim() || '—',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inventory Management</h1>
          <p className="text-muted-foreground">Manage medical supplies and stock levels</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeTab === 'items' && <><PrintReportButton report={itemListReport(items)} label="Print all / Save PDF" /><Button onClick={() => { setCreateOpen(true); resetCreateForm(); }}>Add Item</Button></>}
          {activeTab === 'movements' && <PrintReportButton report={movementListReport(movements)} label="Print all / Save PDF" />}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-border">
        {(['items', 'movements', 'categories'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setExpandedItemId(null); }}
            className={[
              'px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-gray-900 dark:hover:text-white',
            ].join(' ')}
          >
            {tab === 'items' ? 'Items' : tab === 'movements' ? 'Movements' : 'Categories'}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {activeTab === 'items' && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <Input
                placeholder="Search items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat._id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Low Stock Only
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Items in <span className="text-red-600 font-medium">red</span> are out of stock.
              Items in <span className="text-amber-600 font-medium">amber</span> are at or below reorder level.
            </p>
          </CardHeader>
          <CardContent>
            {itemsError ? (
              <p className="text-center py-8 text-red-600">Failed to load inventory. Please try again.</p>
            ) : (
              <>
                <DataTable
                  data={items}
                  columns={itemColumns}
                  isLoading={itemsLoading}
                  emptyMessage="No inventory items found"
                />
                {/* Inline movement history */}
                {expandedItemId && (
                  <div className="mt-4 border rounded-md p-4 bg-muted/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">
                        Movement History — {items.find((i) => i._id === expandedItemId)?.name ?? ''}
                      </h3>
                      <Button variant="outline" size="sm" onClick={() => setExpandedItemId(null)}>
                        Close
                      </Button>
                    </div>
                    {itemMovementsLoading ? (
                      <div className="space-y-2 animate-pulse">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      </div>
                    ) : (
                      <DataTable
                        data={itemMovements}
                        columns={itemMovementColumns}
                        isLoading={false}
                        emptyMessage="No movements recorded for this item"
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Movements Tab */}
      {activeTab === 'movements' && (
        <Card>
          <CardHeader className="pb-2">
            <p className="text-xs text-muted-foreground">
              Recent stock movements across all inventory items.
            </p>
          </CardHeader>
          <CardContent>
            {movementsError ? (
              <p className="text-center py-8 text-red-600">Failed to load movements. Please try again.</p>
            ) : (
              <DataTable
                data={movements}
                columns={movementColumns}
                isLoading={movementsLoading}
                emptyMessage="No movements recorded"
              />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'categories' && (
        <Card>
          <CardHeader className="pb-4"><p className="text-sm font-semibold">Inventory Categories</p><p className="text-xs text-muted-foreground">Create categories here before adding inventory items.</p></CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <div><Label htmlFor="categoryName">Category name</Label><Input id="categoryName" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="e.g. PPE" className="mt-1" /></div>
              <div><Label htmlFor="categoryDescription">Description</Label><Input id="categoryDescription" value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} placeholder="Optional description" className="mt-1" /></div>
              <Button disabled={!categoryName.trim() || createCategoryMutation.isPending} onClick={() => createCategoryMutation.mutate()}>{createCategoryMutation.isPending ? 'Adding...' : 'Add Category'}</Button>
            </div>
            {categoriesQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading categories...</p> : (
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-muted-foreground"><th className="px-3 py-2 text-start">Name</th><th className="px-3 py-2 text-start">Description</th><th className="px-3 py-2 text-start">Created</th><th className="px-3 py-2 text-start">Actions</th></tr></thead><tbody>{categories.map((category) => <tr key={category._id} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{category.name}</td><td className="px-3 py-3 text-muted-foreground">{category.description ?? '—'}</td><td className="px-3 py-3">{new Date(category.createdAt).toLocaleDateString()}</td><td className="px-3 py-3"><Button variant="destructive" size="sm" disabled={deleteCategoryMutation.isPending} onClick={() => { if (window.confirm(`Delete category ${category.name}?`)) deleteCategoryMutation.mutate(category._id); }}>Delete</Button></td></tr>)}</tbody></table>{!categories.length && <p className="py-8 text-center text-muted-foreground">No categories added yet.</p>}</div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create Item Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg" onClose={() => setCreateOpen(false)}>
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="itemName">Name</Label>
                <Input
                  id="itemName"
                  placeholder="e.g. Surgical Gloves"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemCode">Code</Label>
                <Input
                  id="itemCode"
                  placeholder="e.g. SG-MED-L"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemCategory">Category</Label>
                <select
                  id="itemCategory"
                  value={itemCategory}
                  onChange={(e) => setItemCategory(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                ><option value="">Select category</option>{categories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}</select>
              </div>
              <div>
                <Label htmlFor="itemUnit">Unit</Label>
                <Input
                  id="itemUnit"
                  placeholder="e.g. box"
                  value={itemUnit}
                  onChange={(e) => setItemUnit(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemQuantity">Initial Quantity (optional)</Label>
                <Input
                  id="itemQuantity"
                  type="number"
                  placeholder="Default: 0"
                  value={itemQuantity}
                  onChange={(e) => setItemQuantity(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemReorderLevel">Reorder Level</Label>
                <Input
                  id="itemReorderLevel"
                  type="number"
                  placeholder="e.g. 10"
                  value={itemReorderLevel}
                  onChange={(e) => setItemReorderLevel(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemExpiryDate">Expiry Date (optional)</Label>
                <Input
                  id="itemExpiryDate"
                  type="date"
                  value={itemExpiryDate}
                  onChange={(e) => setItemExpiryDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="itemSupplier">Supplier (optional)</Label>
                <Input
                  id="itemSupplier"
                  placeholder="e.g. MedSupply Co."
                  value={itemSupplier}
                  onChange={(e) => setItemSupplier(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="itemDescription">Description (optional)</Label>
              <Textarea
                id="itemDescription"
                value={itemDescription}
                onChange={(e) => setItemDescription(e.target.value)}
                rows={2}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createItemMutation.isPending}>
              {createItemMutation.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-sm" onClose={() => setAdjustOpen(false)}>
          <DialogHeader>
            <DialogTitle>Adjust Stock — {selectedItem?.name}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current quantity: <span className="font-semibold text-foreground">{selectedItem?.quantity ?? 0}</span> {selectedItem?.unit}
            </p>
            <div>
              <Label htmlFor="adjustType">Type</Label>
              <select
                id="adjustType"
                value={adjustType}
                onChange={(e) => setAdjustType(e.target.value as MovementType)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {MOVEMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="adjustQuantity">
                {adjustType === 'adjustment' ? 'New Quantity (absolute)' : 'Quantity'}
              </Label>
              <Input
                id="adjustQuantity"
                type="number"
                min="0"
                placeholder="e.g. 50"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="adjustReason">Reason (optional)</Label>
              <Textarea
                id="adjustReason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                rows={2}
                className="mt-1"
                placeholder="e.g. Monthly restocking"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={adjustStockMutation.isPending}>
              {adjustStockMutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
