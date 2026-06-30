import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardHeader, CardTitle, CardBody,
  Button, Input, Badge, Modal, EmptyState, Spinner, useToast,
  PlusIcon, TrashIcon,
} from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { branchAPI, tableAPI, type Branch, type DiningArea, type Table } from '../api/management';
import { usePermission } from '../hooks/usePermission';

const STATUS_VARIANTS: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  available: 'success', occupied: 'error', reserved: 'warning', cleaning: 'default',
};

export const TablesPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const canCreate = usePermission('tables:create');
  const canDelete = usePermission('tables:delete');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [areas, setAreas] = useState<DiningArea[]>([]);
  const [tables, setTables] = useState<Record<string, Table[]>>({});
  const [loading, setLoading] = useState(false);

  // Add table modal
  const [modal, setModal]   = useState(false);
  const [areaId, setAreaId] = useState('');
  const [form, setForm]     = useState({ tableNumber: '', capacity: '4' });
  const [saving, setSaving] = useState(false);

  // Add dining area modal
  const [areaModal, setAreaModal] = useState(false);
  const [areaForm, setAreaForm]   = useState({ name: '', floorNumber: '1' });
  const [areaSaving, setAreaSaving] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    branchAPI.list(storeId).then((list) => {
      setBranches(list);
      if (list.length > 0) setSelectedBranch(list[0].id);
    }).catch(() => toastError('Failed to load branches'));
  }, [storeId]);

  const loadBranchData = useCallback(async (branchId: string) => {
    setLoading(true);
    setAreas([]);
    setTables({});
    try {
      const [areasData, tablesData] = await Promise.all([
        branchAPI.getDiningAreas(branchId),
        tableAPI.listByBranch(branchId),
      ]);
      setAreas(areasData);
      const byArea: Record<string, Table[]> = {};
      for (const a of areasData) byArea[a.id] = [];
      for (const t of tablesData) {
        if (!byArea[t.diningAreaId]) byArea[t.diningAreaId] = [];
        byArea[t.diningAreaId].push(t);
      }
      setTables(byArea);
    } catch {
      toastError('Failed to load tables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedBranch) loadBranchData(selectedBranch); }, [selectedBranch, loadBranchData]);

  const openAddTable = (forAreaId: string) => {
    setAreaId(forAreaId);
    setForm({ tableNumber: '', capacity: '4' });
    setModal(true);
  };

  const saveTable = async () => {
    if (!storeId || !areaId || !selectedBranch) return;
    setSaving(true);
    try {
      const created = await tableAPI.create({
        diningAreaId: areaId,
        branchId: selectedBranch,
        storeId,
        tableNumber: form.tableNumber,
        capacity: Number(form.capacity),
      });
      setTables((p) => ({ ...p, [areaId]: [...(p[areaId] ?? []), created] }));
      success(`Table ${created.tableNumber} added`);
      setModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'Failed to add table');
    } finally {
      setSaving(false);
    }
  };

  const openAddArea = () => {
    setAreaForm({ name: '', floorNumber: '1' });
    setAreaModal(true);
  };

  const saveArea = async () => {
    if (!storeId || !selectedBranch) return;
    setAreaSaving(true);
    try {
      const created = await branchAPI.createDiningArea(selectedBranch, {
        storeId,
        name: areaForm.name,
        floorNumber: areaForm.floorNumber ? Number(areaForm.floorNumber) : undefined,
      });
      setAreas((p) => [...p, created]);
      setTables((p) => ({ ...p, [created.id]: [] }));
      success(`Dining area "${created.name}" added`);
      setAreaModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'Failed to add dining area');
    } finally {
      setAreaSaving(false);
    }
  };

  const deleteTable = async (table: Table) => {
    if (!confirm(`Delete table ${table.tableNumber}?`)) return;
    try {
      await tableAPI.delete(table.id);
      setTables((p) => ({ ...p, [table.diningAreaId]: p[table.diningAreaId].filter((t) => t.id !== table.id) }));
      success('Table deleted');
    } catch {
      toastError('Failed to delete table');
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Table Management"
        description="Configure dining areas and tables across your branches"
      />

      {/* Branch selector */}
      <div className="flex items-center gap-3 flex-wrap">
        {branches.map((b) => (
          <button key={b.id}
            onClick={() => setSelectedBranch(b.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              selectedBranch === b.id
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-neutral-700 border-neutral-200 hover:border-primary-300'
            }`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : areas.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No dining areas"
              description="Add a dining area to this branch before adding tables."
            />
            {canCreate && (
              <div className="flex justify-center mt-4">
                <Button variant="primary" size="sm" onClick={openAddArea}>
                  <PlusIcon size={14} className="mr-1" /> Add Dining Area
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-6">
          {areas.map((area) => (
            <Card key={area.id}>
              <CardHeader className="flex items-center justify-between">
                <div>
                  <CardTitle>{area.name}</CardTitle>
                  {area.floorNumber && <p className="text-xs text-neutral-500 mt-0.5">Floor {area.floorNumber}</p>}
                </div>
                {canCreate && (
                  <Button variant="outline" size="sm" onClick={() => openAddTable(area.id)}>
                    <PlusIcon size={14} className="mr-1" /> Add Table
                  </Button>
                )}
              </CardHeader>
              <CardBody>
                {(!tables[area.id] || tables[area.id].length === 0) ? (
                  <p className="text-sm text-neutral-400 text-center py-4">No tables in this area.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {tables[area.id].map((t) => (
                      <div key={t.id} className="relative group bg-white border border-neutral-200 rounded-xl p-3 text-center hover:shadow-sm transition-shadow">
                        <div className="text-2xl font-bold text-neutral-800">{t.tableNumber}</div>
                        <div className="text-xs text-neutral-500 mt-0.5">{t.capacity} seats</div>
                        <div className="mt-2">
                          <Badge variant={STATUS_VARIANTS[t.status] ?? 'default'} size="sm">
                            {t.status}
                          </Badge>
                        </div>
                        {canDelete && (
                          <button
                            onClick={() => deleteTable(t)}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 p-1 rounded text-neutral-400 hover:text-error-600 transition-all"
                          >
                            <TrashIcon size={12} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          ))}

          {/* Add another dining area */}
          {canCreate && (
            <Button variant="ghost" size="sm" onClick={openAddArea} className="text-neutral-500">
              <PlusIcon size={14} className="mr-1" /> Add Dining Area
            </Button>
          )}
        </div>
      )}

      {/* Add Table modal */}
      <Modal
        isOpen={modal}
        onClose={() => setModal(false)}
        title="Add Table"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveTable}>Add Table</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Table Number *</label>
            <Input value={form.tableNumber} onChange={(e) => setForm({ ...form, tableNumber: e.target.value })} placeholder="T1, T2, A1…" autoFocus />
          </div>
          <div>
            <label className="field-label">Seating Capacity *</label>
            <Input type="number" min="1" max="50" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Add Dining Area modal */}
      <Modal
        isOpen={areaModal}
        onClose={() => setAreaModal(false)}
        title="Add Dining Area"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAreaModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={areaSaving} onClick={saveArea}>Add Area</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Area Name *</label>
            <Input value={areaForm.name} onChange={(e) => setAreaForm({ ...areaForm, name: e.target.value })} placeholder="Ground Floor, Terrace, Rooftop…" autoFocus />
          </div>
          <div>
            <label className="field-label">Floor Number</label>
            <Input type="number" min="1" value={areaForm.floorNumber} onChange={(e) => setAreaForm({ ...areaForm, floorNumber: e.target.value })} placeholder="1" />
          </div>
        </div>
      </Modal>
    </div>
  );
};
