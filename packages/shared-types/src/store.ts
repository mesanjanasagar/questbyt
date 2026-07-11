//
// Store Profile + Branding / White-label types
//

export type BusinessType = 'restaurant' | 'cafe' | 'bakery' | 'food_truck' | 'cloud_kitchen' | 'retail';
export type CurrencyCode = 'AED' | 'SAR' | 'USD' | 'GBP' | 'EUR';
export type AppLocale = 'en' | 'ar' | 'fr' | 'ur';

export interface StoreProfile {
  id: string;
  name: string; // "The Grill House"
  legalName?: string; // for receipts / invoices
  businessType: BusinessType;
  description?: string;
  tagline?: string; // shown on kiosk welcome screen
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string; // shown on receipt
  currency: CurrencyCode;
  locale: AppLocale; // drives UI language
  timezone: string; // 'Asia/Dubai'
  address: StoreAddress;
  branding: BrandingConfig;
  receiptConfig: ReceiptConfig;
  operatingHours: OperatingHours[];
  isActive: boolean;
  // Whether POS terminals prompt for customer name/phone/email while taking
  // an order. Off by default suits quick-service; sit-down/loyalty-driven
  // restaurants usually want it on.
  posCaptureCustomerDetails: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StoreAddress {
  line1: string;
  line2?: string;
  city: string;
  country: string;
  postalCode?: string;
}

export interface BrandingConfig {
  // Core identity
  logoUrl?: string; // full URL to uploaded logo
  faviconUrl?: string;
  primaryColor: string; // hex — "#C8102E"
  secondaryColor: string; // hex — "#1A1A2E"
  accentColor: string; // hex — "#FFD700"
  backgroundColor: string; // hex — "#FFFFFF"
  textColor: string; // hex — "#111111"

  // Typography
  fontFamily: string; // 'Inter' | 'Cairo' (for Arabic) | 'Playfair Display'

  // Display preferences
  displayName: string; // shown in header / kiosk (may differ from legal name)
  welcomeMessage?: string; // kiosk welcome — "Welcome to The Grill House!"
  orderReadyMessage?: string; // KDS → customer display "Your order is ready!"

  // App surfaces
  posHeaderText?: string; // small text under logo on POS
  kioskBackground?: string; // URL to kiosk wallpaper image
  kdsHeaderColor?: string; // override header color on KDS specifically
}

export interface ReceiptConfig {
  headerText?: string; // printed at top of receipt
  footerText?: string; // "Thank you! Come again."
  showLogo: boolean;
  showVatNumber: boolean;
  showStoreAddress: boolean;
  showOrderType: boolean;
  showCashierName: boolean;
  digitalReceiptEnabled: boolean;
  digitalReceiptChannel: 'email' | 'sms' | 'whatsapp';
}

export interface OperatingHours {
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun
  openTime: string; // "09:00"
  closeTime: string; // "23:00"
  isClosed: boolean;
}

export interface CreateStoreRequest {
  name: string;
  businessType: BusinessType;
  currency?: CurrencyCode;
  locale?: AppLocale;
  timezone?: string;
  primaryColor?: string;
  logoUrl?: string;
}

export interface UpdateBrandingRequest {
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  fontFamily?: string;
  displayName?: string;
  welcomeMessage?: string;
  orderReadyMessage?: string;
  posHeaderText?: string;
  kioskBackground?: string;
  kdsHeaderColor?: string;
}


// ─── Branch (physical location / outlet) ─────────────────────────────────────

export interface Branch {
  id: string;
  storeId: string;
  branchCode: string;
  name: string;
  address?: StoreAddress;
  phone?: string;
  email?: string;
  timezone: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchRequest {
  storeId: string;
  branchCode: string;
  name: string;
  address?: StoreAddress;
  phone?: string;
  email?: string;
  timezone?: string;
  isMain?: boolean;
}

// ─── Dining Area (floor / section within a branch) ───────────────────────────

export interface DiningArea {
  id: string;
  branchId: string;
  storeId: string;
  name: string;
  description?: string;
  floorNumber: number;
  createdAt: string;
}

export interface CreateDiningAreaRequest {
  branchId: string;
  storeId: string;
  name: string;
  description?: string;
  floorNumber?: number;
}

// ─── Table ───────────────────────────────────────────────────────────────────

export interface Table {
  id: string;
  diningAreaId: string;
  branchId: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning' | 'food_preparing' | 'ready_to_serve' | 'bill_requested' | 'paid';
  qrCodeUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTableRequest {
  diningAreaId: string;
  branchId: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
}

// ─── Staff Profile (store-service data, links to auth-service user) ──────────

export interface StaffProfile {
  id: string;
  userId: string;
  storeId: string;
  branchId?: string;
  employeeNumber: string;
  position?: string;
  pin?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Payment Configuration ───────────────────────────────────────────────────

export interface PaymentConfiguration {
  id: string;
  storeId: string;
  cashEnabled: boolean;
  cardEnabled: boolean;
  enabledMethods: string[];
  currency: string;
  updatedAt: string;
}

// ─── Notification Configuration ──────────────────────────────────────────────

export interface NotificationConfiguration {
  id: string;
  storeId: string;
  managerPhone?: string;
  managerEmail?: string;
  lowStockAlerts: boolean;
  orderAlerts: boolean;
  channels: string[];
  updatedAt: string;
}

// ─── Onboarding State ────────────────────────────────────────────────────────

export type OnboardingStep =
  | 'restaurant_setup'
  | 'branch_created'
  | 'tables_configured'
  | 'staff_added'
  | 'device_registered'
  | 'menu_created'
  | 'inventory_configured'
  | 'payment_configured'
  | 'notifications_configured'
  | 'completed';

export interface OnboardingState {
  storeId: string;
  currentStep: OnboardingStep;
  completedSteps: OnboardingStep[];
  isComplete: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Resolved theme — returned to frontend apps at boot ─────────────────────
// Contains everything needed to render the branded experience
export interface ResolvedTheme {
  storeId: string;
  displayName: string;
  logoUrl?: string;
  faviconUrl?: string;
  tagline?: string;
  welcomeMessage?: string;
  orderReadyMessage?: string;
  posHeaderText?: string;
  kioskBackground?: string;
  kdsHeaderColor?: string;
  currency: CurrencyCode;
  locale: AppLocale;
  timezone: string;
  cssVariables: {
    '--color-primary': string;
    '--color-secondary': string;
    '--color-accent': string;
    '--color-background': string;
    '--color-text': string;
    '--font-family': string;
  };
}