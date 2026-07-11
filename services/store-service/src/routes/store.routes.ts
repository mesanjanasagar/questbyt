import { Router, IRouter } from 'express';
import { z } from 'zod';
import https from 'https';
import http from 'http';
import {
  createStore,
  listStores,
  getStoreById,
  updateStoreProfile,
  updateBranding,
  updateReceiptConfig,
  resolveTheme,
  setStoreStatus,
  deleteStore,
} from '../services/store.service';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/authenticate';
import { config } from '../config';

function linkUserToStore(userId: string, storeId: string): void {
  const body = JSON.stringify({ storeId });
  const url = new URL(`/users/${userId}/store`, config.AUTH_SERVICE_URL);
  const mod = url.protocol === 'https:' ? https : http;
  const req = mod.request(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
      'x-internal-service': config.INTERNAL_SERVICE_SECRET,
    },
  });
  req.on('error', (err) =>
    console.warn('[store-service] Could not link user to store in auth-service:', err.message),
  );
  req.write(body);
  req.end();
}

const router: IRouter = Router();

// ——————————————————————————————————————————
// PUBLIC — called by every frontend at boot
// No auth required; storeId is from the URL
// ——————————————————————————————————————————

/**
 * GET /stores/:storeId/theme
 * Returns CSS variables + display text for white-labelled UI rendering
 */
router.get('/:storeId/theme', async (req, res, next) => {
  try {
    const theme = await resolveTheme(req.params.storeId);
    res.json(theme);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// All routes below require a valid JWT
// ——————————————————————————————————————————

router.use(authenticate);

// ——————————————————————————————————————————
// Create store (onboarding)
// ——————————————————————————————————————————

const CreateStoreSchema = z.object({
  name: z.string().min(1).max(255),
  businessType: z.enum(['restaurant', 'cafe', 'bakery', 'food_truck', 'cloud_kitchen', 'retail']),
  currency: z.enum(['AED', 'SAR', 'USD', 'GBP', 'EUR']).optional(),
  locale: z.enum(['en', 'ar', 'fr', 'ur']).optional(),
  timezone: z.string().max(100).optional(),
  primaryColor: z.string().max(20).optional(),
  logoUrl: z.string().url().optional(),
});

// ——————————————————————————————————————————
// List all stores (admin only)
// ——————————————————————————————————————————

router.get('/', requireAdmin, async (_req, res, next) => {
  try {
    const stores = await listStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = CreateStoreSchema.parse(req.body);
    const store = await createStore(body);
    // Sync the creating user's storeId in auth-service so their JWT stays valid
    if (req.userId) linkUserToStore(req.userId, store.id);
    res.status(201).json(store);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Get full store profile
// ——————————————————————————————————————————

router.get('/:storeId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const store = await getStoreById(req.params.storeId);
    res.json(store);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Update store profile (name, hours, address, etc.)
// ——————————————————————————————————————————

const AddressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().optional(),
  country: z.string().min(1),
  postalCode: z.string().optional(),
});

const OperatingHoursSchema = z.object({
  dayOfWeek: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isClosed: z.boolean().optional().default(false),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  legalName: z.string().max(255).optional(),
  description: z.string().optional(),
  tagline: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional(),
  website: z.string().url().optional(),
  vatNumber: z.string().max(100).optional(),
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
  address: AddressSchema.optional(),
  operatingHours: z.array(OperatingHoursSchema).optional(),
  posCaptureCustomerDetails: z.boolean().optional(),
});

router.patch('/:storeId', requireAdmin, async (req, res, next) => {
  try {
    const body = UpdateProfileSchema.parse(req.body);
    const store = await updateStoreProfile(req.params.storeId, body);
    res.json(store);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Activate / deactivate a store
// ——————————————————————————————————————————

router.patch('/:storeId/status', requireAdmin, async (req, res, next) => {
  try {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const store = await setStoreStatus(req.params.storeId, isActive);
    res.json(store);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Delete a store (hard delete — cascades to all child data)
// ——————————————————————————————————————————

router.delete('/:storeId', requireAdmin, async (req, res, next) => {
  try {
    await deleteStore(req.params.storeId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Update branding (the personalisation layer)
// ——————————————————————————————————————————

const UpdateBrandingSchema = z.object({
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  primaryColor: z.string().max(20).optional(),
  secondaryColor: z.string().max(20).optional(),
  accentColor: z.string().max(20).optional(),
  backgroundColor: z.string().max(20).optional(),
  textColor: z.string().max(20).optional(),
  fontFamily: z.string().max(100).optional(),
  displayName: z.string().max(255).optional(),
  welcomeMessage: z.string().optional(),
  orderReadyMessage: z.string().optional(),
  posHeaderText: z.string().max(255).optional(),
  kioskBackground: z.string().optional(),
  kdsHeaderColor: z.string().max(20).optional(),
});

router.patch('/:storeId/branding', requireAdmin, async (req, res, next) => {
  try {
    const body = UpdateBrandingSchema.parse(req.body);
    const store = await updateBranding(req.params.storeId, body);
    res.json(store);
  } catch (err) {
    next(err);
  }
});

// ——————————————————————————————————————————
// Update receipt config
// ——————————————————————————————————————————

const UpdateReceiptSchema = z.object({
  headerText: z.string().optional(),
  footerText: z.string().optional(),
  showLogo: z.boolean().optional(),
  showVatNumber: z.boolean().optional(),
  showStoreAddress: z.boolean().optional(),
  showOrderType: z.boolean().optional(),
  showCashierName: z.boolean().optional(),
  digitalReceiptEnabled: z.boolean().optional(),
  digitalReceiptChannel: z.enum(['email', 'sms', 'whatsapp']).optional(),
});

router.patch('/:storeId/receipt-config', requireAdmin, async (req, res, next) => {
  try {
    const body = UpdateReceiptSchema.parse(req.body);
    const store = await updateReceiptConfig(req.params.storeId, body);
    res.json(store);
  } catch (err) {
    next(err);
  }
});

export { router as storeRoutes };