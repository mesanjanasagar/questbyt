import { Router } from 'express';
import { z } from 'zod';
import {
  createStore,
  getStoreById,
  updateStoreProfile,
  updateBranding,
  updateReceiptConfig,
  resolveTheme,
} from '../services/store.service';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();

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
  currency: z.string().max(10).optional(),
  locale: z.string().max(10).optional(),
  timezone: z.string().max(100).optional(),
  primaryColor: z.string().max(20).optional(),
  logoUrl: z.string().url().optional(),
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const body = CreateStoreSchema.parse(req.body);
    const store = await createStore(body);
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
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

const OperatingHoursSchema = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(/^\d{2}:\d{2}$/),
  close: z.string().regex(/^\d{2}:\d{2}$/),
  closed: z.boolean().optional(),
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