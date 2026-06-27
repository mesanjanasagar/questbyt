import { db } from '../db/client';
import { redisClient } from '../redis/client';
import { config } from '../config';
import { generateId, NotFoundError, buildPaginatedResponse } from '@pos/shared-utils';
import type { Menu, MenuCategory, MenuItem, CreateMenuRequest, CreateCategoryRequest, CreateMenuItemRequest } from '@pos/shared-types';

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

export async function updateCategory(id: string, data: Partial<CreateCategoryRequest>): Promise<MenuCategory> {
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
      row.status,
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
    `SELECT * FROM menu_items WHERE category_id = $1 AND status != 'hidden' ORDER BY sort_order ASC`,
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
      (id, category_id, store_id, name, name_ar, description, base_price, tax_rate, sku, calories, allergens, tags, inventory_product_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
    [
      id, data.categoryId, data.storeId, data.name,
      data.nameAr ?? null, data.description ?? null,
      data.basePrice, data.taxRate ?? 5.0,
      data.sku ?? null, data.calories ?? null,
      data.allergens ?? null, data.tags ?? null,
      data.inventoryProductId ?? null,
    ],
  );

  await invalidateMenuCache(data.storeId);
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
    db.query(`SELECT * FROM menu_items WHERE store_id = $1 AND status != 'hidden' ORDER BY sort_order ASC`, [storeId]),
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
    status: row.status as import('@pos/shared-types').MenuItemStatus,
    sortOrder: row.sort_order as number,
    isFeatured: row.is_featured as boolean,
    inventoryProductId: row.inventory_product_id as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}