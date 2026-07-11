import { db } from '../db/client';
import { redisClient } from '../redis/client';
import { config } from '../config';
import { generateId, NotFoundError } from '@pos/shared-utils';
import { DietaryType } from '@pos/shared-types';
import type {
  Menu, MenuCategory, MenuItem, CreateMenuRequest, CreateCategoryRequest, CreateMenuItemRequest,
  ItemVariant, CreateItemVariantRequest, UpdateItemVariantRequest,
  ModifierGroup, CreateModifierGroupRequest, UpdateModifierGroupRequest,
  Modifier, CreateModifierRequest, UpdateModifierRequest,
} from '@pos/shared-types';

const MENU_CACHE_KEY = (storeId: string) => `menu:${storeId}`;

// ——————————————————————————————————————————
// Menus
// ——————————————————————————————————————————

export async function getMenusByStore(storeId: string): Promise<Menu[]> {
  const result = await db.query(
    `SELECT * FROM menus WHERE store_id = $1 ORDER BY is_default DESC, name ASC`,
    [storeId],
  );
  return result.rows.map(rowToMenu);
}

export async function createMenu(data: CreateMenuRequest): Promise<Menu> {
  const id = generateId();

  // If this is set as default, unset all others first
  if (data.isDefault) {
    await db.query(`UPDATE menus SET is_default = FALSE WHERE store_id = $1`, [data.storeId]);
  }

  const result = await db.query(
    `INSERT INTO menus (id, store_id, name, description, is_default, status)
     VALUES ($1, $2, $3, $4, $5, 'active') RETURNING *`,
    [id, data.storeId, data.name, data.description ?? null, data.isDefault ?? false],
  );

  await invalidateMenuCache(data.storeId);
  return rowToMenu(result.rows[0]);
}

export async function deleteMenu(id: string): Promise<void> {
  const existing = await db.query(`SELECT store_id FROM menus WHERE id = $1`, [id]);
  if (existing.rowCount === 0) throw new NotFoundError(`Menu ${id} not found`);
  await db.query(`DELETE FROM menus WHERE id = $1`, [id]);
  await invalidateMenuCache(existing.rows[0].store_id);
}

export async function updateMenu(id: string, data: Partial<CreateMenuRequest>): Promise<Menu> {
  const existing = await db.query(`SELECT * FROM menus WHERE id = $1`, [id]);
  if (existing.rowCount === 0) throw new NotFoundError(`Menu ${id} not found`);

  const row = existing.rows[0];
  const result = await db.query(
    `UPDATE menus SET name = $1, description = $2, is_default = $3, updated_at = NOW()
     WHERE id = $4 RETURNING *`,
    [
      data.name ?? row.name,
      data.description ?? row.description,
      data.isDefault ?? row.is_default,
      id,
    ],
  );

  await invalidateMenuCache(row.store_id);
  return rowToMenu(result.rows[0]);
}

// ——————————————————————————————————————————
// Categories
// ——————————————————————————————————————————

export async function getCategoriesByMenu(menuId: string): Promise<MenuCategory[]> {
  const result = await db.query(
    `SELECT * FROM menu_categories WHERE menu_id = $1 ORDER BY display_order ASC`,
    [menuId],
  );
  return result.rows.map(rowToCategory);
}

export async function createCategory(data: CreateCategoryRequest): Promise<MenuCategory> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO menu_categories
      (id, menu_id, store_id, name, name_ar, description, image_url, display_order, available_from, available_to, available_days)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
    [
      id, data.menuId, data.storeId, data.name,
      data.nameAr ?? null, data.description ?? null,
      data.imageUrl ?? null, data.displayOrder ?? 0,
      data.availableFrom ?? null, data.availableTo ?? null,
      data.availableDays ?? null,
    ],
  );

  await invalidateMenuCache(data.storeId);
  return rowToCategory(result.rows[0]);
}

export async function updateCategory(id: string, data: Partial<CreateCategoryRequest> & { status?: string }): Promise<MenuCategory> {
  const existing = await db.query(`SELECT * FROM menu_categories WHERE id = $1`, [id]);
  if (existing.rowCount === 0) throw new NotFoundError(`Category ${id} not found`);
  const row = existing.rows[0];

  const result = await db.query(
    `UPDATE menu_categories SET
        name = $1, name_ar = $2, description = $3, image_url = $4,
        display_order = $5, status = $6, available_from = $7, available_to = $8, available_days = $9
     WHERE id = $10 RETURNING *`,
    [
      data.name ?? row.name,
      data.nameAr ?? row.name_ar,
      data.description ?? row.description,
      data.imageUrl ?? row.image_url,
      data.displayOrder ?? row.display_order,
      data.status ?? row.status,
      data.availableFrom ?? row.available_from,
      data.availableTo ?? row.available_to,
      data.availableDays ?? row.available_days,
      id,
    ],
  );

  await invalidateMenuCache(row.store_id);
  return rowToCategory(result.rows[0]);
}

export async function deleteCategory(id: string): Promise<void> {
  const existing = await db.query(`SELECT store_id FROM menu_categories WHERE id = $1`, [id]);
  if (existing.rowCount === 0) throw new NotFoundError(`Category ${id} not found`);
  await db.query(`DELETE FROM menu_categories WHERE id = $1`, [id]);
  await invalidateMenuCache(existing.rows[0].store_id);
}

// ——————————————————————————————————————————
// Menu Items
// ——————————————————————————————————————————

export async function getItemsByCategory(categoryId: string): Promise<MenuItem[]> {
  const result = await db.query(
    `SELECT * FROM menu_items WHERE category_id = $1 ORDER BY sort_order ASC`,
    [categoryId],
  );
  return result.rows.map(rowToItem);
}

export async function getItemById(id: string): Promise<MenuItem> {
  const result = await db.query(`SELECT * FROM menu_items WHERE id = $1`, [id]);
  if (result.rowCount === 0) throw new NotFoundError(`Menu item ${id} not found`);

  const item = rowToItem(result.rows[0]);

  // Load modifier groups
  const mgResult = await db.query(
    `SELECT mg.*, m.id AS mod_id, m.name AS mod_name, m.name_ar AS mod_name_ar,
            m.price_adjustment, m.is_default, m.status AS mod_status
     FROM modifier_group_items mgi
     JOIN modifier_groups mg ON mg.id = mgi.modifier_group_id
     LEFT JOIN modifiers m ON m.group_id = mg.id AND m.status = 'active'
     WHERE mgi.menu_item_id = $1`,
    [id],
  );

  // Build modifier groups map
  const groupsMap = new Map();
  for (const row of mgResult.rows) {
    if (!groupsMap.has(row.id)) {
      groupsMap.set(row.id, {
        id: row.id,
        storeId: row.store_id,
        name: row.name,
        selectionType: row.selection_type,
        minSelections: row.min_selections,
        maxSelections: row.max_selections,
        isRequired: row.is_required,
        modifiers: [],
      });
    }
    if (row.mod_id) {
      groupsMap.get(row.id).modifiers.push({
        id: row.mod_id,
        groupId: row.id,
        name: row.mod_name,
        nameAr: row.mod_name_ar,
        priceAdjustment: parseFloat(row.price_adjustment),
        isDefault: row.is_default,
        status: row.mod_status,
      });
    }
  }
  item.modifierGroups = Array.from(groupsMap.values());

  // Load variants
  const varResult = await db.query(
    `SELECT * FROM item_variants WHERE menu_item_id = $1 AND status = 'active'`,
    [id],
  );
  item.variants = varResult.rows.map((r) => ({
    id: r.id,
    menuItemId: r.menu_item_id,
    name: r.name,
    price: parseFloat(r.price),
    sku: r.sku,
    status: r.status,
  }));

  return item;
}

export async function createItem(data: CreateMenuItemRequest): Promise<MenuItem> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO menu_items
      (id, category_id, store_id, name, name_ar, description, base_price, tax_rate, sku, calories, allergens, tags, dietary_type, inventory_product_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
    [
      id, data.categoryId, data.storeId, data.name,
      data.nameAr ?? null, data.description ?? null,
      data.basePrice, data.taxRate ?? 5.0,
      data.sku ?? null, data.calories ?? null,
      data.allergens ?? null, data.tags ?? null,
      data.dietaryType ?? null,
      data.inventoryProductId ?? null,
    ],
  );

  await invalidateMenuCache(data.storeId);
  return rowToItem(result.rows[0]);
}

export async function updateItem(
  id: string,
  data: {
    name?: string;
    nameAr?: string | null;
    description?: string | null;
    basePrice?: number;
    taxRate?: number;
    sku?: string | null;
    calories?: number | null;
    allergens?: string | null;
    tags?: string | null;
    dietaryType?: string | null;
    sortOrder?: number;
    isFeatured?: boolean;
    inventoryProductId?: string | null;
    isRecommended?: boolean;
    hideOnline?: boolean;
    availableFromTime?: string | null;
    availableToTime?: string | null;
    availableDays?: string | null;
  },
): Promise<MenuItem> {
  const existing = await db.query(`SELECT * FROM menu_items WHERE id = $1`, [id]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Menu item ${id} not found`);
  const row = existing.rows[0];

  const result = await db.query(
    `UPDATE menu_items SET
      name = $1, name_ar = $2, description = $3, base_price = $4, tax_rate = $5,
      sku = $6, calories = $7, allergens = $8, tags = $9,
      sort_order = $10, is_featured = $11, inventory_product_id = $12,
      is_recommended = $13, hide_online = $14,
      available_from_time = $15, available_to_time = $16, available_days = $17,
      dietary_type = $18,
      updated_at = NOW()
     WHERE id = $19 RETURNING *`,
    [
      data.name ?? row.name,
      'nameAr' in data ? data.nameAr : row.name_ar,
      'description' in data ? data.description : row.description,
      data.basePrice ?? parseFloat(row.base_price),
      data.taxRate ?? parseFloat(row.tax_rate),
      'sku' in data ? data.sku : row.sku,
      'calories' in data ? data.calories : row.calories,
      'allergens' in data ? data.allergens : row.allergens,
      'tags' in data ? data.tags : row.tags,
      data.sortOrder ?? row.sort_order,
      data.isFeatured ?? row.is_featured,
      'inventoryProductId' in data ? data.inventoryProductId : row.inventory_product_id,
      'isRecommended' in data ? data.isRecommended : (row.is_recommended ?? false),
      'hideOnline' in data ? data.hideOnline : (row.hide_online ?? false),
      'availableFromTime' in data ? data.availableFromTime : row.available_from_time,
      'availableToTime' in data ? data.availableToTime : row.available_to_time,
      'availableDays' in data ? data.availableDays : row.available_days,
      'dietaryType' in data ? data.dietaryType : row.dietary_type,
      id,
    ],
  );

  await invalidateMenuCache(result.rows[0].store_id);
  return rowToItem(result.rows[0]);
}

export async function updateItemStatus(id: string, status: string): Promise<MenuItem> {
  const result = await db.query(
    `UPDATE menu_items SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
    [status, id],
  );
  if (result.rowCount === 0) throw new NotFoundError(`Menu item ${id} not found`);
  await invalidateMenuCache(result.rows[0].store_id);
  return rowToItem(result.rows[0]);
}

// ——————————————————————————————————————————
// Full menu (cached) — used by POS terminal on startup
// ——————————————————————————————————————————

export async function getFullMenu(storeId: string): Promise<{ menus: Menu[]; categories: MenuCategory[]; items: MenuItem[] }> {
  const cacheKey = MENU_CACHE_KEY(storeId);
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const [menus, catResult, itemResult] = await Promise.all([
    getMenusByStore(storeId),
    db.query(`SELECT * FROM menu_categories WHERE store_id = $1 ORDER BY display_order ASC`, [storeId]),
    db.query(
      `SELECT mi.*,
              EXISTS(SELECT 1 FROM item_variants iv WHERE iv.menu_item_id = mi.id AND iv.status = 'active') AS has_variants,
              EXISTS(SELECT 1 FROM modifier_group_items mgi WHERE mgi.menu_item_id = mi.id) AS has_modifier_groups
       FROM menu_items mi
       WHERE mi.store_id = $1 AND mi.status IN ('active','sold_out')
       ORDER BY mi.sort_order ASC`,
      [storeId],
    ),
  ]);

  const payload = {
    menus,
    categories: catResult.rows.map(rowToCategory),
    items: itemResult.rows.map(rowToItem),
  };

  await redisClient.setEx(cacheKey, config.MENU_CACHE_TTL, JSON.stringify(payload));
  return payload;
}

async function invalidateMenuCache(storeId: string): Promise<void> {
  await redisClient.del(MENU_CACHE_KEY(storeId));
}

// ——————————————————————————————————————————
// Row mappers
// ——————————————————————————————————————————

function rowToMenu(row: Record<string, unknown>): Menu {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    isDefault: row.is_default as boolean,
    status: row.status as 'active' | 'inactive',
    createdAt: row.created_at as string,
  };
}

function rowToCategory(row: Record<string, unknown>): MenuCategory {
  return {
    id: row.id as string,
    menuId: row.menu_id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    nameAr: row.name_ar as string | undefined,
    description: row.description as string | undefined,
    imageUrl: row.image_url as string | undefined,
    displayOrder: row.display_order as number,
    status: row.status as 'active' | 'inactive' | 'hidden',
    availableFrom: row.available_from as string | undefined,
    availableTo: row.available_to as string | undefined,
    availableDays: row.available_days as string | undefined,
  };
}

function rowToItem(row: Record<string, unknown>): MenuItem {
  return {
    id: row.id as string,
    categoryId: row.category_id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    nameAr: row.name_ar as string | undefined,
    description: row.description as string | undefined,
    imageUrl: row.image_url as string | undefined,
    basePrice: parseFloat(row.base_price as string),
    taxRate: parseFloat(row.tax_rate as string),
    sku: row.sku as string | undefined,
    barcode: row.barcode as string | undefined,
    calories: row.calories as number | undefined,
    allergens: row.allergens as string | undefined,
    tags: row.tags as string | undefined,
    dietaryType: row.dietary_type as import('@pos/shared-types').DietaryType | undefined,
    status: row.status as import('@pos/shared-types').MenuItemStatus,
    sortOrder: row.sort_order as number,
    isFeatured: (row.is_featured ?? false) as boolean,
    isRecommended: (row.is_recommended ?? false) as boolean,
    hideOnline: (row.hide_online ?? false) as boolean,
    availableFromTime: row.available_from_time as string | undefined,
    availableToTime: row.available_to_time as string | undefined,
    availableDays: row.available_days as string | undefined,
    inventoryProductId: row.inventory_product_id as string | undefined,
    // Only present on rows from getFullMenu's query below — undefined elsewhere,
    // which is fine since these are advisory flags, not authoritative data.
    hasVariants: row.has_variants as boolean | undefined,
    hasModifierGroups: row.has_modifier_groups as boolean | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ——————————————————————————————————————————
// Item Advanced Operations
// ——————————————————————————————————————————

export async function duplicateItem(id: string): Promise<MenuItem> {
  const existing = await db.query(`SELECT * FROM menu_items WHERE id = $1`, [id]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Menu item ${id} not found`);
  const row = existing.rows[0];
  const newId = generateId();
  const result = await db.query(
    `INSERT INTO menu_items
      (id, category_id, store_id, name, name_ar, description, image_url, base_price, tax_rate,
       sku, barcode, calories, allergens, tags, sort_order, is_featured, is_recommended,
       hide_online, available_from_time, available_to_time, available_days, inventory_product_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
     RETURNING *`,
    [
      newId, row.category_id, row.store_id, `${row.name} (Copy)`, row.name_ar,
      row.description, row.image_url, row.base_price, row.tax_rate,
      row.sku ? `${row.sku}_copy` : null, row.barcode, row.calories,
      row.allergens, row.tags, (row.sort_order ?? 0) + 1,
      row.is_featured ?? false, row.is_recommended ?? false,
      row.hide_online ?? false, row.available_from_time, row.available_to_time,
      row.available_days, row.inventory_product_id,
    ],
  );
  await invalidateMenuCache(row.store_id);
  return rowToItem(result.rows[0]);
}

export async function hardDeleteItem(id: string): Promise<void> {
  const existing = await db.query(`SELECT store_id FROM menu_items WHERE id = $1`, [id]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Menu item ${id} not found`);
  await db.query(`DELETE FROM menu_items WHERE id = $1`, [id]);
  await invalidateMenuCache(existing.rows[0].store_id);
}

export async function reorderItems(items: Array<{ id: string; sortOrder: number }>): Promise<void> {
  if (items.length === 0) return;
  const first = await db.query(`SELECT store_id FROM menu_items WHERE id = $1`, [items[0].id]);
  const storeId = first.rows[0]?.store_id as string | undefined;
  await Promise.all(
    items.map(({ id, sortOrder }) =>
      db.query(`UPDATE menu_items SET sort_order = $1, updated_at = NOW() WHERE id = $2`, [sortOrder, id]),
    ),
  );
  if (storeId) await invalidateMenuCache(storeId);
}

export async function reorderCategories(categories: Array<{ id: string; displayOrder: number }>): Promise<void> {
  if (categories.length === 0) return;
  const first = await db.query(`SELECT store_id FROM menu_categories WHERE id = $1`, [categories[0].id]);
  const storeId = first.rows[0]?.store_id as string | undefined;
  await Promise.all(
    categories.map(({ id, displayOrder }) =>
      db.query(`UPDATE menu_categories SET display_order = $1 WHERE id = $2`, [displayOrder, id]),
    ),
  );
  if (storeId) await invalidateMenuCache(storeId);
}

export async function duplicateCategory(categoryId: string): Promise<{ category: MenuCategory; items: MenuItem[] }> {
  const catRow = await db.query(`SELECT * FROM menu_categories WHERE id = $1`, [categoryId]);
  if (!catRow.rowCount || catRow.rowCount === 0) throw new NotFoundError(`Category ${categoryId} not found`);
  const cat = catRow.rows[0];

  const newCatId = generateId();
  const catResult = await db.query(
    `INSERT INTO menu_categories
      (id, menu_id, store_id, name, name_ar, description, image_url, display_order, available_from, available_to, available_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [
      newCatId, cat.menu_id, cat.store_id, `${cat.name} (Copy)`,
      cat.name_ar, cat.description, cat.image_url,
      (cat.display_order ?? 0) + 1,
      cat.available_from, cat.available_to, cat.available_days,
    ],
  );

  const itemsResult = await db.query(`SELECT * FROM menu_items WHERE category_id = $1`, [categoryId]);
  const newItems: MenuItem[] = [];
  for (const row of itemsResult.rows) {
    const newItemId = generateId();
    const itemResult = await db.query(
      `INSERT INTO menu_items
        (id, category_id, store_id, name, name_ar, description, image_url, base_price, tax_rate,
         sku, barcode, calories, allergens, tags, sort_order, is_featured, is_recommended,
         hide_online, available_from_time, available_to_time, available_days, inventory_product_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
       RETURNING *`,
      [
        newItemId, newCatId, cat.store_id, row.name, row.name_ar,
        row.description, row.image_url, row.base_price, row.tax_rate,
        row.sku, row.barcode, row.calories, row.allergens, row.tags,
        row.sort_order, row.is_featured ?? false, row.is_recommended ?? false,
        row.hide_online ?? false, row.available_from_time, row.available_to_time,
        row.available_days, row.inventory_product_id,
      ],
    );
    newItems.push(rowToItem(itemResult.rows[0]));
  }

  await invalidateMenuCache(cat.store_id);
  return { category: rowToCategory(catResult.rows[0]), items: newItems };
}

export async function bulkUpdateItemStatus(ids: string[], status: string): Promise<void> {
  if (ids.length === 0) return;
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  const result = await db.query(
    `UPDATE menu_items SET status = $1, updated_at = NOW() WHERE id IN (${placeholders}) RETURNING store_id`,
    [status, ...ids],
  );
  const storeId = result.rows[0]?.store_id as string | undefined;
  if (storeId) await invalidateMenuCache(storeId);
}

// ——————————————————————————————————————————
// Ingredients (links to inventory products)
// ——————————————————————————————————————————

export interface MenuItemIngredient {
  id: string;
  menuItemId: string;
  inventoryProductId: string;
  quantity: number;
  unitType: string;
  createdAt: string;
}

export async function getIngredients(menuItemId: string): Promise<MenuItemIngredient[]> {
  const result = await db.query(
    `SELECT * FROM menu_item_ingredients WHERE menu_item_id = $1 ORDER BY created_at ASC`,
    [menuItemId],
  );
  return result.rows.map(rowToIngredient);
}

export async function addIngredient(
  menuItemId: string,
  inventoryProductId: string,
  quantity: number,
  unitType: string,
): Promise<MenuItemIngredient> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO menu_item_ingredients (id, menu_item_id, inventory_product_id, quantity, unit_type)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (menu_item_id, inventory_product_id)
     DO UPDATE SET quantity = EXCLUDED.quantity, unit_type = EXCLUDED.unit_type
     RETURNING *`,
    [id, menuItemId, inventoryProductId, quantity, unitType],
  );
  return rowToIngredient(result.rows[0]);
}

export async function updateIngredient(
  ingredientId: string,
  quantity: number,
  unitType: string,
): Promise<MenuItemIngredient> {
  const result = await db.query(
    `UPDATE menu_item_ingredients SET quantity = $2, unit_type = $3 WHERE id = $1 RETURNING *`,
    [ingredientId, quantity, unitType],
  );
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Ingredient ${ingredientId} not found`);
  return rowToIngredient(result.rows[0]);
}

export async function removeIngredient(ingredientId: string): Promise<void> {
  const result = await db.query(`DELETE FROM menu_item_ingredients WHERE id = $1`, [ingredientId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Ingredient ${ingredientId} not found`);
}

// ——————————————————————————————————————————
// Item Variants
// ——————————————————————————————————————————

async function invalidateMenuCacheForItem(menuItemId: string): Promise<void> {
  const r = await db.query(`SELECT store_id FROM menu_items WHERE id = $1`, [menuItemId]);
  if (r.rowCount) await invalidateMenuCache(r.rows[0].store_id as string);
}

async function invalidateMenuCacheForGroup(groupId: string): Promise<void> {
  const r = await db.query(`SELECT store_id FROM modifier_groups WHERE id = $1`, [groupId]);
  if (r.rowCount) await invalidateMenuCache(r.rows[0].store_id as string);
}

export async function addVariant(menuItemId: string, data: CreateItemVariantRequest): Promise<ItemVariant> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO item_variants (id, menu_item_id, name, price, sku)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [id, menuItemId, data.name, data.price, data.sku ?? null],
  );
  await invalidateMenuCacheForItem(menuItemId);
  return rowToVariant(result.rows[0]);
}

export async function updateVariant(variantId: string, data: UpdateItemVariantRequest): Promise<ItemVariant> {
  const existing = await db.query(`SELECT * FROM item_variants WHERE id = $1`, [variantId]);
  if (existing.rowCount === 0) throw new NotFoundError(`Variant ${variantId} not found`);
  const row = existing.rows[0];
  const result = await db.query(
    `UPDATE item_variants SET name = $1, price = $2, sku = $3, status = $4 WHERE id = $5 RETURNING *`,
    [
      data.name ?? row.name,
      data.price ?? row.price,
      data.sku !== undefined ? data.sku : row.sku,
      data.status ?? row.status,
      variantId,
    ],
  );
  await invalidateMenuCacheForItem(row.menu_item_id as string);
  return rowToVariant(result.rows[0]);
}

export async function removeVariant(variantId: string): Promise<void> {
  const result = await db.query(`DELETE FROM item_variants WHERE id = $1 RETURNING menu_item_id`, [variantId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Variant ${variantId} not found`);
  await invalidateMenuCacheForItem(result.rows[0].menu_item_id as string);
}

function rowToVariant(row: Record<string, unknown>): ItemVariant {
  return {
    id: row.id as string,
    menuItemId: row.menu_item_id as string,
    name: row.name as string,
    price: parseFloat(row.price as string),
    sku: row.sku as string | undefined,
    status: row.status as 'active' | 'inactive',
  };
}

// ——————————————————————————————————————————
// Modifier Groups + Modifiers
// (groups are store-scoped and linked to items via modifier_group_items;
//  creating a group from an item's panel links it to that item immediately)
// ——————————————————————————————————————————

export async function createModifierGroup(
  menuItemId: string,
  data: CreateModifierGroupRequest,
): Promise<ModifierGroup> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO modifier_groups (id, store_id, name, selection_type, min_selections, max_selections, is_required)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      id, data.storeId, data.name,
      data.selectionType ?? 'single',
      data.minSelections ?? 0,
      data.maxSelections ?? 1,
      data.isRequired ?? false,
    ],
  );
  await db.query(
    `INSERT INTO modifier_group_items (id, modifier_group_id, menu_item_id) VALUES ($1, $2, $3)`,
    [generateId(), id, menuItemId],
  );
  await invalidateMenuCache(data.storeId);
  return { ...rowToGroup(result.rows[0]), modifiers: [] };
}

export async function updateModifierGroup(groupId: string, data: UpdateModifierGroupRequest): Promise<ModifierGroup> {
  const existing = await db.query(`SELECT * FROM modifier_groups WHERE id = $1`, [groupId]);
  if (existing.rowCount === 0) throw new NotFoundError(`Modifier group ${groupId} not found`);
  const row = existing.rows[0];
  const result = await db.query(
    `UPDATE modifier_groups SET name = $1, selection_type = $2, min_selections = $3, max_selections = $4, is_required = $5
     WHERE id = $6 RETURNING *`,
    [
      data.name ?? row.name,
      data.selectionType ?? row.selection_type,
      data.minSelections ?? row.min_selections,
      data.maxSelections ?? row.max_selections,
      data.isRequired ?? row.is_required,
      groupId,
    ],
  );
  const modsResult = await db.query(`SELECT * FROM modifiers WHERE group_id = $1 ORDER BY name ASC`, [groupId]);
  await invalidateMenuCache(row.store_id as string);
  return { ...rowToGroup(result.rows[0]), modifiers: modsResult.rows.map(rowToModifier) };
}

export async function deleteModifierGroup(groupId: string): Promise<void> {
  const result = await db.query(`DELETE FROM modifier_groups WHERE id = $1 RETURNING store_id`, [groupId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Modifier group ${groupId} not found`);
  await invalidateMenuCache(result.rows[0].store_id as string);
}

export async function addModifier(groupId: string, data: CreateModifierRequest): Promise<Modifier> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO modifiers (id, group_id, name, name_ar, price_adjustment, is_default)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [id, groupId, data.name, data.nameAr ?? null, data.priceAdjustment ?? 0, data.isDefault ?? false],
  );
  await invalidateMenuCacheForGroup(groupId);
  return rowToModifier(result.rows[0]);
}

export async function updateModifier(modifierId: string, data: UpdateModifierRequest): Promise<Modifier> {
  const existing = await db.query(`SELECT * FROM modifiers WHERE id = $1`, [modifierId]);
  if (existing.rowCount === 0) throw new NotFoundError(`Modifier ${modifierId} not found`);
  const row = existing.rows[0];
  const result = await db.query(
    `UPDATE modifiers SET name = $1, name_ar = $2, price_adjustment = $3, is_default = $4, status = $5
     WHERE id = $6 RETURNING *`,
    [
      data.name ?? row.name,
      data.nameAr !== undefined ? data.nameAr : row.name_ar,
      data.priceAdjustment ?? row.price_adjustment,
      data.isDefault ?? row.is_default,
      data.status ?? row.status,
      modifierId,
    ],
  );
  await invalidateMenuCacheForGroup(row.group_id as string);
  return rowToModifier(result.rows[0]);
}

export async function removeModifier(modifierId: string): Promise<void> {
  const result = await db.query(`DELETE FROM modifiers WHERE id = $1 RETURNING group_id`, [modifierId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Modifier ${modifierId} not found`);
  await invalidateMenuCacheForGroup(result.rows[0].group_id as string);
}

function rowToGroup(row: Record<string, unknown>): Omit<ModifierGroup, 'modifiers'> {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    selectionType: row.selection_type as 'single' | 'multiple',
    minSelections: row.min_selections as number,
    maxSelections: row.max_selections as number,
    isRequired: row.is_required as boolean,
  };
}

function rowToModifier(row: Record<string, unknown>): Modifier {
  return {
    id: row.id as string,
    groupId: row.group_id as string,
    name: row.name as string,
    nameAr: row.name_ar as string | undefined,
    priceAdjustment: parseFloat(row.price_adjustment as string),
    isDefault: row.is_default as boolean,
    status: row.status as 'active' | 'inactive',
    inventoryProductId: row.inventory_product_id as string | undefined,
  };
}

export async function resolveIngredientsForOrder(
  items: Array<{ menuItemId: string; quantity: number }>,
): Promise<Array<{ productId: string; quantity: number; unitType: string }>> {
  if (items.length === 0) return [];
  const menuItemIds = items.map((i) => i.menuItemId);
  const placeholders = menuItemIds.map((_, i) => `$${i + 1}`).join(',');
  const result = await db.query(
    `SELECT * FROM menu_item_ingredients WHERE menu_item_id IN (${placeholders})`,
    menuItemIds,
  );
  // Recipe quantities stay in the recipe's own unit (g/ml/pc) here — inventory
  // owns each product's stocking unit (kg/liter/piece/box) in a separate
  // database, so the conversion into that unit has to happen on that side,
  // not here. Returning one entry per ingredient row (rather than pre-summing
  // by product) keeps that conversion simple to do per-row on the way in.
  const out: Array<{ productId: string; quantity: number; unitType: string }> = [];
  for (const row of result.rows) {
    const orderItem = items.find((i) => i.menuItemId === row.menu_item_id);
    if (!orderItem) continue;
    const total = parseFloat(row.quantity) * orderItem.quantity;
    out.push({ productId: row.inventory_product_id, quantity: total, unitType: row.unit_type });
  }
  return out;
}

function rowToIngredient(row: Record<string, unknown>): MenuItemIngredient {
  return {
    id: row.id as string,
    menuItemId: row.menu_item_id as string,
    inventoryProductId: row.inventory_product_id as string,
    quantity: parseFloat(row.quantity as string),
    unitType: row.unit_type as string,
    createdAt: row.created_at as string,
  };
}

// ——————————————————————————————————————————
// Bulk Import
// ——————————————————————————————————————————

export interface BulkImportRow {
  menuName: string;
  categoryName: string;
  itemName: string;
  description?: string;
  price: number;
  taxRate?: number;
  sku?: string;
  status?: string;
  // "veg" or "non_veg" (also accepts "veg"/"non-veg"/"nonveg", case-insensitive)
  dietaryType?: string;
  // "Large:20|Medium:15|Small:12"
  variants?: string;
  // "Choice of Milk:multiple:0:2:Skimmed+3,Almond+5|Beans Type:single:1:1:Colombian,Brazilian+2"
  modifierGroups?: string;
  // "Flour:0.2:kg|Sugar:0.05:kg" — matched against inventory products by name
  // (case-insensitive) within the same store; unmatched names are reported
  // as row errors rather than silently dropped or blocking the whole item.
  ingredients?: string;
}

export interface BulkImportResult {
  created: { menus: number; categories: number; items: number; variants: number; modifierGroups: number; modifiers: number; ingredients: number };
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

// Accepts common spellings/casing so a spreadsheet author doesn't have to
// match the internal enum exactly — "Veg", "vegetarian", "Non-Veg", "NONVEG"
// all resolve; anything else (including blank) leaves it unset rather than
// guessing.
function parseDietaryType(raw: string | undefined): DietaryType | undefined {
  const v = raw?.trim().toLowerCase().replace(/[\s-]/g, '_');
  if (!v) return undefined;
  if (v === 'veg' || v === 'vegetarian') return DietaryType.VEG;
  if (v === 'non_veg' || v === 'nonveg' || v === 'non_vegetarian') return DietaryType.NON_VEG;
  return undefined;
}

// "Large:20|Medium:15" -> [{ name: 'Large', price: 20 }, { name: 'Medium', price: 15 }]
function parseVariantsField(raw: string | undefined): Array<{ name: string; price: number }> {
  if (!raw?.trim()) return [];
  return raw.split('|').map((seg) => seg.trim()).filter(Boolean).map((seg) => {
    const [name, priceStr] = seg.split(':').map((s) => s.trim());
    return { name, price: parseFloat(priceStr) };
  }).filter((v) => v.name && !isNaN(v.price));
}

// "Choice of Milk:multiple:0:2:Skimmed+3,Almond+5" -> one group with two modifiers
function parseModifierGroupsField(raw: string | undefined): Array<{
  name: string; selectionType: 'single' | 'multiple'; minSelections: number; maxSelections: number;
  modifiers: Array<{ name: string; priceAdjustment: number }>;
}> {
  if (!raw?.trim()) return [];
  return raw.split('|').map((seg) => seg.trim()).filter(Boolean).map((seg) => {
    const parts = seg.split(':');
    const name = (parts[0] ?? '').trim();
    const selectionType: 'single' | 'multiple' = parts[1]?.trim() === 'multiple' ? 'multiple' : 'single';
    const minSelections = parts[2] ? parseInt(parts[2], 10) || 0 : 0;
    const maxSelections = parts[3] ? parseInt(parts[3], 10) || 1 : 1;
    const modifiers = (parts.slice(4).join(':') ?? '')
      .split(',').map((m) => m.trim()).filter(Boolean).map((m) => {
        const [modName, priceStr] = m.split('+').map((s) => s.trim());
        return { name: modName, priceAdjustment: priceStr ? (parseFloat(priceStr) || 0) : 0 };
      }).filter((m) => m.name);
    return { name, selectionType, minSelections, maxSelections, modifiers };
  }).filter((g) => g.name);
}

// "Flour:0.2:kg|Sugar:0.05:kg" -> [{ name: 'Flour', quantity: 0.2, unit: 'kg' }, ...]
function parseIngredientsField(raw: string | undefined): Array<{ name: string; quantity: number; unit?: string }> {
  if (!raw?.trim()) return [];
  return raw.split('|').map((seg) => seg.trim()).filter(Boolean).map((seg) => {
    const [name, qtyStr, unit] = seg.split(':').map((s) => s.trim());
    return { name, quantity: parseFloat(qtyStr), unit: unit || undefined };
  }).filter((i) => i.name && !isNaN(i.quantity));
}

// Ingredients come from a different service's database — no FK possible, so
// bulk import resolves each name to an inventory_product_id via an
// inter-service call (the same internal-header trapdoor the order/payment
// services already use for server-to-server calls), rather than requiring
// spreadsheet authors to know UUIDs.
async function resolveInventoryProductId(storeId: string, name: string): Promise<string | undefined> {
  const url = `${config.INVENTORY_SERVICE_URL}/inventory/products-with-stock?storeId=${encodeURIComponent(storeId)}&search=${encodeURIComponent(name)}&limit=10`;
  const res = await fetch(url, { headers: { 'x-internal-service': 'inventory-service' } });
  if (!res.ok) return undefined;
  const body = (await res.json()) as { data?: { data?: Array<{ id: string; name: string }> } };
  const products = body?.data?.data ?? [];
  if (products.length === 0) return undefined;
  const exact = products.find((p) => p.name.toLowerCase() === name.toLowerCase());
  return (exact ?? products[0]).id;
}

export async function bulkImportMenu(storeId: string, rows: BulkImportRow[]): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    created: { menus: 0, categories: 0, items: 0, variants: 0, modifierGroups: 0, modifiers: 0, ingredients: 0 },
    skipped: 0,
    errors: [],
  };

  // Cache of name → id to avoid redundant DB lookups within the same import
  const menuCache = new Map<string, string>();
  const categoryCache = new Map<string, string>(); // key: `${menuId}::${categoryName}`
  const inventoryProductCache = new Map<string, string | null>(); // key: lowercased product name

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header offset

    try {
      if (!row.menuName?.trim() || !row.categoryName?.trim() || !row.itemName?.trim()) {
        result.errors.push({ row: rowNum, message: 'menu_name, category_name, and item_name are required' });
        continue;
      }
      if (!row.price || isNaN(row.price) || row.price <= 0) {
        result.errors.push({ row: rowNum, message: 'price must be a positive number' });
        continue;
      }

      // ── Find or create menu ──────────────────────────────────────────────────
      const menuKey = row.menuName.trim().toLowerCase();
      let menuId: string | undefined = menuCache.get(menuKey);
      if (!menuId) {
        const existing = await db.query(
          `SELECT id FROM menus WHERE store_id = $1 AND LOWER(name) = $2 LIMIT 1`,
          [storeId, menuKey],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          menuId = existing.rows[0].id as string;
        } else {
          const created = await createMenu({ storeId, name: row.menuName.trim() });
          menuId = created.id;
          result.created.menus++;
        }
        menuCache.set(menuKey, menuId!);
      }
      const resolvedMenuId = menuId!;

      // ── Find or create category ──────────────────────────────────────────────
      const catKey = `${resolvedMenuId}::${row.categoryName.trim().toLowerCase()}`;
      let categoryId: string | undefined = categoryCache.get(catKey);
      if (!categoryId) {
        const existing = await db.query(
          `SELECT id FROM menu_categories WHERE menu_id = $1 AND LOWER(name) = $2 LIMIT 1`,
          [resolvedMenuId, row.categoryName.trim().toLowerCase()],
        );
        if (existing.rowCount && existing.rowCount > 0) {
          categoryId = existing.rows[0].id as string;
        } else {
          const created = await createCategory({ menuId: resolvedMenuId, storeId, name: row.categoryName.trim() });
          categoryId = created.id;
          result.created.categories++;
        }
        categoryCache.set(catKey, categoryId!);
      }
      const resolvedCategoryId = categoryId!;

      // ── Find or create item ──────────────────────────────────────────────────
      const existingItem = await db.query(
        `SELECT id FROM menu_items WHERE category_id = $1 AND LOWER(name) = $2 LIMIT 1`,
        [resolvedCategoryId, row.itemName.trim().toLowerCase()],
      );

      let itemId: string;
      if (existingItem.rowCount && existingItem.rowCount > 0) {
        // Item already exists (e.g. a prior import created the bare items) —
        // still attach any variants/option groups/ingredients this row
        // carries, instead of skipping the row (and those relationships)
        // entirely. Re-running the same sheet twice must not duplicate them.
        itemId = existingItem.rows[0].id;
        result.skipped++;
      } else {
        const item = await createItem({
          categoryId: resolvedCategoryId,
          storeId,
          name: row.itemName.trim(),
          description: row.description?.trim() || undefined,
          basePrice: row.price,
          taxRate: row.taxRate ?? 5,
          sku: row.sku?.trim() || undefined,
          dietaryType: parseDietaryType(row.dietaryType),
        });
        result.created.items++;
        itemId = item.id;
      }

      const existingVariantNames = new Set(
        (await db.query(`SELECT LOWER(name) AS name FROM item_variants WHERE menu_item_id = $1`, [itemId])).rows.map((r) => r.name),
      );
      for (const v of parseVariantsField(row.variants)) {
        if (existingVariantNames.has(v.name.toLowerCase())) continue;
        try {
          await addVariant(itemId, { name: v.name, price: v.price });
          result.created.variants++;
        } catch (err: any) {
          result.errors.push({ row: rowNum, message: `Variant "${v.name}": ${err?.message ?? 'failed to create'}` });
        }
      }

      const existingGroupNames = new Set(
        (await db.query(
          `SELECT LOWER(mg.name) AS name FROM modifier_group_items mgi
           JOIN modifier_groups mg ON mg.id = mgi.modifier_group_id
           WHERE mgi.menu_item_id = $1`,
          [itemId],
        )).rows.map((r) => r.name),
      );
      for (const g of parseModifierGroupsField(row.modifierGroups)) {
        if (existingGroupNames.has(g.name.toLowerCase())) continue;
        try {
          const group = await createModifierGroup(itemId, {
            storeId,
            name: g.name,
            selectionType: g.selectionType,
            minSelections: g.minSelections,
            maxSelections: g.maxSelections,
          });
          result.created.modifierGroups++;
          for (const m of g.modifiers) {
            try {
              await addModifier(group.id, { name: m.name, priceAdjustment: m.priceAdjustment });
              result.created.modifiers++;
            } catch (err: any) {
              result.errors.push({ row: rowNum, message: `Option "${m.name}" in "${g.name}": ${err?.message ?? 'failed to create'}` });
            }
          }
        } catch (err: any) {
          result.errors.push({ row: rowNum, message: `Option group "${g.name}": ${err?.message ?? 'failed to create'}` });
        }
      }

      for (const ing of parseIngredientsField(row.ingredients)) {
        try {
          const cacheKey = ing.name.toLowerCase();
          let productId = inventoryProductCache.get(cacheKey);
          if (productId === undefined) {
            productId = (await resolveInventoryProductId(storeId, ing.name)) ?? null;
            inventoryProductCache.set(cacheKey, productId);
          }
          if (!productId) {
            result.errors.push({ row: rowNum, message: `Ingredient "${ing.name}": no matching inventory product found` });
            continue;
          }
          // addIngredient upserts on (menu_item_id, inventory_product_id), so
          // this is already safe to re-run without creating duplicates.
          await addIngredient(itemId, productId, ing.quantity, ing.unit ?? 'piece');
          result.created.ingredients++;
        } catch (err: any) {
          result.errors.push({ row: rowNum, message: `Ingredient "${ing.name}": ${err?.message ?? 'failed to link'}` });
        }
      }
    } catch (err: any) {
      result.errors.push({ row: rowNum, message: err?.message ?? 'Unknown error' });
    }
  }

  if (result.created.menus > 0 || result.created.categories > 0 || result.created.items > 0) {
    await invalidateMenuCache(storeId);
  }

  return result;
}