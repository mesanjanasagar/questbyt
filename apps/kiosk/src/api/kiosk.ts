import axios from 'axios';
import { MenuItem, Category } from '../types';

const api = axios.create({ baseURL: 'http://localhost:3000/api/v1' });

// — Mock data ————————————————————————————————————————————
const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Burgers', sortOrder: 1 },
  { id: 'cat-2', name: 'Pizza', sortOrder: 2 },
  { id: 'cat-3', name: 'Sides', sortOrder: 3 },
  { id: 'cat-4', name: 'Drinks', sortOrder: 4 },
  { id: 'cat-5', name: 'Desserts', sortOrder: 5 },
];

const MOCK_ITEMS: MenuItem[] = [
  {
    id: 'item-1', name: 'Classic Burger', description: 'Beef patty, lettuce, tomato, pickles',
    price: 8.99, imageUrl: null, category: 'cat-1', available: true,
    modifierGroups: [
      {
        id: 'mg-1', name: 'Size', required: true, minSelections: 1, maxSelections: 1,
        modifiers: [
          { id: 'mod-1', name: 'Regular', price: 0 },
          { id: 'mod-2', name: 'Large', price: 2.00 },
        ],
      },
      {
        id: 'mg-2', name: 'Add Extras', required: false, minSelections: 0, maxSelections: 3,
        modifiers: [
          { id: 'mod-3', name: 'Extra Cheese', price: 0.50 },
          { id: 'mod-4', name: 'Bacon', price: 1.50 },
          { id: 'mod-5', name: 'Avocado', price: 1.00 },
        ],
      },
    ],
  },
  {
    id: 'item-2', name: 'BBQ Bacon Burger', description: 'Smoky BBQ sauce, crispy bacon, cheddar',
    price: 11.99, imageUrl: null, category: 'cat-1', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-3', name: 'Mushroom Swiss', description: 'Sautéed mushrooms, Swiss cheese, garlic aioli',
    price: 10.99, imageUrl: null, category: 'cat-1', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-4', name: 'Veggie Patty', description: 'Plant-based patty with fresh veggies',
    price: 9.49, imageUrl: null, category: 'cat-1', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-5', name: 'Margherita Pizza', description: 'Tomato, mozzarella, fresh basil',
    price: 12.99, imageUrl: null, category: 'cat-2', available: true,
    modifierGroups: [
      {
        id: 'mg-3', name: 'Crust', required: true, minSelections: 1, maxSelections: 1,
        modifiers: [
          { id: 'mod-6', name: 'Thin', price: 0 },
          { id: 'mod-7', name: 'Thick', price: 1.00 },
        ],
      },
    ],
  },
  {
    id: 'item-6', name: 'Pepperoni Pizza', description: 'Classic pepperoni with tomato sauce',
    price: 14.99, imageUrl: null, category: 'cat-2', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-7', name: 'Large Fries', description: 'Crispy golden fries',
    price: 3.99, imageUrl: null, category: 'cat-3', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-8', name: 'Onion Rings', description: 'Beer-battered onion rings',
    price: 4.49, imageUrl: null, category: 'cat-3', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-9', name: 'Caesar Salad', description: 'Romaine, parmesan, croutons',
    price: 7.99, imageUrl: null, category: 'cat-3', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-10', name: 'Coke', description: 'Chilled Coca-Cola 500ml',
    price: 2.49, imageUrl: null, category: 'cat-4', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-11', name: 'Fresh Lemonade', description: 'Freshly squeezed with mint',
    price: 3.49, imageUrl: null, category: 'cat-4', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-12', name: 'Milkshake', description: 'Choose vanilla, chocolate, or strawberry',
    price: 4.99, imageUrl: null, category: 'cat-4', available: true,
    modifierGroups: [
      {
        id: 'mg-4', name: 'Flavour', required: true, minSelections: 1, maxSelections: 1,
        modifiers: [
          { id: 'mod-8', name: 'Vanilla', price: 0 },
          { id: 'mod-9', name: 'Chocolate', price: 0 },
          { id: 'mod-10', name: 'Strawberry', price: 0 },
        ],
      },
    ],
  },
  {
    id: 'item-13', name: 'Chocolate Lava Cake', description: 'Warm chocolate cake with vanilla ice cream',
    price: 5.99, imageUrl: null, category: 'cat-5', available: true,
    modifierGroups: [],
  },
  {
    id: 'item-14', name: 'Cheesecake', description: 'NY-style with berry compote',
    price: 5.49, imageUrl: null, category: 'cat-5', available: true,
    modifierGroups: [],
  },
];

// — API ————————————————————————————————————————————
export const kioskAPI = {
  // Loads the full menu catalog (categories + items) for a store without auth.
  getCatalog: async (storeId: string): Promise<{ categories: Category[]; items: MenuItem[] }> => {
    const res = await api.get('/menus/full', { params: { storeId } });
    const raw = (res.data?.data ?? {}) as { categories?: any[]; items?: any[] };

    const categories: Category[] = (raw.categories ?? [])
      .filter((c: any) => c.status === 'active')
      .map((c: any) => ({ id: c.id, name: c.name, sortOrder: c.displayOrder ?? 0 }));

    const items: MenuItem[] = (raw.items ?? [])
      .filter((i: any) => i.status === 'active')
      .map((i: any) => ({
        id: i.id,
        name: i.name,
        description: i.description ?? null,
        price: i.basePrice,
        imageUrl: i.imageUrl ?? null,
        category: i.categoryId,
        available: true,
        modifierGroups: [],
      }));

    return { categories, items };
  },

  getCategories: async (_menuId: string): Promise<Category[]> => {
    try {
      const res = await api.get<{ data: Category[] }>(`/menus/${_menuId}/categories`);
      return res.data.data;
    } catch {
      return MOCK_CATEGORIES;
    }
  },

  getMenuItems: async (_menuId: string, categoryId?: string): Promise<MenuItem[]> => {
    try {
      const res = await api.get<{ data: MenuItem[] }>(`/menus/${_menuId}/items`, {
        params: categoryId ? { categoryId } : undefined,
      });
      return res.data.data;
    } catch {
      if (categoryId) {
        return MOCK_ITEMS.filter((i) => i.category === categoryId);
      }
      return MOCK_ITEMS;
    }
  },

  createOrder: async (
    storeId: string,
    items: { menuItemId: string; quantity: number; unitPrice: number; modifiers: string[] }[],
  ): Promise<{ id: string; orderNumber: number }> => {
    const res = await api.post<{ data: { id: string; orderNumber: number } }>('/orders/kiosk', {
      storeId,
      items: items.map(({ menuItemId, quantity, unitPrice, modifiers }) => ({
        menuItemId,
        quantity,
        unitPrice,
        modifierIds: modifiers,
      })),
    });
    return res.data.data;
  },

  processPayment: async (
    orderId: string,
    method: string,
    amount: number
  ): Promise<void> => {
    try {
      await api.post('/payments', { orderId, paymentMethod: method, amount });
    } catch {
      // Payment service is optional — kiosk order is already persisted
    }
  },
};