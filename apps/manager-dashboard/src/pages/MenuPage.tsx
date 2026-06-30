import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Button, Input, Badge, Modal, Spinner, useToast,
  PlusIcon, EditIcon, TrashIcon, UtensilsIcon, ChevronRightIcon,
} from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  menuAPI, inventoryAPI,
  type MenuRecord, type MenuCategory, type MenuItemRecord, type MenuItemIngredient, type InventoryProduct,
} from '../api/management';

export const MenuPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();

  const [menus, setMenus] = useState<MenuRecord[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuRecord | null>(null);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory | null>(null);
  const [items, setItems] = useState<MenuItemRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);

  // Inventory products for ingredient linking
  const [inventoryProducts, setInventoryProducts] = useState<InventoryProduct[]>([]);

  // Menu modal
  const [menuModal, setMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ name: '', description: '' });
  const [menuSaving, setMenuSaving] = useState(false);

  // Category modal
  const [categoryModal, setCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categorySaving, setCategorySaving] = useState(false);

  // Item modal
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRecord | null>(null);
  const [itemForm, setItemForm] = useState({ name: '', description: '', basePrice: '', taxRate: '5', sku: '' });
  const [itemSaving, setItemSaving] = useState(false);

  // Ingredients panel
  const [ingredientItem, setIngredientItem] = useState<MenuItemRecord | null>(null);
  const [ingredients, setIngredients] = useState<MenuItemIngredient[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({ inventoryProductId: '', quantity: '', unitType: 'piece' });
  const [ingredientSaving, setIngredientSaving] = useState(false);

  // Load menus
  useEffect(() => {
    if (!storeId) return;
    setLoading(true);
    menuAPI.listMenus(storeId)
      .then((list) => {
        setMenus(list);
        if (list.length > 0) setSelectedMenu(list[0]);
      })
      .catch(() => toastError('Failed to load menus'))
      .finally(() => setLoading(false));
  }, [storeId]);

  // Load inventory products for ingredient linking
  useEffect(() => {
    if (!storeId) return;
    inventoryAPI.listWithStock(storeId, { status: 'active', limit: 100 })
      .then((result) => setInventoryProducts((result as any).data ?? result))
      .catch(() => {});
  }, [storeId]);

  // Load categories when menu changes
  useEffect(() => {
    if (!selectedMenu) { setCategories([]); setSelectedCategory(null); return; }
    menuAPI.listCategories(selectedMenu.id)
      .then((list) => {
        setCategories(list);
        setSelectedCategory(list.length > 0 ? list[0] : null);
      })
      .catch(() => toastError('Failed to load categories'));
  }, [selectedMenu]);

  // Load items when category changes
  useEffect(() => {
    if (!selectedCategory) { setItems([]); return; }
    setItemsLoading(true);
    menuAPI.listItems(selectedCategory.id)
      .then(setItems)
      .catch(() => toastError('Failed to load items'))
      .finally(() => setItemsLoading(false));
  }, [selectedCategory]);

  // Load ingredients when ingredient panel opens
  const openIngredients = useCallback(async (item: MenuItemRecord) => {
    setIngredientItem(item);
    setIngredientsLoading(true);
    try {
      const list = await menuAPI.listIngredients(item.id);
      setIngredients(list);
    } catch {
      toastError('Failed to load ingredients');
    } finally {
      setIngredientsLoading(false);
    }
    setIngredientForm({ inventoryProductId: '', quantity: '', unitType: 'piece' });
  }, []);

  // ─── Menu CRUD ─────────────────────────────────────────────────────────────

  const saveMenu = async () => {
    if (!storeId || !menuForm.name.trim()) return;
    setMenuSaving(true);
    try {
      const menu = await menuAPI.createMenu({ storeId, name: menuForm.name, description: menuForm.description || undefined });
      setMenus((p) => [...p, menu]);
      setSelectedMenu(menu);
      setMenuModal(false);
      success('Menu created');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to create menu');
    } finally {
      setMenuSaving(false);
    }
  };

  // ─── Category CRUD ─────────────────────────────────────────────────────────

  const saveCategory = async () => {
    if (!storeId || !selectedMenu || !categoryForm.name.trim()) return;
    setCategorySaving(true);
    try {
      const cat = await menuAPI.createCategory(selectedMenu.id, { storeId, name: categoryForm.name, description: categoryForm.description || undefined });
      setCategories((p) => [...p, cat]);
      setSelectedCategory(cat);
      setCategoryModal(false);
      success('Category created');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to create category');
    } finally {
      setCategorySaving(false);
    }
  };

  // ─── Item CRUD ─────────────────────────────────────────────────────────────

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ name: '', description: '', basePrice: '', taxRate: '5', sku: '' });
    setItemModal(true);
  };

  const openEditItem = (item: MenuItemRecord) => {
    setEditingItem(item);
    setItemForm({
      name: item.name,
      description: item.description ?? '',
      basePrice: String(item.basePrice),
      taxRate: String(item.taxRate),
      sku: item.sku ?? '',
    });
    setItemModal(true);
  };

  const saveItem = async () => {
    if (!storeId || !selectedCategory || !itemForm.name.trim() || !itemForm.basePrice) return;
    setItemSaving(true);
    try {
      if (editingItem) {
        const updated = await menuAPI.updateItem(editingItem.id, {
          name: itemForm.name,
          description: itemForm.description || null,
          basePrice: parseFloat(itemForm.basePrice),
          taxRate: parseFloat(itemForm.taxRate) || 5,
          sku: itemForm.sku || null,
        });
        setItems((p) => p.map((x) => x.id === updated.id ? updated : x));
        success('Item updated');
      } else {
        const created = await menuAPI.createItem({
          categoryId: selectedCategory.id,
          storeId,
          name: itemForm.name,
          description: itemForm.description || undefined,
          basePrice: parseFloat(itemForm.basePrice),
          taxRate: parseFloat(itemForm.taxRate) || 5,
          sku: itemForm.sku || undefined,
        });
        setItems((p) => [...p, created]);
        success('Item added');
      }
      setItemModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to save item');
    } finally {
      setItemSaving(false);
    }
  };

  const deleteItem = async (item: MenuItemRecord) => {
    if (!confirm(`Remove "${item.name}" from this category?`)) return;
    try {
      await menuAPI.deleteItem(item.id);
      setItems((p) => p.filter((x) => x.id !== item.id));
      success('Item removed');
    } catch {
      toastError('Failed to remove item');
    }
  };

  // ─── Ingredients ───────────────────────────────────────────────────────────

  const addIngredient = async () => {
    if (!ingredientItem || !ingredientForm.inventoryProductId || !ingredientForm.quantity) return;
    setIngredientSaving(true);
    try {
      const ing = await menuAPI.addIngredient(ingredientItem.id, {
        inventoryProductId: ingredientForm.inventoryProductId,
        quantity: parseFloat(ingredientForm.quantity),
        unitType: ingredientForm.unitType,
      });
      setIngredients((p) => [...p.filter((x) => x.inventoryProductId !== ing.inventoryProductId), ing]);
      setIngredientForm({ inventoryProductId: '', quantity: '', unitType: 'piece' });
      success('Ingredient added');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to add ingredient');
    } finally {
      setIngredientSaving(false);
    }
  };

  const removeIngredient = async (ing: MenuItemIngredient) => {
    if (!ingredientItem) return;
    try {
      await menuAPI.removeIngredient(ingredientItem.id, ing.id);
      setIngredients((p) => p.filter((x) => x.id !== ing.id));
      success('Ingredient removed');
    } catch {
      toastError('Failed to remove ingredient');
    }
  };

  const getProductName = (productId: string) =>
    inventoryProducts.find((p) => p.id === productId)?.name ?? productId.slice(0, 8) + '…';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Menu Management" description="Manage menus, categories, items, and ingredient links" />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-[220px_220px_1fr] gap-4 min-h-[600px]">

          {/* Menus column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Menus</span>
              <button onClick={() => { setMenuForm({ name: '', description: '' }); setMenuModal(true); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors">
                <PlusIcon size={14} />
              </button>
            </div>
            {menus.length === 0 ? (
              <button onClick={() => { setMenuForm({ name: '', description: '' }); setMenuModal(true); }} className="w-full text-left p-3 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 text-sm hover:border-primary-300 transition-colors">
                + Add Menu
              </button>
            ) : (
              menus.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMenu(m)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    selectedMenu?.id === m.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <span className="truncate">{m.name}</span>
                  {m.isDefault && <Badge variant="default" size="sm">Default</Badge>}
                </button>
              ))
            )}
          </div>

          {/* Categories column */}
          <div className="border-l border-neutral-100 pl-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Categories</span>
              {selectedMenu && (
                <button onClick={() => { setCategoryForm({ name: '', description: '' }); setCategoryModal(true); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors">
                  <PlusIcon size={14} />
                </button>
              )}
            </div>
            {!selectedMenu ? (
              <p className="text-xs text-neutral-400 p-3">Select a menu first</p>
            ) : categories.length === 0 ? (
              <button onClick={() => { setCategoryForm({ name: '', description: '' }); setCategoryModal(true); }} className="w-full text-left p-3 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 text-sm hover:border-primary-300 transition-colors">
                + Add Category
              </button>
            ) : (
              categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategory(c)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center justify-between ${
                    selectedCategory?.id === c.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <ChevronRightIcon size={12} className="text-neutral-300 shrink-0" />
                </button>
              ))
            )}
          </div>

          {/* Items column */}
          <div className="border-l border-neutral-100 pl-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Items {selectedCategory ? `— ${selectedCategory.name}` : ''}
              </span>
              {selectedCategory && (
                <Button variant="primary" size="sm" onClick={openAddItem}>
                  <PlusIcon size={14} className="mr-1" /> Add Item
                </Button>
              )}
            </div>

            {!selectedCategory ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                <UtensilsIcon size={32} className="mb-2 text-neutral-300" />
                <p className="text-sm">Select a category to manage items</p>
              </div>
            ) : itemsLoading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                <UtensilsIcon size={28} className="mb-2 text-neutral-300" />
                <p className="text-sm mb-3">No items in this category</p>
                <Button variant="outline" size="sm" onClick={openAddItem}>
                  <PlusIcon size={14} className="mr-1" /> Add First Item
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-100 hover:border-neutral-200 hover:shadow-sm transition-all group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-neutral-900 text-sm">{item.name}</span>
                        {item.sku && <span className="text-xs text-neutral-400">SKU: {item.sku}</span>}
                        <Badge
                          variant={item.status === 'active' ? 'success' : item.status === 'sold_out' ? 'warning' : 'default'}
                          size="sm"
                        >
                          {item.status}
                        </Badge>
                      </div>
                      {item.description && <p className="text-xs text-neutral-500 mt-0.5 truncate">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-semibold text-neutral-800">
                          {Number(item.basePrice).toFixed(2)}
                        </span>
                        <span className="text-xs text-neutral-400">{item.taxRate}% tax</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openIngredients(item)}
                        className="px-2 py-1 text-xs rounded border border-neutral-200 text-neutral-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                      >
                        Ingredients
                      </button>
                      <button onClick={() => openEditItem(item)} className="p-1.5 rounded text-neutral-400 hover:text-primary-600 transition-colors">
                        <EditIcon size={13} />
                      </button>
                      <button onClick={() => deleteItem(item)} className="p-1.5 rounded text-neutral-400 hover:text-error-600 transition-colors">
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Menu Modal */}
      <Modal
        isOpen={menuModal}
        onClose={() => setMenuModal(false)}
        title="New Menu"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMenuModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={menuSaving} onClick={saveMenu}>Create Menu</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Menu Name *</label>
            <Input value={menuForm.name} onChange={(e) => setMenuForm({ ...menuForm, name: e.target.value })} placeholder="e.g. Lunch Menu, Dine-In Menu…" autoFocus />
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input value={menuForm.description} onChange={(e) => setMenuForm({ ...menuForm, description: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Modal>

      {/* Add Category Modal */}
      <Modal
        isOpen={categoryModal}
        onClose={() => setCategoryModal(false)}
        title="New Category"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCategoryModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={categorySaving} onClick={saveCategory}>Create Category</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Category Name *</label>
            <Input value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} placeholder="e.g. Starters, Mains, Desserts…" autoFocus />
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Modal>

      {/* Add/Edit Item Modal */}
      <Modal
        isOpen={itemModal}
        onClose={() => setItemModal(false)}
        title={editingItem ? 'Edit Item' : 'Add Item'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setItemModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={itemSaving} onClick={saveItem}>
              {editingItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Item Name *</label>
            <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Grilled Chicken" autoFocus />
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="field-label">Base Price *</label>
              <Input type="number" min="0.01" step="0.01" value={itemForm.basePrice} onChange={(e) => setItemForm({ ...itemForm, basePrice: e.target.value })} placeholder="0.00" />
            </div>
            <div>
              <label className="field-label">Tax Rate (%)</label>
              <Input type="number" min="0" max="100" step="0.1" value={itemForm.taxRate} onChange={(e) => setItemForm({ ...itemForm, taxRate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">SKU</label>
            <Input value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} placeholder="Optional" />
          </div>
        </div>
      </Modal>

      {/* Ingredients Side Panel */}
      {ingredientItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIngredientItem(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-semibold text-neutral-900">Ingredients</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{ingredientItem.name}</p>
              </div>
              <button onClick={() => setIngredientItem(null)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors text-lg leading-none">&times;</button>
            </div>

            <div className="p-6 space-y-6 flex-1">
              <p className="text-xs text-neutral-500">
                Ingredients listed here are automatically reserved when an order is placed and consumed when payment is completed.
              </p>

              {/* Current ingredients */}
              {ingredientsLoading ? (
                <div className="flex justify-center py-4"><Spinner size="md" /></div>
              ) : ingredients.length === 0 ? (
                <p className="text-sm text-neutral-400 text-center py-4">No ingredients linked yet.</p>
              ) : (
                <div className="space-y-2">
                  {ingredients.map((ing) => (
                    <div key={ing.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 group">
                      <div>
                        <span className="text-sm font-medium text-neutral-800">{getProductName(ing.inventoryProductId)}</span>
                        <span className="text-xs text-neutral-500 ml-2">× {ing.quantity} {ing.unitType}</span>
                      </div>
                      <button
                        onClick={() => removeIngredient(ing)}
                        className="p-1 rounded text-neutral-400 hover:text-error-600 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <TrashIcon size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add ingredient form */}
              <div className="border-t border-neutral-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Add Ingredient</p>
                <div>
                  <label className="field-label">Inventory Product</label>
                  <select
                    value={ingredientForm.inventoryProductId}
                    onChange={(e) => {
                      const product = inventoryProducts.find((p) => p.id === e.target.value);
                      setIngredientForm({ ...ingredientForm, inventoryProductId: e.target.value, unitType: product?.unitType ?? 'piece' });
                    }}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— Select product —</option>
                    {inventoryProducts.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} ({p.unitType})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Quantity per serving</label>
                    <Input type="number" min="0.001" step="0.001" value={ingredientForm.quantity} onChange={(e) => setIngredientForm({ ...ingredientForm, quantity: e.target.value })} placeholder="e.g. 0.2" />
                  </div>
                  <div>
                    <label className="field-label">Unit</label>
                    <Input value={ingredientForm.unitType} onChange={(e) => setIngredientForm({ ...ingredientForm, unitType: e.target.value })} placeholder="piece / kg / liter" />
                  </div>
                </div>
                <Button
                  variant="primary" size="sm"
                  loading={ingredientSaving}
                  disabled={!ingredientForm.inventoryProductId || !ingredientForm.quantity}
                  onClick={addIngredient}
                  className="w-full"
                >
                  <PlusIcon size={14} className="mr-1" /> Add Ingredient
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
