import { Button, PercentIcon, cn } from '@pos/ui';

// Inline icons not yet in @pos/ui icon set
function NoteIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10,9 9,9 8,9"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="6" y="4" width="4" height="16"/>
      <rect x="14" y="4" width="4" height="16"/>
    </svg>
  );
}

function SplitIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="8" height="16" rx="1.5"/>
      <rect x="13" y="4" width="8" height="16" rx="1.5"/>
      <line x1="12" y1="2" x2="12" y2="22" strokeDasharray="2 2"/>
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function CoinIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 6v2m0 8v2M9.5 9.5C9.5 8.1 10.6 7 12 7s2.5 1.1 2.5 2.5c0 2.5-5 2.5-5 5C9.5 15.9 10.6 17 12 17s2.5-1.1 2.5-2.5"/>
    </svg>
  );
}

export interface POSActionBarProps {
  /** Short label shown as the dark badge on the left — e.g. "Eat-In", "Take Away", "Delivery" */
  orderTypeLabel: string;
  /** Descriptive text next to the badge — e.g. "New Order: Store : Table 3" */
  orderDescription?: string;
  onManageCashFlow?: () => void;
  onCloseRegister?: () => void;
  /** Shown instead of the two above when this device has no shift open yet */
  onOpenShift?: () => void;
  /** Show the loyalty button (omit to hide it entirely) */
  loyaltyEnabled?: boolean;
  onLoyalty?: () => void;
  onAddNotes?: () => void;
  onApplyDiscount?: () => void;
  /** Why Apply Discount is disabled right now — shown as a tooltip when onApplyDiscount is omitted */
  applyDiscountDisabledReason?: string;
  /** Omit to hide the customer button entirely (e.g. store has customer capture disabled) */
  onCustomer?: () => void;
  /** Attached customer's name, shown on the button in place of "Customer" */
  customerLabel?: string;
  onSplitBill?: () => void;
  /** Why Split Bill is disabled right now — shown as a tooltip when onSplitBill is omitted */
  splitBillDisabledReason?: string;
  onPlaceOrder: () => void;
  /** Override the "Place Order" button label */
  placeOrderLabel?: string;
  onHold?: () => void;
  canPlaceOrder?: boolean;
  isPlacingOrder?: boolean;
  className?: string;
}

export function POSActionBar({
  orderTypeLabel,
  orderDescription,
  onManageCashFlow,
  onCloseRegister,
  loyaltyEnabled = true,
  onLoyalty,
  onAddNotes,
  onApplyDiscount,
  applyDiscountDisabledReason,
  onOpenShift,
  onCustomer,
  customerLabel,
  onSplitBill,
  splitBillDisabledReason,
  onPlaceOrder,
  placeOrderLabel = 'Place Order',
  onHold,
  canPlaceOrder = true,
  isPlacingOrder = false,
  className,
}: POSActionBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-2 bg-white border-b border-neutral-200 shrink-0',
        className,
      )}
    >
      {/* ── Left: order context + admin actions ─────────────────── */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Order type badge */}
        <span className="shrink-0 bg-brand-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap">
          {orderTypeLabel}
        </span>

        {/* Order description */}
        {orderDescription && (
          <span className="text-xs text-neutral-500 truncate max-w-[200px]" title={orderDescription}>
            {orderDescription}
          </span>
        )}

        {/* Admin buttons */}
        {onOpenShift && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenShift}
            className="whitespace-nowrap shrink-0 border-warning-300 text-warning-700 bg-warning-50 hover:bg-warning-100"
          >
            Open Shift
          </Button>
        )}
        {onManageCashFlow && (
          <Button variant="outline" size="sm" onClick={onManageCashFlow} className="whitespace-nowrap shrink-0">
            Manage Cash Flow
          </Button>
        )}
        {onCloseRegister && (
          <Button variant="outline" size="sm" onClick={onCloseRegister} className="whitespace-nowrap shrink-0">
            Close Register
          </Button>
        )}
      </div>

      {/* ── Center: quick action buttons ────────────────────────── */}
      <div className="flex items-center gap-2 flex-1 justify-center">
        {loyaltyEnabled && (
          <Button
            variant="accent"
            size="sm"
            icon={<CoinIcon />}
            onClick={onLoyalty}
            className="font-bold tracking-wide"
          >
            LOYALTY
          </Button>
        )}

        {onAddNotes && (
          <Button
            variant="outline"
            size="sm"
            icon={<NoteIcon />}
            onClick={onAddNotes}
          >
            Add Notes
          </Button>
        )}

        {onCustomer && (
          <Button
            variant={customerLabel ? 'accent' : 'outline'}
            size="sm"
            icon={<UserIcon />}
            onClick={onCustomer}
            className="max-w-[160px] truncate"
          >
            {customerLabel ?? 'Customer'}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          icon={<PercentIcon size={14} />}
          onClick={onApplyDiscount}
          disabled={!onApplyDiscount}
          title={onApplyDiscount ? undefined : (applyDiscountDisabledReason ?? 'Available once this order has been created')}
        >
          Apply Discount
        </Button>

        <Button
          variant="outline"
          size="sm"
          icon={<SplitIcon />}
          onClick={onSplitBill}
          disabled={!onSplitBill}
          title={onSplitBill ? undefined : (splitBillDisabledReason ?? 'Available once this order has been created')}
        >
          Split Bill
        </Button>
      </div>

      {/* ── Right: place order + hold ────────────────────────────── */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="lg"
          icon={<CheckIcon />}
          onClick={onPlaceOrder}
          disabled={!canPlaceOrder}
          loading={isPlacingOrder}
          className="bg-success-600 hover:bg-success-700 active:bg-success-800 text-white font-bold px-8 shadow-sm hover:shadow-md focus-visible:ring-success-500"
        >
          {placeOrderLabel}
        </Button>

        {onHold && (
          <Button
            variant="secondary"
            size="md"
            onClick={onHold}
            className="flex-col h-auto py-1.5 px-3 gap-0.5"
          >
            <PauseIcon />
            <span className="text-[10px] font-semibold leading-none">Hold</span>
          </Button>
        )}
      </div>
    </div>
  );
}
