import { apiClient } from './client';
import type { Menu, MenuCategory, MenuItem } from '@pos/shared-types';

export interface FullMenu {
  menus: Menu[];
  categories: MenuCategory[];
  items: MenuItem[];
}

export async function getFullMenu(storeId: string): Promise<FullMenu> {
  const res = await apiClient.get('/api/v1/menus/full', { params: { storeId } });
  return res.data.data as FullMenu;
}