import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardHeader, CardTitle, CardBody,
  Button, Input, Badge, Modal, Spinner, EmptyState, useToast,
  BuildingIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon,
} from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { restaurantAPI, type StoreProfile } from '../api/management';
import { usePermission, useIsAdmin } from '../hooks/usePermission';

const BUSINESS_TYPES = ['restaurant', 'cafe', 'bakery', 'food_truck', 'cloud_kitchen', 'retail'];
const CURRENCIES = ['AED', 'SAR', 'USD', 'GBP', 'EUR'];
const LOCALES = ['en', 'ar', 'fr', 'ur'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const BIZ_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', cafe: 'Café', bakery: 'Bakery',
  food_truck: 'Food Truck', cloud_kitchen: 'Cloud Kitchen', retail: 'Retail',
};

const EMPTY_CREATE = { name: '', businessType: 'restaurant', currency: 'AED', locale: 'en', timezone: 'Asia/Dubai' };

type SaveSection = 'info' | 'address' | 'hours' | 'branding' | null;

interface EditPanelProps {
  store: StoreProfile;
  canEdit: boolean;
  onSaved: (updated: StoreProfile) => void;
  onDeleted: (storeId: string) => void;
}

function EditPanel({ store, canEdit, onSaved, onDeleted }: EditPanelProps) {
  const { success, error: toastError } = useToast();
  const [saving, setSaving] = useState<SaveSection>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [info, setInfo] = useState({
    name: store.name ?? '',
    businessType: store.businessType ?? '',
    currency: store.currency ?? 'AED',
    locale: store.locale ?? 'en',
    timezone: store.timezone ?? '',
    phone: store.phone ?? '',
    email: store.email ?? '',
    vatNumber: store.vatNumber ?? '',
  });
  const [address, setAddress] = useState({
    line1: store.address?.line1 ?? '',
    city: store.address?.city ?? '',
    country: store.address?.country ?? '',
    postalCode: store.address?.postalCode ?? '',
  });
  const [hours, setHours] = useState(
    DAYS.map((_, i) => {
      const found = store.operatingHours?.find((h) => h.dayOfWeek === i);
      return found ?? { dayOfWeek: i, openTime: '09:00', closeTime: '22:00', isClosed: false };
    }),
  );
  const [branding, setBranding] = useState({
    primaryColor: store.branding?.primaryColor ?? '',
    logoUrl: store.branding?.logoUrl ?? '',
    displayName: store.branding?.displayName ?? '',
  });
  const [captureCustomerDetails, setCaptureCustomerDetails] = useState(store.posCaptureCustomerDetails);
  const [posSettingBusy, setPosSettingBusy] = useState(false);

  const toggleCaptureCustomerDetails = async () => {
    const next = !captureCustomerDetails;
    setPosSettingBusy(true);
    try {
      const updated = await restaurantAPI.update(store.id, { posCaptureCustomerDetails: next });
      setCaptureCustomerDetails(next);
      onSaved(updated);
      success(next ? 'Customer capture enabled on POS' : 'Customer capture disabled on POS');
    } catch {
      toastError('Failed to update POS setting');
    } finally {
      setPosSettingBusy(false);
    }
  };

  const save = async (section: SaveSection, payload: Record<string, unknown>) => {
    setSaving(section);
    try {
      const updated = section === 'branding'
        ? await restaurantAPI.updateBranding(store.id, payload)
        : await restaurantAPI.update(store.id, payload);
      onSaved(updated);
      success('Saved successfully');
    } catch {
      toastError('Failed to save changes');
    } finally {
      setSaving(null);
    }
  };

  const toggleStatus = async () => {
    setStatusBusy(true);
    try {
      const updated = await restaurantAPI.setStatus(store.id, !store.isActive);
      onSaved(updated);
      success(updated.isActive ? 'Restaurant activated' : 'Restaurant deactivated');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to update status');
    } finally {
      setStatusBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await restaurantAPI.remove(store.id);
      success(`"${store.name}" deleted`);
      setDeleteConfirm(false);
      onDeleted(store.id);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to delete restaurant');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pt-2">
      {/* Basic Info */}
      <Card>
        <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Restaurant Name</label>
              <Input value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">Business Type</label>
              <select className="input w-full" value={info.businessType} onChange={(e) => setInfo({ ...info, businessType: e.target.value })} disabled={!canEdit}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{BIZ_LABELS[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Currency</label>
              <select className="input w-full" value={info.currency} onChange={(e) => setInfo({ ...info, currency: e.target.value })} disabled={!canEdit}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Language</label>
              <select className="input w-full" value={info.locale} onChange={(e) => setInfo({ ...info, locale: e.target.value })} disabled={!canEdit}>
                {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Phone</label>
              <Input value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value })} disabled={!canEdit} placeholder="+971 50 000 0000" />
            </div>
            <div>
              <label className="field-label">Email</label>
              <Input type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">Timezone</label>
              <Input value={info.timezone} onChange={(e) => setInfo({ ...info, timezone: e.target.value })} disabled={!canEdit} placeholder="Asia/Dubai" />
            </div>
            <div>
              <label className="field-label">VAT Number</label>
              <Input value={info.vatNumber} onChange={(e) => setInfo({ ...info, vatNumber: e.target.value })} disabled={!canEdit} />
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" loading={saving === 'info'}
                onClick={() => save('info', { ...info, address })}>Save Basic Info</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle>Address</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="field-label">Street Address</label>
              <Input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">City</label>
              <Input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">Country</label>
              <Input value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">Postal Code</label>
              <Input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} disabled={!canEdit} />
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" loading={saving === 'address'}
                onClick={() => save('address', { address })}>Save Address</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Operating Hours */}
      <Card>
        <CardHeader><CardTitle>Operating Hours</CardTitle></CardHeader>
        <CardBody className="space-y-3">
          {DAYS.map((day, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="w-24 text-sm font-medium text-neutral-700">{day}</span>
              <label className="flex items-center gap-2 text-sm text-neutral-600">
                <input type="checkbox" checked={!hours[i].isClosed}
                  onChange={(e) => { const u = [...hours]; u[i] = { ...u[i], isClosed: !e.target.checked }; setHours(u); }}
                  disabled={!canEdit} className="rounded" />
                Open
              </label>
              {!hours[i].isClosed && (
                <>
                  <Input type="time" value={hours[i].openTime} className="w-32" disabled={!canEdit}
                    onChange={(e) => { const u = [...hours]; u[i] = { ...u[i], openTime: e.target.value }; setHours(u); }} />
                  <span className="text-neutral-400 text-sm">to</span>
                  <Input type="time" value={hours[i].closeTime} className="w-32" disabled={!canEdit}
                    onChange={(e) => { const u = [...hours]; u[i] = { ...u[i], closeTime: e.target.value }; setHours(u); }} />
                </>
              )}
              {hours[i].isClosed && <span className="text-sm text-neutral-400 italic">Closed</span>}
            </div>
          ))}
          {canEdit && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" loading={saving === 'hours'}
                onClick={() => save('hours', { operatingHours: hours })}>Save Hours</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Branding */}
      <Card>
        <CardHeader><CardTitle>Branding</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="field-label">Display Name</label>
              <Input value={branding.displayName} onChange={(e) => setBranding({ ...branding, displayName: e.target.value })} disabled={!canEdit} />
            </div>
            <div>
              <label className="field-label">Logo URL</label>
              <Input value={branding.logoUrl} onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })} disabled={!canEdit} placeholder="https://..." />
            </div>
            <div>
              <label className="field-label">Primary Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={branding.primaryColor || '#2563eb'} disabled={!canEdit}
                  onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })}
                  className="w-10 h-10 rounded border border-neutral-200 cursor-pointer p-0.5" />
                <Input value={branding.primaryColor} onChange={(e) => setBranding({ ...branding, primaryColor: e.target.value })} disabled={!canEdit} placeholder="#2563eb" />
              </div>
            </div>
          </div>
          {canEdit && (
            <div className="flex justify-end pt-1">
              <Button variant="primary" size="sm" loading={saving === 'branding'}
                onClick={() => save('branding', branding)}>Save Branding</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* POS Settings */}
      <Card>
        <CardHeader><CardTitle>POS Settings</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-neutral-800">Capture customer details on POS</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                When on, cashiers can attach a name/mobile/email to an order and look up a customer's
                order history from the POS cart. When off, the customer icon is hidden and orders stay anonymous.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={captureCustomerDetails}
              disabled={!canEdit || posSettingBusy}
              onClick={toggleCaptureCustomerDetails}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                captureCustomerDetails ? 'bg-primary-600' : 'bg-neutral-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  captureCustomerDetails ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      {canEdit && (
        <Card className="border-red-200">
          <CardHeader><CardTitle className="text-red-600">Danger Zone</CardTitle></CardHeader>
          <CardBody>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-800">
                  {store.isActive ? 'Deactivate Restaurant' : 'Activate Restaurant'}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {store.isActive
                    ? 'Hides this restaurant from all active POS terminals and kiosks.'
                    : 'Makes this restaurant visible and operational again.'}
                </p>
              </div>
              <Button
                variant={store.isActive ? 'outline' : 'primary'}
                size="sm"
                loading={statusBusy}
                onClick={toggleStatus}
              >
                {store.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>

            <div className="border-t border-red-100 mt-4 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-red-700">Delete Restaurant</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Permanently removes this restaurant and all its branches, staff, and data. Cannot be undone.
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>
                Delete
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Delete confirmation modal */}
      <Modal
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        title="Delete Restaurant"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
              Yes, Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Are you sure you want to permanently delete <strong>{store.name}</strong>? This will
          remove all branches, tables, staff profiles, and associated data. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

export const RestaurantPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const canEdit   = usePermission('restaurants:edit');
  const isAdmin   = useIsAdmin();

  const [restaurants, setRestaurants] = useState<StoreProfile[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState<string | null>(storeId ?? null);
  const [createModal, setCreateModal] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [form, setForm]               = useState(EMPTY_CREATE);

  const load = useCallback(() => {
    setLoading(true);
    restaurantAPI.list()
      .then((list) => {
        setRestaurants(list);
        if (list.length === 1) setExpanded(list[0].id);
      })
      .catch(() => toastError('Failed to load restaurants'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await restaurantAPI.create(form);
      setRestaurants((p) => [created, ...p]);
      setExpanded(created.id);
      success(`Restaurant "${created.name}" created`);
      setCreateModal(false);
      setForm(EMPTY_CREATE);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Failed to create restaurant');
    } finally {
      setSaving(false);
    }
  };

  const handleSaved = (updated: StoreProfile) => {
    setRestaurants((p) => p.map((r) => r.id === updated.id ? updated : r));
  };

  const handleDeleted = (deletedId: string) => {
    setRestaurants((p) => p.filter((r) => r.id !== deletedId));
    setExpanded((cur) => (cur === deletedId ? null : cur));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Restaurants"
        description="View and manage all restaurant profiles"
        actions={isAdmin ? (
          <Button variant="primary" size="sm" icon={<PlusIcon size={16} />} onClick={() => { setForm(EMPTY_CREATE); setCreateModal(true); }}>
            Add Restaurant
          </Button>
        ) : undefined}
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : restaurants.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<BuildingIcon size={32} />}
              title="No restaurants yet"
              description="Create your first restaurant to get started."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {restaurants.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id} className="overflow-hidden">
                <button
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${r.branding?.primaryColor ? '' : 'bg-primary-100'}`}
                    style={r.branding?.primaryColor ? { backgroundColor: r.branding.primaryColor + '22' } : undefined}>
                    <BuildingIcon size={20} className="text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-neutral-900 truncate">{r.branding?.displayName || r.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{BIZ_LABELS[r.businessType] ?? r.businessType} · {r.currency} · {r.timezone}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {r.id === storeId && <Badge variant="primary">Current</Badge>}
                    <Badge variant={r.isActive ? 'success' : 'default'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                    {isOpen ? <ChevronDownIcon size={18} className="text-neutral-400" /> : <ChevronRightIcon size={18} className="text-neutral-400" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-neutral-100 px-5 pb-5">
                    <EditPanel store={r} canEdit={canEdit} onSaved={handleSaved} onDeleted={handleDeleted} />
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Restaurant Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Add Restaurant"
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleCreate}>Create Restaurant</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Restaurant Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="My Restaurant"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Business Type *</label>
              <select className="input w-full" value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })}>
                {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{BIZ_LABELS[t] ?? t}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Currency</label>
              <select className="input w-full" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Language</label>
              <select className="input w-full" value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })}>
                {LOCALES.map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Timezone</label>
              <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} placeholder="Asia/Dubai" />
            </div>
          </div>
          <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-600">
            After creating, open the restaurant card to set up its address, hours, branding, and staff.
          </div>
        </div>
      </Modal>
    </div>
  );
};
