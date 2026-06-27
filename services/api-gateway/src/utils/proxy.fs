import { Request } from 'express';
import { config } from '../config';

export interface ServiceRoute {
  path: string;
  target: string;
  methods?: string[];
}

export const SERVICE_ROUTES: ServiceRoute[] = [
  // Auth
  { path: '/api/v1/auth', target: config.AUTH_SERVICE_URL },
  { path: '/api/v1/users', target: config.AUTH_SERVICE_URL },
  { path: '/api/v1/devices', target: config.AUTH_SERVICE_URL },

  // Orders
  { path: '/api/v1/orders', target: config.ORDER_SERVICE_URL },

  // Menu
  { path: '/api/v1/menus', target: config.MENU_SERVICE_URL },
  { path: '/api/v1/items', target: config.MENU_SERVICE_URL },
  { path: '/api/v1/modifiers', target: config.MENU_SERVICE_URL },

  // Inventory
  { path: '/api/v1/inventory', target: config.INVENTORY_SERVICE_URL },
  { path: '/api/v1/products', target: config.INVENTORY_SERVICE_URL },

  // Payments
  { path: '/api/v1/payments', target: config.PAYMENT_SERVICE_URL },

  // Customers
  { path: '/api/v1/customers', target: config.CUSTOMER_SERVICE_URL },
  { path: '/api/v1/loyalty', target: config.CUSTOMER_SERVICE_URL },

  // Marketing
  { path: '/api/v1/campaigns', target: config.MARKETING_SERVICE_URL },

  // Reporting
  { path: '/api/v1/reports', target: config.REPORTING_SERVICE_URL },
  { path: '/api/v1/analytics', target: config.REPORTING_SERVICE_URL },

  // Store
  { path: '/api/v1/stores', target: config.STORE_SERVICE_URL },

  // Notifications
  { path: '/api/v1/notifications', target: config.NOTIFICATION_SERVICE_URL },

  // Sync
  { path: '/api/v1/sync', target: config.SYNC_SERVICE_URL },

  // Churn
  { path: '/api/v1/churn', target: config.CHURN_SERVICE_URL },

  // Reservations
  { path: '/api/v1/reservations', target: config.RESERVATION_SERVICE_URL },

  // AI Manager
  { path: '/api/v1/ai', target: config.AI_MANAGER_SERVICE_URL },
];

export function getServiceTarget(req: Request): string | null {
  const path = req.path;

  for (const route of SERVICE_ROUTES) {
    if (path.startsWith(route.path)) {
      if (route.methods && !route.methods.includes(req.method)) {
        return null;
      }
      return route.target;
    }
  }

  return null;
}

export function injectCorrelationId(req: Request): void {
  if (!req.headers['x-correlation-id']) {
    req.headers['x-correlation-id'] = req.correlationId || `gw-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  if (req.user) {
    // Inject user info as header for service-to-service
    req.headers['x-user-id'] = req.user.sub;
    req.headers['x-store-id'] = req.user.storeId;
    req.headers['x-permissions'] = JSON.stringify(req.user.permissions);
  }
}