import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  PageHeader, Button, Input, Badge, Modal, Spinner, useToast, DietaryMark,
  PlusIcon, EditIcon, TrashIcon, UtensilsIcon, ChevronRightIcon, SearchIcon,
} from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  menuAPI, inventoryAPI,
  type MenuRecord, type MenuCategory, type MenuItemRecord, type MenuItemIngredient, type InventoryProduct,
  type ItemVariantRecord, type ModifierGroupRecord, type ModifierRecord,
} from '../api/management';

// ─── Types used by the import modal ─────────────────────────────────────────

interface ImportRow {
  menuName: string;
  categoryName: string;
  itemName: string;
  description: string;
  price: string;
  taxRate: string;
  sku: string;
  status: string;
  dietaryType: string;
  variants: string;
  modifierGroups: string;
  ingredients: string;
  _valid: boolean;
  _error?: string;
}

const COL_MAP: Record<string, keyof ImportRow> = {
  menu_name: 'menuName',
  category_name: 'categoryName',
  item_name: 'itemName',
  description: 'description',
  price: 'price',
  tax_rate: 'taxRate',
  sku: 'sku',
  status: 'status',
  dietary_type: 'dietaryType',
  veg_non_veg: 'dietaryType',
  variants: 'variants',
  modifier_groups: 'modifierGroups',
  ingredients: 'ingredients',
};

function parseSheetRows(sheet: XLSX.WorkSheet): ImportRow[] {
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return raw.map((r) => {
    const row: ImportRow = {
      menuName: '', categoryName: '', itemName: '', description: '',
      price: '', taxRate: '5', sku: '', status: 'active', dietaryType: '', variants: '', modifierGroups: '', ingredients: '', _valid: true,
    };
    for (const [key, val] of Object.entries(r)) {
      const norm = key.trim().toLowerCase().replace(/[\s/]+/g, '_');
      const field = COL_MAP[norm];
      if (field) (row as any)[field] = String(val ?? '').trim();
    }
    const errors: string[] = [];
    if (!row.menuName) errors.push('menu_name required');
    if (!row.categoryName) errors.push('category_name required');
    if (!row.itemName) errors.push('item_name required');
    const p = parseFloat(row.price);
    if (!row.price || isNaN(p) || p <= 0) errors.push('price must be a positive number');
    if (errors.length) { row._valid = false; row._error = errors.join('; '); }
    return row;
  });
}

// ─── Item Context Menu ────────────────────────────────────────────────────────

interface ItemContextMenuProps {
  item: MenuItemRecord;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onSetStatus: (s: string) => void;
  onToggleFeatured: () => void;
  onToggleRecommended: () => void;
  onHardDelete: () => void;
}

function ItemContextMenu({ item, onClose, onEdit, onDuplicate, onSetStatus, onToggleFeatured, onToggleRecommended, onHardDelete }: ItemContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const Act = ({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${danger ? 'text-error-600 hover:bg-error-50' : 'text-neutral-700 hover:bg-neutral-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-48 bg-white rounded-lg shadow-xl border border-neutral-200 py-1 overflow-hidden">
      <Act label="Edit" onClick={onEdit} />
      <Act label="Duplicate" onClick={onDuplicate} />
      <div className="my-1 border-t border-neutral-100" />
      <Act label={`${item.status === 'active' ? '✓ ' : ''}Available`} onClick={() => onSetStatus('active')} />
      <Act label={`${item.status === 'sold_out' ? '✓ ' : ''}Sold Out`} onClick={() => onSetStatus('sold_out')} />
      <Act label={`${item.status === 'inactive' ? '✓ ' : ''}Archive`} onClick={() => onSetStatus('inactive')} />
      <div className="my-1 border-t border-neutral-100" />
      {item.status === 'hidden' ? (
        <Act label="Show in POS" onClick={() => onSetStatus('active')} />
      ) : (
        <Act label="Hide from POS" onClick={() => onSetStatus('hidden')} />
      )}
      <div className="my-1 border-t border-neutral-100" />
      <Act label={`${item.isFeatured ? '★' : '☆'} Featured`} onClick={onToggleFeatured} />
      <Act label={`${item.isRecommended ? '✦' : '✧'} Recommended`} onClick={onToggleRecommended} />
      <div className="my-1 border-t border-neutral-100" />
      <Act label="Delete Permanently" onClick={onHardDelete} danger />
    </div>
  );
}

// ─── Category Context Menu ────────────────────────────────────────────────────

interface CatContextMenuProps {
  cat: MenuCategory;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onHide: () => void;
  onDelete: () => void;
}

function CatContextMenu({ cat, onClose, onEdit, onDuplicate, onArchive, onHide, onDelete }: CatContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const Act = ({ label, onClick, danger = false }: { label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={() => { onClick(); onClose(); }}
      className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${danger ? 'text-error-600 hover:bg-error-50' : 'text-neutral-700 hover:bg-neutral-50'}`}
    >
      {label}
    </button>
  );

  return (
    <div ref={ref} className="absolute right-0 top-8 z-50 w-44 bg-white rounded-lg shadow-xl border border-neutral-200 py-1 overflow-hidden">
      <Act label="Edit" onClick={onEdit} />
      <Act label="Duplicate" onClick={onDuplicate} />
      <div className="my-1 border-t border-neutral-100" />
      <Act label={`${cat.status === 'inactive' ? '✓ ' : ''}Archive`} onClick={onArchive} />
      <Act label={`${cat.status === 'hidden' ? '✓ ' : ''}Hide`} onClick={onHide} />
      <div className="my-1 border-t border-neutral-100" />
      <Act label="Delete" onClick={onDelete} danger />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

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
  const [editingMenu, setEditingMenu] = useState<MenuRecord | null>(null);
  const [menuForm, setMenuForm] = useState({ name: '', description: '' });
  const [menuSaving, setMenuSaving] = useState(false);

  // Category modal
  const [categoryModal, setCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<MenuCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [categorySaving, setCategorySaving] = useState(false);

  // Item modal
  const [itemModal, setItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItemRecord | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '', description: '', basePrice: '', taxRate: '5', sku: '',
    status: 'active', isFeatured: false, isRecommended: false, hideOnline: false,
    availableFromTime: '', availableToTime: '', dietaryType: '' as '' | 'veg' | 'non_veg',
  });
  const [itemSaving, setItemSaving] = useState(false);

  // Bulk import modal
  const [importModal, setImportModal] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importDragging, setImportDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: { menus: number; categories: number; items: number; variants: number; modifierGroups: number; modifiers: number; ingredients: number }; skipped: number; errors: Array<{ row: number; message: string }> } | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Drag-and-drop
  const [dragCatId, setDragCatId] = useState<string | null>(null);
  const [dragOverCatId, setDragOverCatId] = useState<string | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Context menus
  const [itemContextMenuId, setItemContextMenuId] = useState<string | null>(null);
  const [catContextMenuId, setCatContextMenuId] = useState<string | null>(null);

  // Bulk selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Search
  const [itemSearch, setItemSearch] = useState('');

  // Ingredients panel
  const [ingredientItem, setIngredientItem] = useState<MenuItemRecord | null>(null);
  const [ingredients, setIngredients] = useState<MenuItemIngredient[]>([]);
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientForm, setIngredientForm] = useState({ inventoryProductId: '', quantity: '', unitType: 'piece' });
  const [ingredientSaving, setIngredientSaving] = useState(false);

  // Options panel (variants + modifier groups)
  const [optionsItem, setOptionsItem] = useState<MenuItemRecord | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [variants, setVariants] = useState<ItemVariantRecord[]>([]);
  const [modifierGroups, setModifierGroups] = useState<ModifierGroupRecord[]>([]);
  const [variantForm, setVariantForm] = useState({ name: '', price: '', sku: '' });
  const [variantSaving, setVariantSaving] = useState(false);
  const [groupForm, setGroupForm] = useState<{ name: string; selectionType: 'single' | 'multiple'; minSelections: string; maxSelections: string; isRequired: boolean }>({
    name: '', selectionType: 'single', minSelections: '0', maxSelections: '1', isRequired: false,
  });
  const [groupSaving, setGroupSaving] = useState(false);
  const [modifierForms, setModifierForms] = useState<Record<string, { name: string; priceAdjustment: string }>>({});
  const [modifierSavingGroupId, setModifierSavingGroupId] = useState<string | null>(null);

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

  // Load variants + modifier groups when options panel opens
  const openOptions = useCallback(async (item: MenuItemRecord) => {
    setOptionsItem(item);
    setOptionsLoading(true);
    try {
      const detail = await menuAPI.getItem(item.id);
      setVariants(detail.variants ?? []);
      setModifierGroups(detail.modifierGroups ?? []);
    } catch {
      toastError('Failed to load options');
    } finally {
      setOptionsLoading(false);
    }
    setVariantForm({ name: '', price: '', sku: '' });
    setGroupForm({ name: '', selectionType: 'single', minSelections: '0', maxSelections: '1', isRequired: false });
    setModifierForms({});
  }, []);

  // ─── Menu CRUD ─────────────────────────────────────────────────────────────

  const saveMenu = async () => {
    if (!storeId || !menuForm.name.trim()) return;
    setMenuSaving(true);
    try {
      if (editingMenu) {
        const updated = await menuAPI.updateMenu(editingMenu.id, {
          name: menuForm.name,
          description: menuForm.description || undefined,
        });
        setMenus((p) => p.map((m) => m.id === updated.id ? updated : m));
        if (selectedMenu?.id === updated.id) setSelectedMenu(updated);
        success('Menu updated');
      } else {
        const menu = await menuAPI.createMenu({ storeId, name: menuForm.name, description: menuForm.description || undefined });
        setMenus((p) => [...p, menu]);
        setSelectedMenu(menu);
        success('Menu created');
      }
      setMenuModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to save menu');
    } finally {
      setMenuSaving(false);
    }
  };

  const deleteMenu = async (menu: MenuRecord) => {
    if (!confirm(`Remove menu "${menu.name}" and all its categories and items?`)) return;
    try {
      await menuAPI.deleteMenu(menu.id);
      const remaining = menus.filter((m) => m.id !== menu.id);
      setMenus(remaining);
      if (selectedMenu?.id === menu.id) {
        setSelectedMenu(remaining[0] ?? null);
      }
      success('Menu removed');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to remove menu');
    }
  };

  // ─── Category CRUD ─────────────────────────────────────────────────────────

  const saveCategory = async () => {
    if (!storeId || !selectedMenu || !categoryForm.name.trim()) return;
    setCategorySaving(true);
    try {
      if (editingCategory) {
        const updated = await menuAPI.updateCategory(selectedMenu.id, editingCategory.id, {
          name: categoryForm.name,
          description: categoryForm.description || undefined,
        });
        setCategories((p) => p.map((c) => c.id === updated.id ? updated : c));
        if (selectedCategory?.id === updated.id) setSelectedCategory(updated);
        success('Category updated');
      } else {
        const cat = await menuAPI.createCategory(selectedMenu.id, { storeId, name: categoryForm.name, description: categoryForm.description || undefined });
        setCategories((p) => [...p, cat]);
        setSelectedCategory(cat);
        success('Category created');
      }
      setCategoryModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to save category');
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (cat: MenuCategory) => {
    if (!selectedMenu) return;
    if (!confirm(`Remove category "${cat.name}" and all its items?`)) return;
    try {
      await menuAPI.deleteCategory(selectedMenu.id, cat.id);
      const remaining = categories.filter((c) => c.id !== cat.id);
      setCategories(remaining);
      if (selectedCategory?.id === cat.id) {
        setSelectedCategory(remaining[0] ?? null);
      }
      success('Category removed');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to remove category');
    }
  };

  // ─── Item CRUD ─────────────────────────────────────────────────────────────

  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({ name: '', description: '', basePrice: '', taxRate: '5', sku: '', status: 'active', isFeatured: false, isRecommended: false, hideOnline: false, availableFromTime: '', availableToTime: '', dietaryType: '' });
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
      status: item.status,
      isFeatured: item.isFeatured,
      isRecommended: item.isRecommended ?? false,
      hideOnline: item.hideOnline ?? false,
      availableFromTime: item.availableFromTime ?? '',
      availableToTime: item.availableToTime ?? '',
      dietaryType: item.dietaryType ?? '',
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
          status: itemForm.status,
          isFeatured: itemForm.isFeatured,
          isRecommended: itemForm.isRecommended,
          hideOnline: itemForm.hideOnline,
          availableFromTime: itemForm.availableFromTime || null,
          availableToTime: itemForm.availableToTime || null,
          dietaryType: itemForm.dietaryType || null,
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
          dietaryType: itemForm.dietaryType || undefined,
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

  // ─── Drag & Drop ───────────────────────────────────────────────────────────

  const handleDropCategory = useCallback(async (overCatId: string) => {
    if (!dragCatId || dragCatId === overCatId || !selectedMenu) return;
    const from = categories.findIndex((c) => c.id === dragCatId);
    const to = categories.findIndex((c) => c.id === overCatId);
    if (from === -1 || to === -1) return;
    const reordered = [...categories];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setCategories(reordered);
    setDragCatId(null); setDragOverCatId(null);
    try {
      await menuAPI.reorderCategories(selectedMenu.id, reordered.map((c, i) => ({ id: c.id, displayOrder: i })));
    } catch { toastError('Failed to save category order'); }
  }, [dragCatId, categories, selectedMenu]);

  const handleDropItem = useCallback(async (overItemId: string) => {
    if (!dragItemId || dragItemId === overItemId) return;
    const from = items.findIndex((i) => i.id === dragItemId);
    const to = items.findIndex((i) => i.id === overItemId);
    if (from === -1 || to === -1) return;
    const reordered = [...items];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setItems(reordered);
    setDragItemId(null); setDragOverItemId(null);
    try {
      await menuAPI.reorderItems(reordered.map((item, i) => ({ id: item.id, sortOrder: i })));
    } catch { toastError('Failed to save item order'); }
  }, [dragItemId, items]);

  // ─── Item Quick Actions ─────────────────────────────────────────────────────

  const handleSetItemStatus = useCallback(async (item: MenuItemRecord, status: string) => {
    try {
      const updated = await menuAPI.updateItemStatus(item.id, status);
      setItems((p) => p.map((i) => i.id === updated.id ? updated : i));
      success('Item updated');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? e?.message ?? 'Failed to update status');
    }
  }, []);

  const handleDuplicateItem = useCallback(async (item: MenuItemRecord) => {
    try {
      const copy = await menuAPI.duplicateItem(item.id);
      setItems((p) => [...p, copy]);
      success(`"${item.name}" duplicated`);
    } catch { toastError('Failed to duplicate item'); }
  }, []);

  const handleHardDeleteItem = useCallback(async (item: MenuItemRecord) => {
    if (!confirm(`Permanently delete "${item.name}"? This cannot be undone.`)) return;
    try {
      await menuAPI.hardDeleteItem(item.id);
      setItems((p) => p.filter((i) => i.id !== item.id));
      success('Item permanently deleted');
    } catch { toastError('Failed to delete item'); }
  }, []);

  const handleToggleFeatured = useCallback(async (item: MenuItemRecord) => {
    try {
      const updated = await menuAPI.updateItem(item.id, { isFeatured: !item.isFeatured });
      setItems((p) => p.map((i) => i.id === updated.id ? updated : i));
    } catch { toastError('Failed to update item'); }
  }, []);

  const handleToggleRecommended = useCallback(async (item: MenuItemRecord) => {
    try {
      const updated = await menuAPI.updateItem(item.id, { isRecommended: !item.isRecommended });
      setItems((p) => p.map((i) => i.id === updated.id ? updated : i));
    } catch { toastError('Failed to update item'); }
  }, []);

  // ─── Category Quick Actions ─────────────────────────────────────────────────

  const handleDuplicateCategory = useCallback(async (cat: MenuCategory) => {
    if (!selectedMenu) return;
    try {
      const result = await menuAPI.duplicateCategory(selectedMenu.id, cat.id);
      setCategories((p) => [...p, result.category]);
      success(`"${cat.name}" duplicated`);
    } catch { toastError('Failed to duplicate category'); }
  }, [selectedMenu]);

  const handleArchiveCategory = useCallback(async (cat: MenuCategory) => {
    if (!selectedMenu) return;
    try {
      const updated = await menuAPI.updateCategory(selectedMenu.id, cat.id, { status: 'inactive' });
      setCategories((p) => p.map((c) => c.id === updated.id ? updated : c));
      success('Category archived');
    } catch { toastError('Failed to archive category'); }
  }, [selectedMenu]);

  const handleHideCategory = useCallback(async (cat: MenuCategory) => {
    if (!selectedMenu) return;
    try {
      const updated = await menuAPI.updateCategory(selectedMenu.id, cat.id, { status: 'hidden' });
      setCategories((p) => p.map((c) => c.id === updated.id ? updated : c));
      success('Category hidden');
    } catch { toastError('Failed to hide category'); }
  }, [selectedMenu]);

  // ─── Bulk Actions ───────────────────────────────────────────────────────────

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(async (action: 'active' | 'sold_out' | 'hidden' | 'inactive' | 'delete') => {
    const ids = [...selectedItemIds];
    if (ids.length === 0) return;
    if (action === 'delete') {
      if (!confirm(`Permanently delete ${ids.length} item(s)? This cannot be undone.`)) return;
      try {
        await Promise.all(ids.map((id) => menuAPI.hardDeleteItem(id)));
        setItems((p) => p.filter((i) => !ids.includes(i.id)));
        setSelectedItemIds(new Set());
        setBulkMode(false);
        success(`${ids.length} item(s) deleted`);
      } catch { toastError('Bulk delete failed'); }
    } else {
      try {
        await menuAPI.bulkUpdateItemStatus({ ids, status: action });
        setItems((p) => p.map((i) => ids.includes(i.id) ? { ...i, status: action } : i));
        setSelectedItemIds(new Set());
        setBulkMode(false);
        success(`${ids.length} item(s) updated`);
      } catch { toastError('Bulk update failed'); }
    }
  }, [selectedItemIds]);

  // ─── Filtered items (search) ────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      (i.sku ?? '').toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q),
    );
  }, [items, itemSearch]);

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

  // ─── Variants + Modifier Groups ────────────────────────────────────────────

  const addVariant = async () => {
    if (!optionsItem || !variantForm.name || !variantForm.price) return;
    setVariantSaving(true);
    try {
      const v = await menuAPI.addVariant(optionsItem.id, {
        name: variantForm.name,
        price: parseFloat(variantForm.price),
        sku: variantForm.sku || undefined,
      });
      setVariants((p) => [...p, v]);
      setVariantForm({ name: '', price: '', sku: '' });
      success('Variant added');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to add variant');
    } finally {
      setVariantSaving(false);
    }
  };

  const removeVariant = async (v: ItemVariantRecord) => {
    if (!optionsItem) return;
    try {
      await menuAPI.removeVariant(optionsItem.id, v.id);
      setVariants((p) => p.filter((x) => x.id !== v.id));
      success('Variant removed');
    } catch {
      toastError('Failed to remove variant');
    }
  };

  const addModifierGroup = async () => {
    if (!optionsItem || !groupForm.name) return;
    setGroupSaving(true);
    try {
      const g = await menuAPI.createModifierGroup(optionsItem.id, {
        storeId: optionsItem.storeId,
        name: groupForm.name,
        selectionType: groupForm.selectionType,
        minSelections: parseInt(groupForm.minSelections, 10) || 0,
        maxSelections: parseInt(groupForm.maxSelections, 10) || 1,
        isRequired: groupForm.isRequired,
      });
      setModifierGroups((p) => [...p, g]);
      setGroupForm({ name: '', selectionType: 'single', minSelections: '0', maxSelections: '1', isRequired: false });
      success('Option group added');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to add option group');
    } finally {
      setGroupSaving(false);
    }
  };

  const removeModifierGroup = async (g: ModifierGroupRecord) => {
    if (!optionsItem) return;
    if (!confirm(`Delete "${g.name}" and all its options?`)) return;
    try {
      await menuAPI.deleteModifierGroup(optionsItem.id, g.id);
      setModifierGroups((p) => p.filter((x) => x.id !== g.id));
      success('Option group removed');
    } catch {
      toastError('Failed to remove option group');
    }
  };

  const addModifier = async (group: ModifierGroupRecord) => {
    if (!optionsItem) return;
    const form = modifierForms[group.id];
    if (!form?.name) return;
    setModifierSavingGroupId(group.id);
    try {
      const m = await menuAPI.addModifier(optionsItem.id, group.id, {
        name: form.name,
        priceAdjustment: form.priceAdjustment ? parseFloat(form.priceAdjustment) : 0,
      });
      setModifierGroups((p) => p.map((x) => x.id === group.id ? { ...x, modifiers: [...x.modifiers, m] } : x));
      setModifierForms((p) => ({ ...p, [group.id]: { name: '', priceAdjustment: '' } }));
      success('Option added');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to add option');
    } finally {
      setModifierSavingGroupId(null);
    }
  };

  const removeModifier = async (group: ModifierGroupRecord, modifier: ModifierRecord) => {
    if (!optionsItem) return;
    try {
      await menuAPI.removeModifier(optionsItem.id, group.id, modifier.id);
      setModifierGroups((p) => p.map((x) => x.id === group.id ? { ...x, modifiers: x.modifiers.filter((m) => m.id !== modifier.id) } : x));
      success('Option removed');
    } catch {
      toastError('Failed to remove option');
    }
  };

  // ─── Bulk Import ───────────────────────────────────────────────────────────

  const openImportModal = () => {
    setImportRows([]);
    setImportFileName('');
    setImportResult(null);
    setImportModal(true);
  };

  const processImportFile = (file: File) => {
    setImportFileName(file.name);
    setImportResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        setImportRows(parseSheetRows(sheet));
      } catch {
        toastError('Could not parse file. Please use CSV or XLSX format.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleImportFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setImportDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  };

  const handleImportFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImportFile(file);
    e.target.value = '';
  };

  const runImport = async () => {
    if (!storeId) return;
    const validRows = importRows.filter((r) => r._valid);
    if (validRows.length === 0) return;
    setImporting(true);
    try {
      const result = await menuAPI.bulkImport({
        storeId,
        rows: validRows.map((r) => ({
          menuName: r.menuName,
          categoryName: r.categoryName,
          itemName: r.itemName,
          description: r.description || undefined,
          price: parseFloat(r.price),
          taxRate: r.taxRate ? parseFloat(r.taxRate) : 5,
          sku: r.sku || undefined,
          status: r.status || 'active',
          dietaryType: r.dietaryType || undefined,
          variants: r.variants || undefined,
          modifierGroups: r.modifierGroups || undefined,
          ingredients: r.ingredients || undefined,
        })),
      });
      setImportResult(result);
      // Refresh menus list
      const list = await menuAPI.listMenus(storeId);
      setMenus(list);
      if (list.length > 0 && !selectedMenu) setSelectedMenu(list[0]);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // One consistent menu_name across every row — a single restaurant
    // normally needs one menu with many categories, not several separate
    // menus (Lunch Menu / Dinner Menu / ...) that just fragment the same
    // catalog. Rows below cover every combination an owner will hit: a
    // plain item, ingredients-only, ingredients + option groups, and the
    // full combo (ingredients + variants + option groups) on one item.
    const ws = XLSX.utils.aoa_to_sheet([
      ['menu_name', 'category_name', 'item_name', 'description', 'price', 'tax_rate', 'sku', 'status', 'dietary_type', 'variants', 'modifier_groups', 'ingredients'],
      ['Main Menu', 'Breads', 'Butter Naan', 'Fresh from the tandoor', '8', '5', 'BN001', 'active', 'veg', '', '', 'Flour:150:g|Butter:15:g|Salt:3:g|Water:90:ml'],
      [
        'Main Menu', 'Curries', 'Paneer Butter Masala', 'Paneer in rich tomato gravy', '36', '5', 'PBM001', 'active', 'veg',
        '',
        'Spice Level:single:1:1:Mild,Medium,Hot,Extra Hot|Bread Choice:single:0:1:Naan,Butter Naan,Garlic Naan,Roti',
        'Paneer:200:g|Tomato Puree:120:g|Butter:25:g|Cream:30:ml',
      ],
      [
        'Main Menu', 'Pizza', 'Margherita Pizza', 'Classic mozzarella pizza', '42', '5', 'MAR001', 'active', 'veg',
        'Large:55|Medium:42|Small:33',
        'Toppings:multiple:0:3:Extra Cheese,Olives,Mushrooms,Basil',
        'Pizza Dough:250:g|Pizza Sauce:70:g|Mozzarella:130:g|Basil:5:g',
      ],
      ['Main Menu', 'Mains', 'Grilled Chicken', 'With salad and fries', '32', '5', 'GC001', 'active', 'non_veg', '', '', 'Chicken Breast:250:g|Olive Oil:10:ml|Garlic:5:g|Herbs:3:g'],
      [
        'Main Menu', 'Beverages', 'Cappuccino', 'Espresso with steamed milk', '18', '5', 'CAP001', 'active', '',
        'Large:23|Medium:18|Small:14',
        'Milk Choice:single:1:1:Whole,Skim,Soy,Almond,Oat',
        'Espresso:30:ml|Milk:180:ml',
      ],
      [
        'Main Menu', 'Soft Drinks', 'Cola', '330ml', '8', '5', 'COLA001', 'active', '',
        '1L:26|500ml:14|250ml:8',
        '',
        'Cola Syrup:30:ml|Carbonated Water:300:ml',
      ],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Menu Import');
    XLSX.writeFile(wb, 'Menu_Import_Template.xlsx');
  };

  const getProductName = (productId: string) =>
    inventoryProducts.find((p) => p.id === productId)?.name ?? productId.slice(0, 8) + '…';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader title="Menu Management" description="Manage menus, categories, items, and ingredient links" />
        <Button variant="outline" size="sm" onClick={openImportModal}>
          Import CSV / Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-[220px_220px_1fr] gap-4 min-h-[600px]">

          {/* Menus column */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Menus</span>
              <button onClick={() => { setEditingMenu(null); setMenuForm({ name: '', description: '' }); setMenuModal(true); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors">
                <PlusIcon size={14} />
              </button>
            </div>
            {menus.length === 0 ? (
              <button onClick={() => { setEditingMenu(null); setMenuForm({ name: '', description: '' }); setMenuModal(true); }} className="w-full text-left p-3 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 text-sm hover:border-primary-300 transition-colors">
                + Add Menu
              </button>
            ) : (
              menus.map((m) => (
                <div
                  key={m.id}
                  className={`group w-full flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm transition-colors cursor-pointer ${
                    selectedMenu?.id === m.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  }`}
                  onClick={() => setSelectedMenu(m)}
                >
                  <span className="flex-1 truncate">{m.name}</span>
                  {m.isDefault && <Badge variant="default" size="sm">Default</Badge>}
                  <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingMenu(m); setMenuForm({ name: m.name, description: m.description ?? '' }); setMenuModal(true); }}
                      className="p-1 rounded text-neutral-400 hover:text-primary-600 transition-colors"
                      title="Edit menu"
                    >
                      <EditIcon size={12} />
                    </button>
                    <button
                      onClick={() => deleteMenu(m)}
                      className="p-1 rounded text-neutral-400 hover:text-error-600 transition-colors"
                      title="Remove menu"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Categories column */}
          <div className="border-l border-neutral-100 pl-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Categories</span>
              {selectedMenu && (
                <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '' }); setCategoryModal(true); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary-600 transition-colors">
                  <PlusIcon size={14} />
                </button>
              )}
            </div>
            {!selectedMenu ? (
              <p className="text-xs text-neutral-400 p-3">Select a menu first</p>
            ) : categories.length === 0 ? (
              <button onClick={() => { setEditingCategory(null); setCategoryForm({ name: '', description: '' }); setCategoryModal(true); }} className="w-full text-left p-3 rounded-lg border-2 border-dashed border-neutral-200 text-neutral-400 text-sm hover:border-primary-300 transition-colors">
                + Add Category
              </button>
            ) : (
              categories.map((c) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={() => setDragCatId(c.id)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverCatId(c.id); }}
                  onDrop={() => handleDropCategory(c.id)}
                  onDragEnd={() => { setDragCatId(null); setDragOverCatId(null); }}
                  onClick={() => setSelectedCategory(c)}
                  className={`relative group w-full flex items-center gap-1 px-3 py-2.5 rounded-lg text-sm transition-all cursor-grab active:cursor-grabbing ${
                    selectedCategory?.id === c.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'hover:bg-neutral-50 text-neutral-700'
                  } ${c.status === 'inactive' ? 'opacity-60' : ''} ${
                    dragOverCatId === c.id && dragCatId !== c.id ? 'ring-2 ring-primary-400 ring-inset' : ''
                  }`}
                >
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.status !== 'active' && (
                    <Badge variant={c.status === 'hidden' ? 'info' : 'default'} size="sm">
                      {c.status === 'inactive' ? 'arch' : 'hid'}
                    </Badge>
                  )}
                  <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => { setEditingCategory(c); setCategoryForm({ name: c.name, description: c.description ?? '' }); setCategoryModal(true); }}
                      className="p-1 rounded text-neutral-400 hover:text-primary-600 transition-colors"
                      title="Edit category"
                    >
                      <EditIcon size={12} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setCatContextMenuId(catContextMenuId === c.id ? null : c.id); }}
                      className="p-1 rounded text-neutral-400 hover:text-neutral-700 transition-colors font-bold leading-none"
                      title="More actions"
                    >
                      ⋮
                    </button>
                    {catContextMenuId === c.id && (
                      <CatContextMenu
                        cat={c}
                        onClose={() => setCatContextMenuId(null)}
                        onEdit={() => { setEditingCategory(c); setCategoryForm({ name: c.name, description: c.description ?? '' }); setCategoryModal(true); }}
                        onDuplicate={() => handleDuplicateCategory(c)}
                        onArchive={() => handleArchiveCategory(c)}
                        onHide={() => handleHideCategory(c)}
                        onDelete={() => deleteCategory(c)}
                      />
                    )}
                  </span>
                  <ChevronRightIcon size={12} className="text-neutral-300 shrink-0 group-hover:hidden" />
                </div>
              ))
            )}
          </div>

          {/* Items column */}
          <div className="border-l border-neutral-100 pl-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                Items {selectedCategory ? `— ${selectedCategory.name}` : ''}
              </span>
              {selectedCategory && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setBulkMode((b) => !b); setSelectedItemIds(new Set()); }}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      bulkMode ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-neutral-200 text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    {bulkMode ? 'Cancel' : 'Select'}
                  </button>
                  <Button variant="primary" size="sm" icon={<PlusIcon size={14} />} onClick={openAddItem}>
                    Add Item
                  </Button>
                </div>
              )}
            </div>

            {/* Search */}
            {selectedCategory && (
              <div className="mb-2">
                <Input
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  placeholder="Search items…"
                  icon={<SearchIcon size={14} />}
                />
              </div>
            )}

            {/* Bulk action bar */}
            {bulkMode && selectedItemIds.size > 0 && (
              <div className="mb-2 p-2 bg-primary-50 border border-primary-200 rounded-lg flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-primary-700">{selectedItemIds.size} selected</span>
                <div className="flex-1" />
                <button onClick={() => handleBulkAction('active')} className="text-xs px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Activate</button>
                <button onClick={() => handleBulkAction('sold_out')} className="text-xs px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Sold Out</button>
                <button onClick={() => handleBulkAction('hidden')} className="text-xs px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Hide</button>
                <button onClick={() => handleBulkAction('inactive')} className="text-xs px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Archive</button>
                <button onClick={() => handleBulkAction('delete')} className="text-xs px-2 py-1 bg-error-50 border border-error-200 text-error-700 rounded hover:bg-error-100">Delete</button>
              </div>
            )}

            {!selectedCategory ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                <UtensilsIcon size={32} className="mb-2 text-neutral-300" />
                <p className="text-sm">Select a category to manage items</p>
              </div>
            ) : itemsLoading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-neutral-400">
                <UtensilsIcon size={28} className="mb-2 text-neutral-300" />
                <p className="text-sm mb-3">{itemSearch ? 'No items match your search' : 'No items in this category'}</p>
                {!itemSearch && (
                  <Button variant="outline" size="sm" icon={<PlusIcon size={14} />} onClick={openAddItem}>
                    Add First Item
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    draggable={!bulkMode}
                    onDragStart={() => setDragItemId(item.id)}
                    onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                    onDrop={() => handleDropItem(item.id)}
                    onDragEnd={() => { setDragItemId(null); setDragOverItemId(null); }}
                    className={`relative flex items-center gap-3 p-3 rounded-lg border-l-4 transition-all group ${
                      item.status === 'active' ? 'border-l-success-400' :
                      item.status === 'sold_out' ? 'border-l-warning-400' :
                      item.status === 'hidden' ? 'border-l-info-400' :
                      'border-l-neutral-300'
                    } ${
                      dragOverItemId === item.id && dragItemId !== item.id
                        ? 'border border-primary-300 bg-primary-50/50 shadow-sm'
                        : 'border border-neutral-100 hover:border-neutral-200 hover:shadow-sm'
                    } ${item.status === 'inactive' ? 'opacity-60' : ''} ${!bulkMode ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  >
                    {bulkMode && (
                      <input
                        type="checkbox"
                        checked={selectedItemIds.has(item.id)}
                        onChange={() => toggleItemSelection(item.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="shrink-0 w-4 h-4 rounded accent-primary-600 cursor-pointer"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.dietaryType && <DietaryMark type={item.dietaryType} size={14} />}
                        <span className="font-medium text-neutral-900 text-sm">{item.name}</span>
                        {item.sku && <span className="text-xs text-neutral-400">SKU: {item.sku}</span>}
                        <Badge
                          variant={item.status === 'active' ? 'success' : item.status === 'sold_out' ? 'warning' : item.status === 'hidden' ? 'info' : 'default'}
                          size="sm"
                        >
                          {item.status === 'inactive' ? 'archived' : item.status.replace('_', ' ')}
                        </Badge>
                        {item.isFeatured && <span className="text-amber-400 text-xs" title="Featured">★</span>}
                        {item.isRecommended && <span className="text-blue-400 text-xs" title="Recommended">✦</span>}
                        {item.hideOnline && <Badge variant="default" size="sm">web hidden</Badge>}
                      </div>
                      {item.description && <p className="text-xs text-neutral-500 mt-0.5 truncate">{item.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-sm font-semibold text-neutral-800">{Number(item.basePrice).toFixed(2)}</span>
                        <span className="text-xs text-neutral-400">{item.taxRate}% tax</span>
                        {item.availableFromTime && item.availableToTime && (
                          <span className="text-xs text-neutral-400">{item.availableFromTime.slice(0, 5)}–{item.availableToTime.slice(0, 5)}</span>
                        )}
                      </div>
                    </div>
                    {!bulkMode && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); openIngredients(item); }}
                          className="px-2 py-1 text-xs rounded border border-neutral-200 text-neutral-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                        >
                          Ingredients
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); openOptions(item); }}
                          className="px-2 py-1 text-xs rounded border border-neutral-200 text-neutral-600 hover:border-primary-400 hover:text-primary-600 transition-colors"
                        >
                          Options
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEditItem(item); }} className="p-1.5 rounded text-neutral-400 hover:text-primary-600 transition-colors">
                          <EditIcon size={13} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setItemContextMenuId(itemContextMenuId === item.id ? null : item.id); }}
                          className="p-1.5 rounded text-neutral-400 hover:text-neutral-700 transition-colors font-bold text-sm leading-none"
                        >
                          ⋮
                        </button>
                        {itemContextMenuId === item.id && (
                          <ItemContextMenu
                            item={item}
                            onClose={() => setItemContextMenuId(null)}
                            onEdit={() => { setItemContextMenuId(null); openEditItem(item); }}
                            onDuplicate={() => handleDuplicateItem(item)}
                            onSetStatus={(s) => handleSetItemStatus(item, s)}
                            onToggleFeatured={() => handleToggleFeatured(item)}
                            onToggleRecommended={() => handleToggleRecommended(item)}
                            onHardDelete={() => handleHardDeleteItem(item)}
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add / Edit Menu Modal */}
      <Modal
        isOpen={menuModal}
        onClose={() => setMenuModal(false)}
        title={editingMenu ? 'Edit Menu' : 'New Menu'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setMenuModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={menuSaving} onClick={saveMenu}>
              {editingMenu ? 'Save Changes' : 'Create Menu'}
            </Button>
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

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={categoryModal}
        onClose={() => setCategoryModal(false)}
        title={editingCategory ? 'Edit Category' : 'New Category'}
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCategoryModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={categorySaving} onClick={saveCategory}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
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
          <div>
            <label className="field-label">Dietary Type</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: '', label: 'Unset' },
                { value: 'veg', label: 'Veg' },
                { value: 'non_veg', label: 'Non-Veg' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setItemForm({ ...itemForm, dietaryType: opt.value })}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    itemForm.dietaryType === opt.value
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
                  }`}
                >
                  {opt.value && <DietaryMark type={opt.value} size={13} />}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          {editingItem && (
            <div>
              <label className="field-label">Status</label>
              <select
                value={itemForm.status}
                onChange={(e) => setItemForm({ ...itemForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="active">Active</option>
                <option value="sold_out">Sold Out</option>
                <option value="hidden">Hidden from POS</option>
                <option value="inactive">Archived</option>
              </select>
            </div>
          )}
          <div className="space-y-2 pt-1 border-t border-neutral-100">
            <label className="field-label">Options</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={itemForm.isFeatured} onChange={(e) => setItemForm({ ...itemForm, isFeatured: e.target.checked })} className="accent-primary-600" />
              <span className="text-sm text-neutral-700">Featured item <span className="text-amber-400">★</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={itemForm.isRecommended} onChange={(e) => setItemForm({ ...itemForm, isRecommended: e.target.checked })} className="accent-primary-600" />
              <span className="text-sm text-neutral-700">Recommended <span className="text-blue-400">✦</span></span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={itemForm.hideOnline} onChange={(e) => setItemForm({ ...itemForm, hideOnline: e.target.checked })} className="accent-primary-600" />
              <span className="text-sm text-neutral-700">Hide from online ordering</span>
            </label>
          </div>
          <div>
            <label className="field-label">Availability Hours (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-neutral-500 mb-1 block">From</span>
                <Input type="time" value={itemForm.availableFromTime} onChange={(e) => setItemForm({ ...itemForm, availableFromTime: e.target.value })} />
              </div>
              <div>
                <span className="text-xs text-neutral-500 mb-1 block">Until</span>
                <Input type="time" value={itemForm.availableToTime} onChange={(e) => setItemForm({ ...itemForm, availableToTime: e.target.value })} />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={importModal}
        onClose={() => setImportModal(false)}
        title="Bulk Import Menu"
        size="lg"
        footer={
          importResult ? (
            <Button variant="primary" size="sm" onClick={() => setImportModal(false)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={downloadTemplate}>Download Template</Button>
              <div className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setImportModal(false)}>Cancel</Button>
              <Button
                variant="primary" size="sm"
                loading={importing}
                disabled={importRows.filter((r) => r._valid).length === 0}
                onClick={runImport}
              >
                Import {importRows.filter((r) => r._valid).length > 0 ? `${importRows.filter((r) => r._valid).length} rows` : ''}
              </Button>
            </>
          )
        }
      >
        {importResult ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {([
                ['Menus created', importResult.created.menus],
                ['Categories created', importResult.created.categories],
                ['Items created', importResult.created.items],
                ['Variants created', importResult.created.variants],
                ['Option groups created', importResult.created.modifierGroups],
                ['Options created', importResult.created.modifiers],
                ['Ingredients linked', importResult.created.ingredients],
              ] as const).map(([label, val]) => (
                <div key={label} className="bg-success-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-success-700">{val}</div>
                  <div className="text-xs text-success-600 mt-0.5">{label}</div>
                </div>
              ))}
            </div>
            {importResult.skipped > 0 && (
              <p className="text-sm text-neutral-500">{importResult.skipped} item{importResult.skipped !== 1 ? 's' : ''} skipped (already exist)</p>
            )}
            {importResult.errors.length > 0 && (
              <div className="rounded-lg border border-error-200 bg-error-50 p-3 space-y-1">
                <p className="text-xs font-semibold text-error-700">Errors ({importResult.errors.length})</p>
                {importResult.errors.map((e) => (
                  <p key={e.row} className="text-xs text-error-600">Row {e.row}: {e.message}</p>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setImportDragging(true); }}
              onDragLeave={() => setImportDragging(false)}
              onDrop={handleImportFileDrop}
              onClick={() => importFileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                importDragging ? 'border-primary-400 bg-primary-50' : 'border-neutral-200 hover:border-primary-300 hover:bg-neutral-50'
              }`}
            >
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImportFileInput}
              />
              <p className="text-sm font-medium text-neutral-700">
                {importFileName ? importFileName : 'Drop your CSV or Excel file here'}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {importFileName ? `${importRows.length} rows found` : 'or click to browse — .csv, .xlsx, .xls'}
              </p>
            </div>

            {/* Format hint */}
            {importRows.length === 0 && (
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 p-3">
                <p className="text-xs font-semibold text-neutral-500 mb-1.5">Required columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {['menu_name', 'category_name', 'item_name', 'price'].map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-white border border-neutral-200 rounded text-xs font-mono text-neutral-700">{c}</span>
                  ))}
                </div>
                <p className="text-xs font-semibold text-neutral-500 mt-2 mb-1.5">Optional columns</p>
                <div className="flex flex-wrap gap-1.5">
                  {['description', 'tax_rate', 'sku', 'status', 'dietary_type', 'variants', 'modifier_groups', 'ingredients'].map((c) => (
                    <span key={c} className="px-2 py-0.5 bg-white border border-neutral-200 rounded text-xs font-mono text-neutral-400">{c}</span>
                  ))}
                </div>
                <div className="mt-2 space-y-1 text-xs text-neutral-400">
                  <p><span className="font-mono text-neutral-500">dietary_type</span> — {'"veg"'} or {'"non_veg"'} (also accepts "vegetarian" / "non-veg" / "nonveg"). Leave blank to leave it unmarked.</p>
                  <p><span className="font-mono text-neutral-500">variants</span> — {'"Large:20|Medium:15|Small:12"'} (name:price, pipe-separated). One picked, adds to the base price.</p>
                  <p><span className="font-mono text-neutral-500">modifier_groups</span> — {'"Choice of Milk:multiple:0:2:Skimmed+3,Almond+5"'} (group:single|multiple:min:max:options, options comma-separated as name+priceAdjustment). Multiple groups pipe-separated.</p>
                  <p><span className="font-mono text-neutral-500">ingredients</span> — {'"Flour:0.2:kg|Sugar:0.05:kg"'} (inventory product name:quantity:unit, pipe-separated). Matched by name against existing Inventory products — names that don't match anything are reported as errors after import, and quantities reserve/consume automatically when the item is ordered, same as ingredients linked by hand.</p>
                </div>
              </div>
            )}

            {/* Preview table */}
            {importRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Preview — {importRows.length} rows</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-success-600">{importRows.filter((r) => r._valid).length} valid</span>
                    {importRows.filter((r) => !r._valid).length > 0 && (
                      <span className="text-error-600">{importRows.filter((r) => !r._valid).length} invalid</span>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-neutral-200 overflow-hidden">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-xs">
                      <thead className="bg-neutral-50 sticky top-0">
                        <tr>
                          {['#', 'Menu', 'Category', 'Item', 'Price', 'Tax%', 'SKU', 'Status', 'Type', 'Variants', 'Options', 'Ingredients', ''].map((h) => (
                            <th key={h} className="px-2 py-2 text-left font-semibold text-neutral-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importRows.map((row, idx) => {
                          const variantCount = row.variants ? row.variants.split('|').filter((s) => s.trim()).length : 0;
                          const groupCount = row.modifierGroups ? row.modifierGroups.split('|').filter((s) => s.trim()).length : 0;
                          const ingredientCount = row.ingredients ? row.ingredients.split('|').filter((s) => s.trim()).length : 0;
                          const normDietary = row.dietaryType.toLowerCase().replace(/[\s-]/g, '_');
                          const dietaryType = normDietary === 'veg' || normDietary === 'vegetarian'
                            ? 'veg'
                            : normDietary === 'non_veg' || normDietary === 'nonveg' || normDietary === 'non_vegetarian'
                            ? 'non_veg'
                            : undefined;
                          return (
                          <tr key={idx} className={`border-t border-neutral-100 ${row._valid ? '' : 'bg-error-50'}`}>
                            <td className="px-2 py-1.5 text-neutral-400">{idx + 2}</td>
                            <td className="px-2 py-1.5 text-neutral-700 max-w-[100px] truncate">{row.menuName}</td>
                            <td className="px-2 py-1.5 text-neutral-700 max-w-[100px] truncate">{row.categoryName}</td>
                            <td className="px-2 py-1.5 text-neutral-700 max-w-[120px] truncate">{row.itemName}</td>
                            <td className="px-2 py-1.5 text-neutral-700">{row.price}</td>
                            <td className="px-2 py-1.5 text-neutral-500">{row.taxRate || '5'}</td>
                            <td className="px-2 py-1.5 text-neutral-500">{row.sku}</td>
                            <td className="px-2 py-1.5 text-neutral-500">{row.status || 'active'}</td>
                            <td className="px-2 py-1.5 text-neutral-500">
                              {dietaryType ? <DietaryMark type={dietaryType} size={13} /> : row.dietaryType ? row.dietaryType : '—'}
                            </td>
                            <td className="px-2 py-1.5 text-neutral-500">{variantCount > 0 ? variantCount : '—'}</td>
                            <td className="px-2 py-1.5 text-neutral-500">{groupCount > 0 ? groupCount : '—'}</td>
                            <td className="px-2 py-1.5 text-neutral-500">{ingredientCount > 0 ? ingredientCount : '—'}</td>
                            <td className="px-2 py-1.5">
                              {row._valid
                                ? <span className="text-success-600">✓</span>
                                : <span className="text-error-600" title={row._error}>✗</span>
                              }
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {importRows.some((r) => !r._valid) && (
                  <div className="space-y-0.5">
                    {importRows.filter((r) => !r._valid).map((r, i) => (
                      <p key={i} className="text-xs text-error-600">Row {importRows.indexOf(r) + 2}: {r._error}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
                  icon={<PlusIcon size={14} />}
                  loading={ingredientSaving}
                  disabled={!ingredientForm.inventoryProductId || !ingredientForm.quantity}
                  onClick={addIngredient}
                  className="w-full"
                >
                  Add Ingredient
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Options Side Panel — variants + modifier groups */}
      {optionsItem && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOptionsItem(null)} />
          <div className="relative w-full max-w-md bg-white shadow-xl flex flex-col h-full overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-neutral-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="font-semibold text-neutral-900">Options</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{optionsItem.name}</p>
              </div>
              <button onClick={() => setOptionsItem(null)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors text-lg leading-none">&times;</button>
            </div>

            {optionsLoading ? (
              <div className="flex justify-center py-8"><Spinner size="md" /></div>
            ) : (
              <div className="p-6 space-y-8 flex-1">
                {/* ── Variants ── */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Variants</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Size/style choices with their own price, e.g. "Espresso (Large)" — AED 18. A customer picks exactly one.
                    </p>
                  </div>

                  {variants.length === 0 ? (
                    <p className="text-sm text-neutral-400">No variants yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {variants.map((v) => (
                        <div key={v.id} className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 group">
                          <div>
                            <span className="text-sm font-medium text-neutral-800">{v.name}</span>
                            <span className="text-xs text-neutral-500 ml-2">AED {Number(v.price).toFixed(2)}</span>
                          </div>
                          <button
                            onClick={() => removeVariant(v)}
                            className="p-1 rounded text-neutral-400 hover:text-error-600 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <TrashIcon size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-neutral-100 pt-3 grid grid-cols-2 gap-2">
                    <Input placeholder="Name (e.g. Large)" value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} />
                    <Input type="number" min="0" step="0.01" placeholder="Price" value={variantForm.price} onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} />
                    <div className="col-span-2">
                      <Button
                        variant="secondary" size="sm"
                        icon={<PlusIcon size={14} />}
                        loading={variantSaving}
                        disabled={!variantForm.name || !variantForm.price}
                        onClick={addVariant}
                        className="w-full"
                      >
                        Add Variant
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── Modifier Groups ── */}
                <div className="space-y-3 border-t border-neutral-100 pt-6">
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-900">Option Groups</h3>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      Add-on choices, e.g. "Choice of Milk" — a customer can pick one or several, each with its own price add-on.
                    </p>
                  </div>

                  {modifierGroups.length === 0 ? (
                    <p className="text-sm text-neutral-400">No option groups yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {modifierGroups.map((group) => (
                        <div key={group.id} className="border border-neutral-200 rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-semibold text-neutral-900">{group.name}</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="default" size="sm">{group.selectionType === 'single' ? 'Pick one' : `Pick ${group.minSelections}–${group.maxSelections}`}</Badge>
                                {group.isRequired && <Badge variant="warning" size="sm">Required</Badge>}
                              </div>
                            </div>
                            <button
                              onClick={() => removeModifierGroup(group)}
                              className="p-1 rounded text-neutral-400 hover:text-error-600 transition-colors"
                            >
                              <TrashIcon size={13} />
                            </button>
                          </div>

                          {group.modifiers.length > 0 && (
                            <div className="space-y-1">
                              {group.modifiers.map((m) => (
                                <div key={m.id} className="flex items-center justify-between px-2 py-1.5 rounded bg-neutral-50 group">
                                  <span className="text-xs text-neutral-700">{m.name}</span>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-neutral-500">
                                      {m.priceAdjustment > 0 ? `+AED ${m.priceAdjustment.toFixed(2)}` : 'Free'}
                                    </span>
                                    <button
                                      onClick={() => removeModifier(group, m)}
                                      className="p-0.5 rounded text-neutral-400 hover:text-error-600 opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                      <TrashIcon size={11} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-1.5 pt-1">
                            <Input
                              placeholder="Option name"
                              value={modifierForms[group.id]?.name ?? ''}
                              onChange={(e) => setModifierForms((p) => ({ ...p, [group.id]: { name: e.target.value, priceAdjustment: p[group.id]?.priceAdjustment ?? '' } }))}
                            />
                            <Input
                              type="number" min="0" step="0.01"
                              placeholder="+ price"
                              value={modifierForms[group.id]?.priceAdjustment ?? ''}
                              onChange={(e) => setModifierForms((p) => ({ ...p, [group.id]: { name: p[group.id]?.name ?? '', priceAdjustment: e.target.value } }))}
                            />
                            <div className="col-span-2">
                              <Button
                                variant="secondary" size="sm"
                                icon={<PlusIcon size={12} />}
                                loading={modifierSavingGroupId === group.id}
                                disabled={!modifierForms[group.id]?.name}
                                onClick={() => addModifier(group)}
                                className="w-full"
                              >
                                Add Option
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-neutral-100 pt-3 space-y-2">
                    <Input placeholder="Group name (e.g. Choice of Milk)" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={groupForm.selectionType}
                        onChange={(e) => setGroupForm({ ...groupForm, selectionType: e.target.value as 'single' | 'multiple' })}
                        className="w-full px-3 py-2 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      >
                        <option value="single">Pick one</option>
                        <option value="multiple">Pick multiple</option>
                      </select>
                      <label className="flex items-center gap-2 text-sm text-neutral-700 px-1">
                        <input
                          type="checkbox"
                          checked={groupForm.isRequired}
                          onChange={(e) => setGroupForm({ ...groupForm, isRequired: e.target.checked })}
                        />
                        Required
                      </label>
                    </div>
                    {groupForm.selectionType === 'multiple' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="field-label">Min selections</label>
                          <Input type="number" min="0" value={groupForm.minSelections} onChange={(e) => setGroupForm({ ...groupForm, minSelections: e.target.value })} />
                        </div>
                        <div>
                          <label className="field-label">Max selections</label>
                          <Input type="number" min="1" value={groupForm.maxSelections} onChange={(e) => setGroupForm({ ...groupForm, maxSelections: e.target.value })} />
                        </div>
                      </div>
                    )}
                    <Button
                      variant="primary" size="sm"
                      icon={<PlusIcon size={14} />}
                      loading={groupSaving}
                      disabled={!groupForm.name}
                      onClick={addModifierGroup}
                      className="w-full"
                    >
                      Add Option Group
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
