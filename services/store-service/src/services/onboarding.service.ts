import { db } from '../db/client';
import { NotFoundError } from '@pos/shared-utils';
import { publishEvent } from '../events/producer';
import type { OnboardingState, OnboardingStep, PaymentConfiguration, NotificationConfiguration, StaffProfile } from '@pos/shared-types';

export async function getOnboardingState(storeId: string): Promise<OnboardingState> {
  const result = await db.query(
    `SELECT * FROM onboarding_state WHERE store_id = $1`,
    [storeId],
  );
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Onboarding state for store ${storeId} not found`);
  }
  return mapOnboarding(result.rows[0]);
}

export async function completeStep(storeId: string, step: OnboardingStep): Promise<OnboardingState> {
  const STEP_ORDER: OnboardingStep[] = [
    'restaurant_setup',
    'branch_created',
    'tables_configured',
    'staff_added',
    'device_registered',
    'menu_created',
    'inventory_configured',
    'payment_configured',
    'notifications_configured',
    'completed',
  ];

  const nextStepIndex = STEP_ORDER.indexOf(step) + 1;
  const nextStep = STEP_ORDER[nextStepIndex] ?? 'completed';

  await db.query(
    `UPDATE onboarding_state
     SET completed_steps = (
           SELECT jsonb_agg(DISTINCT elem)
           FROM jsonb_array_elements_text(completed_steps || $2::jsonb) AS elem
         ),
         current_step = $3,
         updated_at   = NOW()
     WHERE store_id = $1 AND is_complete = FALSE`,
    [storeId, JSON.stringify([step]), nextStep],
  );

  return getOnboardingState(storeId);
}

export async function completeOnboarding(storeId: string): Promise<OnboardingState> {
  const [branchRes, staffRes, menuRes] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM branches WHERE store_id = $1`, [storeId]),
    db.query(`SELECT COUNT(*) FROM staff_profiles WHERE store_id = $1`, [storeId]),
    db.query(
      `SELECT COUNT(*) FROM menus WHERE store_id = $1`,
      [storeId],
    ).catch(() => ({ rows: [{ count: '0' }] })),
  ]);

  const branchCount = parseInt(branchRes.rows[0].count, 10);
  const staffCount = parseInt(staffRes.rows[0].count, 10);
  const menuItemCount = parseInt(menuRes.rows[0].count, 10);

  await db.query(
    `UPDATE onboarding_state
     SET is_complete     = TRUE,
         completed_at    = NOW(),
         current_step    = 'completed',
         completed_steps = '["restaurant_setup","branch_created","tables_configured","staff_added","device_registered","menu_created","inventory_configured","payment_configured","notifications_configured","completed"]'::jsonb,
         updated_at      = NOW()
     WHERE store_id = $1`,
    [storeId],
  );

  await publishEvent(
    'restaurant_onboarding_completed_v1',
    storeId,
    storeId,
    'store',
    {
      storeId,
      completedAt: new Date().toISOString(),
      branchCount,
      staffCount,
      menuItemCount,
    },
  );

  return getOnboardingState(storeId);
}

// ─── Payment Configuration ────────────────────────────────────────────────────

export async function upsertPaymentConfig(
  storeId: string,
  req: Partial<Pick<PaymentConfiguration, 'cashEnabled' | 'cardEnabled' | 'enabledMethods'>>,
): Promise<PaymentConfiguration> {
  const result = await db.query(
    `INSERT INTO payment_configurations (store_id, cash_enabled, card_enabled, enabled_methods)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (store_id) DO UPDATE
       SET cash_enabled    = COALESCE($2, payment_configurations.cash_enabled),
           card_enabled    = COALESCE($3, payment_configurations.card_enabled),
           enabled_methods = COALESCE($4, payment_configurations.enabled_methods),
           updated_at      = NOW()
     RETURNING *`,
    [
      storeId,
      req.cashEnabled ?? true,
      req.cardEnabled ?? true,
      req.enabledMethods ? JSON.stringify(req.enabledMethods) : JSON.stringify(['cash', 'card']),
    ],
  );

  await publishEvent(
    'payment_configuration.updated.v1' as any,
    storeId,
    storeId,
    'payment_config',
    {
      storeId,
      enabledMethods: req.enabledMethods ?? ['cash', 'card'],
      cashEnabled: req.cashEnabled ?? true,
      cardEnabled: req.cardEnabled ?? true,
    },
  );

  await completeStep(storeId, 'payment_configured');

  return mapPaymentConfig(result.rows[0]);
}

export async function getPaymentConfig(storeId: string): Promise<PaymentConfiguration | null> {
  const result = await db.query(
    `SELECT * FROM payment_configurations WHERE store_id = $1`,
    [storeId],
  );
  return result.rowCount && result.rowCount > 0 ? mapPaymentConfig(result.rows[0]) : null;
}

// ─── Notification Configuration ───────────────────────────────────────────────

export async function upsertNotificationConfig(
  storeId: string,
  req: Partial<Pick<NotificationConfiguration, 'managerPhone' | 'managerEmail' | 'lowStockAlerts' | 'orderAlerts' | 'channels'>>,
): Promise<NotificationConfiguration> {
  const result = await db.query(
    `INSERT INTO notification_configurations (store_id, manager_phone, manager_email, low_stock_alerts, order_alerts, channels)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (store_id) DO UPDATE
       SET manager_phone   = COALESCE($2, notification_configurations.manager_phone),
           manager_email   = COALESCE($3, notification_configurations.manager_email),
           low_stock_alerts= COALESCE($4, notification_configurations.low_stock_alerts),
           order_alerts    = COALESCE($5, notification_configurations.order_alerts),
           channels        = COALESCE($6, notification_configurations.channels),
           updated_at      = NOW()
     RETURNING *`,
    [
      storeId,
      req.managerPhone ?? null,
      req.managerEmail ?? null,
      req.lowStockAlerts ?? true,
      req.orderAlerts ?? true,
      req.channels ? JSON.stringify(req.channels) : JSON.stringify(['whatsapp']),
    ],
  );

  await completeStep(storeId, 'notifications_configured');

  return mapNotificationConfig(result.rows[0]);
}

export async function getNotificationConfig(storeId: string): Promise<NotificationConfiguration | null> {
  const result = await db.query(
    `SELECT * FROM notification_configurations WHERE store_id = $1`,
    [storeId],
  );
  return result.rowCount && result.rowCount > 0 ? mapNotificationConfig(result.rows[0]) : null;
}

// ─── Staff Profile (store-service side) ──────────────────────────────────────

export async function createStaffProfile(
  userId: string,
  storeId: string,
  branchId: string | undefined,
  employeeNumber: string,
  position?: string,
): Promise<StaffProfile> {
  const result = await db.query(
    `INSERT INTO staff_profiles (id, user_id, store_id, branch_id, employee_number, position)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
     ON CONFLICT (store_id, user_id) DO UPDATE
       SET branch_id       = COALESCE($3, staff_profiles.branch_id),
           employee_number = $4,
           position        = COALESCE($5, staff_profiles.position),
           updated_at      = NOW()
     RETURNING *`,
    [userId, storeId, branchId ?? null, employeeNumber, position ?? null],
  );

  // Non-fatal: onboarding_state may not exist for admin-created restaurants
  completeStep(storeId, 'staff_added').catch((err: Error) =>
    console.warn('[store-service] completeStep(staff_added) failed (non-fatal):', err.message),
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    storeId: row.store_id,
    branchId: row.branch_id ?? undefined,
    employeeNumber: row.employee_number,
    position: row.position ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getStaffByStore(storeId: string) {
  const result = await db.query(
    `SELECT * FROM staff_profiles WHERE store_id = $1 ORDER BY created_at ASC`,
    [storeId],
  );
  return result.rows.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    storeId: row.store_id as string,
    branchId: row.branch_id as string | undefined,
    employeeNumber: row.employee_number as string,
    position: row.position as string | undefined,
    createdAt: row.created_at as string,
  }));
}

// ─── Row mappers ─────────────────────────────────────────────────────────────

function mapOnboarding(row: Record<string, unknown>): OnboardingState {
  return {
    storeId: row.store_id as string,
    currentStep: row.current_step as OnboardingStep,
    completedSteps: (row.completed_steps as OnboardingStep[]) ?? [],
    isComplete: row.is_complete as boolean,
    completedAt: row.completed_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapPaymentConfig(row: Record<string, unknown>): PaymentConfiguration {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    cashEnabled: row.cash_enabled as boolean,
    cardEnabled: row.card_enabled as boolean,
    enabledMethods: (row.enabled_methods as string[]) ?? [],
    currency: (row.currency as string) ?? 'AED',
    updatedAt: row.updated_at as string,
  };
}

function mapNotificationConfig(row: Record<string, unknown>): NotificationConfiguration {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    managerPhone: row.manager_phone as string | undefined,
    managerEmail: row.manager_email as string | undefined,
    lowStockAlerts: row.low_stock_alerts as boolean,
    orderAlerts: row.order_alerts as boolean,
    channels: (row.channels as string[]) ?? [],
    updatedAt: row.updated_at as string,
  };
}
