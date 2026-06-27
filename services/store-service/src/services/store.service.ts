import { db } from '../db/client';
import { generateId, NotFoundError } from '@pos/shared-utils';
import type {
  StoreProfile,
  BrandingConfig,
  ReceiptConfig,
  ResolvedTheme,
  CreateStoreRequest,
  UpdateBrandingRequest,
  OperatingHours,
  StoreAddress,
} from '@pos/shared-types';

// ——————————————————————————————————————————
// Default branding — used until restaurant customises
// ——————————————————————————————————————————

const DEFAULT_BRANDING = {
  primary_color: '#1A73E8',
  secondary_color: '#1A1A2E',
  accent_color: '#FFD700',
  background_color: '#FFFFFF',
  text_color: '#111111',
  font_family: 'Inter',
  welcome_message: 'Welcome! Please place your order.',
  order_ready_message: 'Your order is ready!',
};

const DEFAULT_RECEIPT = {
  show_logo: true,
  show_vat_number: true,
  show_store_address: true,
  show_order_type: true,
  show_cashier_name: false,
  digital_receipt_enabled: false,
  digital_receipt_channel: 'whatsapp',
};

// ——————————————————————————————————————————
// Create store (called on onboarding)
// Automatically seeds branding + receipt config with defaults
// ——————————————————————————————————————————

export async function createStore(req: CreateStoreRequest): Promise<StoreProfile> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const storeId = generateId();

    // 1. Create store
    await client.query(
      `INSERT INTO stores (id, name, business_type, currency, locale, timezone)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        storeId, req.name, req.businessType,
        req.currency ?? 'AED',
        req.locale ?? 'en',
        req.timezone ?? 'Asia/Dubai',
      ],
    );

    // 2. Seed branding with defaults — restaurant can customise later
    await client.query(
      `INSERT INTO store_branding
        (id, store_id, display_name, primary_color, secondary_color, accent_color,
         background_color, text_color, font_family, logo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        generateId(), storeId, req.name,
        req.primaryColor ?? DEFAULT_BRANDING.primary_color,
        DEFAULT_BRANDING.secondary_color,
        DEFAULT_BRANDING.accent_color,
        DEFAULT_BRANDING.background_color,
        DEFAULT_BRANDING.text_color,
        DEFAULT_BRANDING.font_family,
        req.logoUrl ?? null,
      ],
    );

    // 3. Seed receipt config
    await client.query(
      `INSERT INTO store_receipt_config
        (id, store_id, footer_text, show_logo, show_vat_number,
         show_store_address, show_order_type, digital_receipt_enabled, digital_receipt_channel)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        generateId(), storeId,
        `Thank you for visiting ${req.name}!`,
        DEFAULT_RECEIPT.show_logo,
        DEFAULT_RECEIPT.show_vat_number,
        DEFAULT_RECEIPT.show_store_address,
        DEFAULT_RECEIPT.show_order_type,
        DEFAULT_RECEIPT.digital_receipt_enabled,
        DEFAULT_RECEIPT.digital_receipt_channel,
      ],
    );

    await client.query('COMMIT');
    return getStoreById(storeId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ——————————————————————————————————————————
// Get full store profile
// ——————————————————————————————————————————

export async function getStoreById(storeId: string): Promise<StoreProfile> {
  const [storeRes, brandingRes, receiptRes] = await Promise.all([
    db.query(`SELECT * FROM stores WHERE id = $1`, [storeId]),
    db.query(`SELECT * FROM store_branding WHERE store_id = $1`, [storeId]),
    db.query(`SELECT * FROM store_receipt_config WHERE store_id = $1`, [storeId]),
  ]);

  if (!storeRes.rowCount || storeRes.rowCount === 0) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  return assembleStoreProfile(
    storeRes.rows[0],
    brandingRes.rows[0],
    receiptRes.rows[0],
  );
}

// ——————————————————————————————————————————
// Update store profile (name, hours, address, etc.)
// ——————————————————————————————————————————

export async function updateStoreProfile(
  storeId: string,
  req: Partial<{
    name: string;
    legalName: string;
    description: string;
    tagline: string;
    phone: string;
    email: string;
    website: string;
    vatNumber: string;
    currency: string;
    locale: string;
    timezone: string;
    address: StoreAddress;
    operatingHours: OperatingHours[];
  }>,
): Promise<StoreProfile> {
  await db.query(
    `UPDATE stores
     SET name             = COALESCE($2, name),
         legal_name       = COALESCE($3, legal_name),
         description      = COALESCE($4, description),
         tagline          = COALESCE($5, tagline),
         phone            = COALESCE($6, phone),
         email            = COALESCE($7, email),
         website          = COALESCE($8, website),
         vat_number       = COALESCE($9, vat_number),
         currency         = COALESCE($10, currency),
         locale           = COALESCE($11, locale),
         timezone         = COALESCE($12, timezone),
         address          = COALESCE($13, address),
         operating_hours  = COALESCE($14, operating_hours),
         updated_at       = NOW()
     WHERE id = $1`,
    [
      storeId,
      req.name ?? null, req.legalName ?? null, req.description ?? null,
      req.tagline ?? null, req.phone ?? null, req.email ?? null,
      req.website ?? null, req.vatNumber ?? null, req.currency ?? null,
      req.locale ?? null, req.timezone ?? null,
      req.address ? JSON.stringify(req.address) : null,
      req.operatingHours ? JSON.stringify(req.operatingHours) : null,
    ],
  );
  return getStoreById(storeId);
}

// ——————————————————————————————————————————
// Update branding (the personalisation layer)
// ——————————————————————————————————————————

export async function updateBranding(
  storeId: string,
  req: UpdateBrandingRequest,
): Promise<StoreProfile> {
  await db.query(
    `UPDATE store_branding
     SET logo_url              = COALESCE($2, logo_url),
         favicon_url           = COALESCE($3, favicon_url),
         primary_color         = COALESCE($4, primary_color),
         secondary_color       = COALESCE($5, secondary_color),
         accent_color          = COALESCE($6, accent_color),
         background_color      = COALESCE($7, background_color),
         text_color            = COALESCE($8, text_color),
         font_family           = COALESCE($9, font_family),
         display_name          = COALESCE($10, display_name),
         welcome_message       = COALESCE($11, welcome_message),
         order_ready_message   = COALESCE($12, order_ready_message),
         pos_header_text       = COALESCE($13, pos_header_text),
         kiosk_background      = COALESCE($14, kiosk_background),
         kds_header_color      = COALESCE($15, kds_header_color),
         updated_at            = NOW()
     WHERE store_id = $1`,
    [
      storeId,
      req.logoUrl ?? null, req.faviconUrl ?? null,
      req.primaryColor ?? null, req.secondaryColor ?? null,
      req.accentColor ?? null, req.backgroundColor ?? null,
      req.textColor ?? null, req.fontFamily ?? null,
      req.displayName ?? null, req.welcomeMessage ?? null,
      req.orderReadyMessage ?? null, req.posHeaderText ?? null,
      req.kioskBackground ?? null, req.kdsHeaderColor ?? null,
    ],
  );
  return getStoreById(storeId);
}

// ——————————————————————————————————————————
// Update receipt config
// ——————————————————————————————————————————

export async function updateReceiptConfig(
  storeId: string,
  req: Partial<ReceiptConfig>,
): Promise<StoreProfile> {
  await db.query(
    `UPDATE store_receipt_config
     SET header_text              = COALESCE($2, header_text),
         footer_text              = COALESCE($3, footer_text),
         show_logo                = COALESCE($4, show_logo),
         show_vat_number          = COALESCE($5, show_vat_number),
         show_store_address       = COALESCE($6, show_store_address),
         show_order_type          = COALESCE($7, show_order_type),
         show_cashier_name        = COALESCE($8, show_cashier_name),
         digital_receipt_enabled  = COALESCE($9, digital_receipt_enabled),
         digital_receipt_channel  = COALESCE($10, digital_receipt_channel),
         updated_at               = NOW()
     WHERE store_id = $1`,
    [
      storeId,
      req.headerText ?? null, req.footerText ?? null,
      req.showLogo ?? null, req.showVatNumber ?? null,
      req.showStoreAddress ?? null, req.showOrderType ?? null,
      req.showCashierName ?? null, req.digitalReceiptEnabled ?? null,
      req.digitalReceiptChannel ?? null,
    ],
  );
  return getStoreById(storeId);
}

// ——————————————————————————————————————————
// Resolve theme — the key API called by every frontend at boot
// Returns CSS variables + all display text needed to personalise the UI
// ——————————————————————————————————————————

export async function resolveTheme(storeId: string): Promise<ResolvedTheme> {
  const [storeRes, brandingRes] = await Promise.all([
    db.query(`SELECT * FROM stores WHERE id = $1 AND is_active = TRUE`, [storeId]),
    db.query(`SELECT * FROM store_branding WHERE store_id = $1`, [storeId]),
  ]);

  if (!storeRes.rowCount || storeRes.rowCount === 0) {
    throw new NotFoundError(`Store ${storeId} not found`);
  }

  const store = storeRes.rows[0];
  const b = brandingRes.rows[0] ?? {};

  return {
    storeId,
    displayName: b.display_name ?? store.name,
    logoUrl: b.logo_url ?? undefined,
    faviconUrl: b.favicon_url ?? undefined,
    tagline: store.tagline ?? undefined,
    welcomeMessage: b.welcome_message ?? DEFAULT_BRANDING.welcome_message,
    orderReadyMessage: b.order_ready_message ?? DEFAULT_BRANDING.order_ready_message,
    posHeaderText: b.pos_header_text ?? undefined,
    kioskBackground: b.kiosk_background ?? undefined,
    kdsHeaderColor: b.kds_header_color ?? b.primary_color ?? DEFAULT_BRANDING.primary_color,
    currency: store.currency,
    locale: store.locale,
    timezone: store.timezone,
    cssVariables: {
      '--color-primary': b.primary_color ?? DEFAULT_BRANDING.primary_color,
      '--color-secondary': b.secondary_color ?? DEFAULT_BRANDING.secondary_color,
      '--color-accent': b.accent_color ?? DEFAULT_BRANDING.accent_color,
      '--color-background': b.background_color ?? DEFAULT_BRANDING.background_color,
      '--color-text': b.text_color ?? DEFAULT_BRANDING.text_color,
      '--font-family': b.font_family ?? DEFAULT_BRANDING.font_family,
    },
  };
}

// ——————————————————————————————————————————
// Assembler — joins store + branding + receipt rows
// ——————————————————————————————————————————

function assembleStoreProfile(
  store: Record<string, unknown>,
  branding: Record<string, unknown>,
  receipt: Record<string, unknown>,
): StoreProfile {
  const b = branding ?? {};
  const r = receipt ?? {};

  const brandingConfig: BrandingConfig = {
    logoUrl: b.logo_url as string | undefined,
    faviconUrl: b.favicon_url as string | undefined,
    primaryColor: (b.primary_color as string) ?? DEFAULT_BRANDING.primary_color,
    secondaryColor: (b.secondary_color as string) ?? DEFAULT_BRANDING.secondary_color,
    accentColor: (b.accent_color as string) ?? DEFAULT_BRANDING.accent_color,
    backgroundColor: (b.background_color as string) ?? DEFAULT_BRANDING.background_color,
    textColor: (b.text_color as string) ?? DEFAULT_BRANDING.text_color,
    fontFamily: (b.font_family as string) ?? DEFAULT_BRANDING.font_family,
    displayName: (b.display_name as string) ?? (store.name as string),
    welcomeMessage: b.welcome_message as string | undefined,
    orderReadyMessage: b.order_ready_message as string | undefined,
    posHeaderText: b.pos_header_text as string | undefined,
    kioskBackground: b.kiosk_background as string | undefined,
    kdsHeaderColor: b.kds_header_color as string | undefined,
  };

  const receiptConfig: ReceiptConfig = {
    headerText: r.header_text as string | undefined,
    footerText: r.footer_text as string | undefined,
    showLogo: (r.show_logo as boolean) ?? true,
    showVatNumber: (r.show_vat_number as boolean) ?? true,
    showStoreAddress: (r.show_store_address as boolean) ?? true,
    showOrderType: (r.show_order_type as boolean) ?? true,
    showCashierName: (r.show_cashier_name as boolean) ?? false,
    digitalReceiptEnabled: (r.digital_receipt_enabled as boolean) ?? false,
    digitalReceiptChannel: (r.digital_receipt_channel as 'email' | 'sms' | 'whatsapp') ?? 'whatsapp',
  };

  return {
    id: store.id as string,
    name: store.name as string,
    legalName: store.legal_name as string | undefined,
    businessType: store.business_type as StoreProfile['businessType'],
    description: store.description as string | undefined,
    tagline: store.tagline as string | undefined,
    phone: store.phone as string | undefined,
    email: store.email as string | undefined,
    website: store.website as string | undefined,
    vatNumber: store.vat_number as string | undefined,
    currency: store.currency as StoreProfile['currency'],
    locale: store.locale as StoreProfile['locale'],
    timezone: store.timezone as string,
    address: store.address as StoreProfile['address'],
    branding: brandingConfig,
    receiptConfig,
    operatingHours: (store.operating_hours as OperatingHours[]) ?? [],
    isActive: store.is_active as boolean,
    createdAt: store.created_at as string,
    updatedAt: store.updated_at as string,
  };
}