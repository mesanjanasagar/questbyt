import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody,
  Button, Input, Badge, Modal, EmptyState, Spinner, useToast,
  PlusIcon, EditIcon, TrashIcon, PackageIcon, AlertTriangleIcon, SearchIcon,
} from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { inventoryAPI, type InventoryProduct, type StockMovement } from '../api/management';
import { formatDistanceToNow } from 'date-fns';

const UNIT_TYPES = ['piece', 'kg', 'liter', 'box'] as const;
type MovementType = 'purchase' | 'adjustment' | 'waste' | 'return';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  active: 'success', inactive: 'warning', archived: 'error',
};

export const InventoryPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();

  const [tab, setTab] = useState<'products' | 'alerts'>('products');
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Product modal
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [productForm, setProductForm] = useState({ name: '', sku: '', description: '', unitType: 'piece' as string });
  const [productSaving, setProductSaving] = useState(false);

  // Stock modal
  const [stockProduct, setStockProduct] = useState<InventoryProduct | null>(null);
  const [stockTab, setStockTab] = useState<'set' | 'adjust' | 'history'>('set');
  const [setStockForm, setSetStockForm] = useState({ currentStock: '', reorderLevel: '', reorderQuantity: '' });
  const [adjustForm, setAdjustForm] = useState({ movementType: 'purchase' as MovementType, quantity: '', reason: '' });
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [stockSaving, setStockSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const result = await inventoryAPI.listWithStock(storeId, { status: 'active', search: search || undefined, limit: 50 });
      setProducts((result as any).data ?? result);
    } catch {
      toastError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [storeId, search]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', sku: '', description: '', unitType: 'piece' });
    setProductModal(true);
  };

  const openEditProduct = (p: InventoryProduct) => {
    setEditingProduct(p);
    setProductForm({ name: p.name, sku: p.sku ?? '', description: p.description ?? '', unitType: p.unitType });
    setProductModal(true);
  };

  const saveProduct = async () => {
    if (!storeId || !productForm.name.trim()) return;
    setProductSaving(true);
    try {
      if (editingProduct) {
        const updated = await inventoryAPI.update(editingProduct.id, {
          name: productForm.name, sku: productForm.sku || undefined,
          description: productForm.description || undefined, unitType: productForm.unitType,
        });
        setProducts((p) => p.map((x) => x.id === updated.id ? { ...x, ...updated } : x));
        success('Product updated');
      } else {
        const created = await inventoryAPI.create({
          storeId, name: productForm.name, unitType: productForm.unitType,
          sku: productForm.sku || undefined, description: productForm.description || undefined,
        });
        setProducts((p) => [{ ...created, inventory: undefined }, ...p]);
        success('Product created');
      }
      setProductModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to save product');
    } finally {
      setProductSaving(false);
    }
  };

  const archiveProduct = async (product: InventoryProduct) => {
    if (!confirm(`Archive "${product.name}"? It will no longer appear in active lists.`)) return;
    try {
      await inventoryAPI.archive(product.id);
      setProducts((p) => p.filter((x) => x.id !== product.id));
      success('Product archived');
    } catch {
      toastError('Failed to archive product');
    }
  };

  const openStock = async (product: InventoryProduct) => {
    setStockProduct(product);
    setStockTab('set');
    setSetStockForm({
      currentStock: String(product.inventory?.currentStock ?? 0),
      reorderLevel: String(product.inventory?.reorderLevel ?? ''),
      reorderQuantity: String(product.inventory?.reorderQuantity ?? ''),
    });
    setAdjustForm({ movementType: 'purchase', quantity: '', reason: '' });
    setMovements([]);
  };

  const loadMovements = async () => {
    if (!stockProduct) return;
    setMovementsLoading(true);
    try {
      const result = await inventoryAPI.getMovements(stockProduct.id, { limit: 20 });
      setMovements((result as any).data ?? result);
    } catch {
      toastError('Failed to load movement history');
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    if (stockProduct && stockTab === 'history') loadMovements();
  }, [stockProduct, stockTab]);

  const saveStock = async () => {
    if (!stockProduct) return;
    setStockSaving(true);
    try {
      await inventoryAPI.setStock(stockProduct.id, {
        currentStock: parseFloat(setStockForm.currentStock) || 0,
        reorderLevel: setStockForm.reorderLevel ? parseFloat(setStockForm.reorderLevel) : undefined,
        reorderQuantity: setStockForm.reorderQuantity ? parseFloat(setStockForm.reorderQuantity) : undefined,
      });
      const updated = { ...stockProduct, inventory: { ...(stockProduct.inventory ?? { reservedStock: 0, availableStock: 0, updatedAt: '' }), currentStock: parseFloat(setStockForm.currentStock) || 0, reorderLevel: setStockForm.reorderLevel ? parseFloat(setStockForm.reorderLevel) : undefined, reorderQuantity: setStockForm.reorderQuantity ? parseFloat(setStockForm.reorderQuantity) : undefined } };
      setProducts((p) => p.map((x) => x.id === stockProduct.id ? updated as InventoryProduct : x));
      setStockProduct(updated as InventoryProduct);
      success('Stock updated');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to update stock');
    } finally {
      setStockSaving(false);
    }
  };

  const saveAdjustment = async () => {
    if (!stockProduct || !adjustForm.quantity || !adjustForm.reason) return;
    setStockSaving(true);
    try {
      const qty = parseFloat(adjustForm.quantity);
      const delta = ['waste', 'return'].includes(adjustForm.movementType) ? -Math.abs(qty) : Math.abs(qty);
      await inventoryAPI.adjust(stockProduct.id, {
        movementType: adjustForm.movementType,
        adjustmentQuantity: delta,
        reason: adjustForm.reason,
      });
      const newStock = (stockProduct.inventory?.currentStock ?? 0) + delta;
      const updated = { ...stockProduct, inventory: { ...(stockProduct.inventory ?? { reservedStock: 0, reorderLevel: undefined, reorderQuantity: undefined, updatedAt: '' }), currentStock: newStock, availableStock: newStock - (stockProduct.inventory?.reservedStock ?? 0) } };
      setProducts((p) => p.map((x) => x.id === stockProduct.id ? updated as InventoryProduct : x));
      setStockProduct(updated as InventoryProduct);
      setAdjustForm({ movementType: 'purchase', quantity: '', reason: '' });
      success('Stock adjusted');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to adjust stock');
    } finally {
      setStockSaving(false);
    }
  };

  const handleSearch = () => setSearch(searchInput);

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <PageHeader title="Inventory" description="Manage products and stock levels" />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(['products', 'alerts'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {t === 'products' ? 'Products' : 'Low Stock Alerts'}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search by name or SKU…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="max-w-sm"
              />
              <Button variant="outline" size="sm" onClick={handleSearch}>
                <SearchIcon size={14} />
              </Button>
            </div>
            <Button variant="primary" size="sm" onClick={openAddProduct}>
              <PlusIcon size={14} className="mr-1" /> Add Product
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : products.length === 0 ? (
            <Card>
              <CardBody>
                <EmptyState
                  icon={<PackageIcon size={24} className="text-neutral-400" />}
                  title="No products yet"
                  description="Add your first inventory product to get started."
                />
                <div className="flex justify-center mt-4">
                  <Button variant="primary" size="sm" onClick={openAddProduct}>
                    <PlusIcon size={14} className="mr-1" /> Add Product
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody padding="none">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        {['Name / SKU', 'Unit', 'In Stock', 'Available', 'Reorder At', 'Status', ''].map((h, i) => (
                          <th key={i} className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${i >= 2 && i <= 4 ? 'text-right' : 'text-left'}`}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium text-neutral-900">{p.name}</div>
                            {p.sku && <div className="text-xs text-neutral-400 mt-0.5">SKU: {p.sku}</div>}
                          </td>
                          <td className="py-3 px-4 text-neutral-600 capitalize">{p.unitType}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-neutral-900">
                            {p.inventory ? p.inventory.currentStock.toFixed(2) : '—'}
                          </td>
                          <td className={`py-3 px-4 text-right tabular-nums font-medium ${
                            p.inventory && p.inventory.reorderLevel && p.inventory.availableStock <= p.inventory.reorderLevel
                              ? 'text-error-600' : 'text-neutral-700'
                          }`}>
                            {p.inventory ? p.inventory.availableStock.toFixed(2) : '—'}
                          </td>
                          <td className="py-3 px-4 text-right text-neutral-400 tabular-nums">
                            {p.inventory?.reorderLevel?.toFixed(2) ?? '—'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={STATUS_VARIANT[p.status] ?? 'default'} size="sm">{p.status}</Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2 justify-end">
                              <Button variant="ghost" size="sm" onClick={() => openStock(p)} className="text-xs">
                                Manage Stock
                              </Button>
                              <button onClick={() => openEditProduct(p)} className="p-1 rounded text-neutral-400 hover:text-primary-600 transition-colors">
                                <EditIcon size={14} />
                              </button>
                              <button onClick={() => archiveProduct(p)} className="p-1 rounded text-neutral-400 hover:text-error-600 transition-colors">
                                <TrashIcon size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}

      {tab === 'alerts' && (
        <AlertsTab storeId={storeId ?? ''} />
      )}

      {/* Add/Edit Product Modal */}
      <Modal
        isOpen={productModal}
        onClose={() => setProductModal(false)}
        title={editingProduct ? 'Edit Product' : 'Add Product'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setProductModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={productSaving} onClick={saveProduct}>
              {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Product Name *</label>
            <Input value={productForm.name} onChange={(e) => setProductForm({ ...productForm, name: e.target.value })} placeholder="e.g. Chicken Breast" autoFocus />
          </div>
          <div>
            <label className="field-label">SKU</label>
            <Input value={productForm.sku} onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })} placeholder="Optional" />
          </div>
          <div>
            <label className="field-label">Unit Type *</label>
            <select
              value={productForm.unitType}
              onChange={(e) => setProductForm({ ...productForm, unitType: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {UNIT_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input value={productForm.description} onChange={(e) => setProductForm({ ...productForm, description: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Modal>

      {/* Manage Stock Side Panel */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setStockProduct(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-semibold text-neutral-900">{stockProduct.name}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Current stock: <span className="font-semibold text-neutral-800">{stockProduct.inventory?.currentStock?.toFixed(2) ?? '0'} {stockProduct.unitType}</span>
                  {' · '}Available: <span className="font-semibold text-neutral-800">{stockProduct.inventory?.availableStock?.toFixed(2) ?? '0'}</span>
                </p>
              </div>
              <button onClick={() => setStockProduct(null)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors text-lg leading-none">&times;</button>
            </div>

            {/* Stock tabs */}
            <div className="flex border-b border-neutral-200 px-6">
              {(['set', 'adjust', 'history'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setStockTab(t)}
                  className={`py-3 px-3 text-sm font-medium capitalize border-b-2 -mb-px mr-2 transition-colors ${
                    stockTab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  {t === 'set' ? 'Set Stock' : t === 'adjust' ? 'Adjust' : 'History'}
                </button>
              ))}
            </div>

            <div className="p-6 flex-1">
              {stockTab === 'set' && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-500">Set the current stock level and reorder thresholds.</p>
                  <div>
                    <label className="field-label">Current Stock ({stockProduct.unitType})</label>
                    <Input type="number" min="0" step="0.01" value={setStockForm.currentStock} onChange={(e) => setSetStockForm({ ...setStockForm, currentStock: e.target.value })} />
                  </div>
                  <div>
                    <label className="field-label">Reorder Level (alert when stock falls below)</label>
                    <Input type="number" min="0" step="0.01" value={setStockForm.reorderLevel} onChange={(e) => setSetStockForm({ ...setStockForm, reorderLevel: e.target.value })} placeholder="Optional" />
                  </div>
                  <div>
                    <label className="field-label">Reorder Quantity (suggested order amount)</label>
                    <Input type="number" min="0" step="0.01" value={setStockForm.reorderQuantity} onChange={(e) => setSetStockForm({ ...setStockForm, reorderQuantity: e.target.value })} placeholder="Optional" />
                  </div>
                  <Button variant="primary" size="sm" loading={stockSaving} onClick={saveStock} className="w-full">
                    Save Stock Levels
                  </Button>
                </div>
              )}

              {stockTab === 'adjust' && (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-500">Record a stock movement to adjust the current level.</p>
                  <div>
                    <label className="field-label">Movement Type</label>
                    <select
                      value={adjustForm.movementType}
                      onChange={(e) => setAdjustForm({ ...adjustForm, movementType: e.target.value as MovementType })}
                      className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="purchase">Purchase (add stock)</option>
                      <option value="adjustment">Adjustment (set correction)</option>
                      <option value="waste">Waste (remove stock)</option>
                      <option value="return">Return (remove stock)</option>
                    </select>
                  </div>
                  <div>
                    <label className="field-label">Quantity ({stockProduct.unitType})</label>
                    <Input type="number" min="0.01" step="0.01" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} placeholder="Enter amount" />
                  </div>
                  <div>
                    <label className="field-label">Reason *</label>
                    <Input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} placeholder="e.g. Weekly delivery, Spoilage…" />
                  </div>
                  <Button
                    variant="primary" size="sm" loading={stockSaving}
                    onClick={saveAdjustment}
                    disabled={!adjustForm.quantity || !adjustForm.reason}
                    className="w-full"
                  >
                    Record Movement
                  </Button>
                </div>
              )}

              {stockTab === 'history' && (
                <div>
                  {movementsLoading ? (
                    <div className="flex justify-center py-8"><Spinner size="md" /></div>
                  ) : movements.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-8">No movements recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {movements.map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-2 border-b border-neutral-50 last:border-0">
                          <div>
                            <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded-full mr-2 ${
                              ['purchase', 'return'].includes(m.movementType) ? 'bg-success-50 text-success-700' : 'bg-error-50 text-error-700'
                            }`}>
                              {m.movementType}
                            </span>
                            {m.notes && <span className="text-xs text-neutral-500">{m.notes}</span>}
                            <div className="text-xs text-neutral-400 mt-0.5">{formatDistanceToNow(new Date(m.createdAt), { addSuffix: true })}</div>
                          </div>
                          <span className={`tabular-nums font-semibold text-sm ${m.quantity >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                            {m.quantity >= 0 ? '+' : ''}{m.quantity.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Alerts sub-component ────────────────────────────────────────────────────

const AlertsTab: React.FC<{ storeId: string }> = ({ storeId }) => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const { error: toastError } = useToast();

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    import('../api/dashboard').then(({ dashboardAPI }) =>
      dashboardAPI.getInventoryAlerts(storeId).then(setAlerts).catch(() => toastError('Failed to load alerts'))
    ).finally(() => setLoading(false));
  }, [storeId]);

  if (loading) return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;

  return alerts.length === 0 ? (
    <Card>
      <CardBody>
        <EmptyState
          icon={<AlertTriangleIcon size={20} className="text-success-600" />}
          title="All stock levels healthy"
          description="No low-stock alerts at this time."
        />
      </CardBody>
    </Card>
  ) : (
    <Card>
      <CardBody padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                {['Product', 'Status', 'Current', 'Reorder Level', 'Age'].map((h, i) => (
                  <th key={h} className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${i >= 2 && i <= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr key={alert.id} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50">
                  <td className="py-3.5 px-4 font-medium text-neutral-900">{alert.productName}</td>
                  <td className="py-3.5 px-4">
                    <Badge variant={alert.status === 'out_of_stock' ? 'error' : 'warning'} dot>
                      {alert.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-neutral-900 tabular-nums">{alert.currentStock}</td>
                  <td className="py-3.5 px-4 text-right text-neutral-500 tabular-nums">{alert.reorderLevel}</td>
                  <td className="py-3.5 px-4 text-xs text-neutral-400">{formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
};
