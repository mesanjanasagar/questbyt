import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useCartStore, type CartItem } from '../store/cartStore';
import { getFullMenu, getItemById } from '../api/menu';
import { createOrder, sendToKitchen, requestBill, closeOrder, getOrder, updateSentItemQuantity, removeSentItem } from '../api/orders';
import { getMyStaffProfile, getDiningAreasByBranch, getTablesByBranch, getActiveOrdersForStore, updateTableStatus, type DiningArea } from '../api/tables';
import { getActiveOrderForTable } from '../api/orders';
import { getStoreSettings } from '../api/store';
import { getCustomerById } from '../api/customers';
import { getActiveShift } from '../api/shifts';
import OpenShiftModal from '../components/OpenShiftModal';
import CashManagementModal from '../components/CashManagementModal';
import CloseRegisterModal from '../components/CloseRegisterModal';
import { printKOT } from '../utils/printKOT';
import { printReceipt } from '../utils/printReceipt';
import { getPaymentSummary } from '../api/payments';
import CheckoutModal from '../components/CheckoutModal';
import CustomerModal from '../components/CustomerModal';
import CustomerHistoryModal from '../components/CustomerHistoryModal';
import DiscountModal from '../components/DiscountModal';
import LoyaltyModal from '../components/LoyaltyModal';
import SplitBillModal from '../components/SplitBillModal';
import { OrderType } from '@pos/shared-types';
import type { MenuItem, ModifierGroup, Modifier, Table, StaffProfile, Order, OrderItem, OrderItemModification, Customer } from '@pos/shared-types';
import { OrderStatus, OrderItemStatus } from '@pos/shared-types';
import { useState, useMemo, useCallback, useRef, useEffect, type MouseEvent } from 'react';
import { useToast, DietaryMark, UserIcon, UsersIcon, EditIcon, ChevronLeftIcon } from '@pos/ui';
import { POSTopNav, type POSNavSection } from '../components/POSTopNav';
import { POSActionBar } from '../components/POSActionBar';
import { CategoryGrid } from '../components/CategoryGrid';
import { NotificationBell } from '../components/NotificationBell';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeldOrder {
  id: string;
  label: string;
  items: CartItem[];
  orderType: OrderType;
  tableNumber?: number;
  table?: Table;
  guestCount?: number;
  notes?: string;
  heldAt: number;
}

// ─── Item Edit Dialog ─────────────────────────────────────────────────────────

interface ItemOptionsDialogProps {
  menuItem: MenuItem;
  detail: MenuItem | undefined;
  detailLoading: boolean;
  initialQuantity?: number;
  initialVariantId?: string;
  initialModifications?: OrderItemModification[];
  initialNotes?: string;
  confirmLabel: string;
  onConfirm: (qty: number, mods: OrderItemModification[], variantId: string | undefined, variantName: string | undefined, notes: string | undefined, unitPrice: number) => void;
  onRemove?: () => void;
  onClose: () => void;
}

function ItemOptionsDialog({
  menuItem: item, detail, detailLoading,
  initialQuantity = 1, initialVariantId, initialModifications = [], initialNotes = '',
  confirmLabel, onConfirm, onRemove, onClose,
}: ItemOptionsDialogProps) {
  const [qty, setQty] = useState(initialQuantity);
  const [notes, setNotes] = useState(initialNotes);
  const [selectedVariantId, setSelectedVariantId] = useState<string | undefined>(initialVariantId);
  const [selectedMods, setSelectedMods] = useState<Record<string, string[]>>({});

  const modifierGroups: ModifierGroup[] = detail?.modifierGroups ?? [];
  const variants = detail?.variants ?? [];

  // Once detail loads, reconstruct selectedMods from the initial modifications (edit mode)
  // or default any required single-select groups to their first option (add mode).
  useEffect(() => {
    if (!detail) return;
    const init: Record<string, string[]> = {};
    for (const g of detail.modifierGroups ?? []) {
      const ids = g.modifiers
        .filter((m: Modifier) => initialModifications.some((mod) => mod.modifierId === m.id))
        .map((m: Modifier) => m.id);
      if (ids.length > 0) init[g.id] = ids;
    }
    setSelectedMods(init);
    if (!selectedVariantId && detail.variants && detail.variants.length > 0) {
      setSelectedVariantId(detail.variants[0].id);
    }
  }, [detail?.id]);

  const activeVariant = variants.find((v) => v.id === selectedVariantId);
  const basePrice = activeVariant ? activeVariant.price : item.basePrice;
  const modAdj = modifierGroups
    .flatMap((g) => g.modifiers)
    .filter((m: Modifier) => Object.values(selectedMods).flat().includes(m.id))
    .reduce((s: number, m: Modifier) => s + m.priceAdjustment, 0);
  const unitPrice = basePrice + modAdj;

  const missingRequired = modifierGroups.filter((g) => g.isRequired && (selectedMods[g.id]?.length ?? 0) === 0);

  function toggleMod(group: ModifierGroup, modId: string) {
    setSelectedMods((prev) => {
      const cur = prev[group.id] ?? [];
      if (cur.includes(modId)) {
        return { ...prev, [group.id]: cur.filter((id) => id !== modId) };
      }
      if (group.selectionType === 'single' || group.maxSelections === 1) {
        return { ...prev, [group.id]: [modId] };
      }
      if (group.maxSelections && cur.length >= group.maxSelections) {
        return { ...prev, [group.id]: [...cur.slice(1), modId] };
      }
      return { ...prev, [group.id]: [...cur, modId] };
    });
  }

  function handleConfirm() {
    if (missingRequired.length > 0) return;
    const mods = modifierGroups.flatMap((g) =>
      (selectedMods[g.id] ?? []).map((modId) => {
        const m = g.modifiers.find((x: Modifier) => x.id === modId)!;
        return { modifierId: m.id, modifierName: m.name, priceAdjustment: m.priceAdjustment };
      }),
    );
    onConfirm(qty, mods, selectedVariantId, activeVariant?.name, notes.trim() || undefined, unitPrice);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col animate-scale-in overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-neutral-900 leading-tight flex items-center gap-1.5">
              {item.dietaryType && <DietaryMark type={item.dietaryType} size={13} />}
              {item.name}
            </h3>
            {item.description && (
              <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{item.description}</p>
            )}
          </div>
          <button onClick={onClose} className="ml-3 p-1 text-neutral-400 hover:text-neutral-700 text-xl leading-none shrink-0">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Variants */}
          {variants.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Size / Variant</p>
              <div className="grid grid-cols-2 gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border-2 text-sm transition-all ${
                      selectedVariantId === v.id
                        ? 'border-primary-500 bg-primary-50 text-primary-800'
                        : 'border-neutral-200 text-neutral-700 hover:border-neutral-300'
                    }`}
                  >
                    <span className="font-medium">{v.name}</span>
                    <span className="font-bold">AED {v.price.toFixed(2)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Modifier groups */}
          {detailLoading && (
            <div className="text-xs text-neutral-400 text-center py-2">Loading options…</div>
          )}
          {modifierGroups.map((group) => (
            <div key={group.id}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{group.name}</p>
                {group.isRequired ? (
                  <span className="text-xs text-error-600 font-medium">Required</span>
                ) : (
                  <span className="text-xs text-neutral-400">Optional</span>
                )}
              </div>
              <div className="space-y-1.5">
                {group.modifiers.map((mod: Modifier) => {
                  const selected = (selectedMods[group.id] ?? []).includes(mod.id);
                  return (
                    <button
                      key={mod.id}
                      onClick={() => toggleMod(group, mod.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all text-left ${
                        selected ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selected ? 'border-primary-600 bg-primary-600' : 'border-neutral-300'
                      }`}>
                        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="flex-1 text-sm text-neutral-800 font-medium">{mod.name}</span>
                      {mod.priceAdjustment !== 0 && (
                        <span className="text-xs font-semibold text-primary-600">
                          +AED {mod.priceAdjustment.toFixed(2)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Item notes */}
          <div>
            <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Kitchen Instructions (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. No onions, extra sauce…"
              rows={2}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 text-neutral-800 placeholder:text-neutral-400"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-100 flex items-center gap-3">
          {/* Quantity */}
          <div className="flex items-center gap-2 bg-neutral-100 rounded-lg px-2 py-1">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 font-bold text-lg transition-colors"
            >−</button>
            <span className="w-6 text-center text-sm font-bold text-neutral-900">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 font-bold text-lg transition-colors"
            >+</button>
          </div>
          {onRemove && (
            <button
              onClick={() => { onRemove(); onClose(); }}
              className="px-4 py-3 rounded-xl border border-error-300 text-error-600 text-sm font-semibold hover:bg-error-50 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={handleConfirm}
            disabled={missingRequired.length > 0}
            title={missingRequired.length > 0 ? `Choose ${missingRequired.map((g) => g.name).join(', ')}` : undefined}
            className="btn-primary flex-1 py-3 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {missingRequired.length > 0 ? `Choose ${missingRequired[0].name}` : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Table Selector Modal ─────────────────────────────────────────────────────

type TileStatus = 'available' | 'running' | 'ready' | 'paid' | 'reserved' | 'cleaning';

const TILE_STYLE: Record<TileStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  available: { bg: 'bg-neutral-100', border: 'border-neutral-300',  text: 'text-neutral-700',  dot: 'bg-neutral-400',  label: 'Available' },
  running:   { bg: 'bg-blue-50',     border: 'border-blue-400',     text: 'text-blue-800',     dot: 'bg-blue-500',     label: 'Running' },
  ready:     { bg: 'bg-green-100',   border: 'border-green-400',    text: 'text-green-800',    dot: 'bg-green-500',    label: 'KOT Ready' },
  paid:      { bg: 'bg-orange-50',   border: 'border-orange-400',   text: 'text-orange-800',   dot: 'bg-orange-500',   label: 'Paid' },
  reserved:  { bg: 'bg-yellow-50',   border: 'border-yellow-400',   text: 'text-yellow-700',   dot: 'bg-yellow-500',   label: 'Reserved' },
  cleaning:  { bg: 'bg-neutral-50',  border: 'border-neutral-200',  text: 'text-neutral-400',  dot: 'bg-neutral-300',  label: 'Cleaning' },
};

// table.status is the single source of truth for tile color — the backend
// writes it at every transition that matters (order created -> occupied,
// items sent -> food_preparing, all items ready -> ready_to_serve, bill
// requested -> bill_requested, payment closed -> paid). This used to also
// fall back to scanning `orders` for anything matching the table number with
// status 'ready', but that fallback could paint a table green off a stale,
// never-closed order that happened to share its table number — the backend
// state is authoritative now, so trust it directly instead of second-guessing it.
function getTileStatus(table: Table): TileStatus {
  switch (table.status) {
    case 'paid': return 'paid';
    case 'cleaning': return 'cleaning';
    case 'reserved': return 'reserved';
    case 'occupied':
    case 'food_preparing': return 'running';
    case 'ready_to_serve':
    case 'bill_requested': return 'ready';
    default: return 'available';
  }
}

function formatElapsedSince(isoDate: string): string {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function getTableOrders(table: Table, orders: Order[]): Order[] {
  const tableNum = parseInt(table.tableNumber, 10);
  return orders.filter(
    (o) =>
      (o.tableId === table.id || (!isNaN(tableNum) && o.tableNumber === tableNum)) &&
      o.status !== OrderStatus.CANCELLED &&
      o.status !== OrderStatus.CLOSED,
  );
}

interface ActiveOrderConfirmProps {
  table: Table;
  activeOrders: Order[];
  onContinue: (orderId: string) => void;
  onStartNew: () => void;
  onCancel: () => void;
}

function ActiveOrderConfirm({ table, activeOrders, onContinue, onStartNew, onCancel }: ActiveOrderConfirmProps) {
  const topOrder = activeOrders[0];
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="text-center mb-5">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="font-bold text-neutral-900 text-base">Active Order Found</h3>
          <p className="text-sm text-neutral-500 mt-1">
            Table {table.tableNumber} has {activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''}.
          </p>
          {topOrder && (
            <p className="text-xs text-neutral-400 mt-0.5">Running for {formatElapsedSince(topOrder.createdAt)}</p>
          )}
          {topOrder && topOrder.totalAmount > 0 && (
            <p className="text-base font-bold text-blue-700 mt-1.5">AED {topOrder.totalAmount.toFixed(2)}</p>
          )}
        </div>
        <p className="text-sm text-center text-neutral-600 mb-5">Do you want to continue this order?</p>
        <div className="space-y-2">
          {topOrder && (
            <button
              onClick={() => onContinue(topOrder.id)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-colors"
            >
              Yes — Continue Existing Order
            </button>
          )}
          <button
            onClick={onStartNew}
            className="w-full py-3 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-700 rounded-xl font-semibold text-sm transition-colors"
          >
            No — Start New Order
          </button>
          <button
            onClick={onCancel}
            className="w-full py-2 text-neutral-400 hover:text-neutral-600 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

interface TableSelectorModalProps {
  storeId: string;
  initialTable: Table | null;
  onSelect: (table: Table, existingOrderId?: string) => void;
  onClose: () => void;
  inline?: boolean;
}

function TableSelectorModal({ storeId, onSelect, onClose, inline = false }: TableSelectorModalProps) {
  const [pendingTable, setPendingTable] = useState<Table | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{ table: Table; orders: Order[] } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [markingCleanId, setMarkingCleanId] = useState<string | null>(null);

  // Re-render periodically so "running for Xm" labels stay fresh between refetches
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: staffProfile, isLoading: staffLoading, error: staffError } = useQuery<StaffProfile>({
    queryKey: ['staff-me'],
    queryFn: getMyStaffProfile,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const branchId = staffProfile?.branchId;

  const { data: diningAreas = [], isLoading: areasLoading } = useQuery<DiningArea[]>({
    queryKey: ['dining-areas', branchId],
    queryFn: () => getDiningAreasByBranch(branchId!),
    enabled: !!branchId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: tables = [], isLoading: tablesLoading, refetch: refetchTables } = useQuery<Table[]>({
    queryKey: ['tables', branchId],
    queryFn: () => getTablesByBranch(branchId!),
    enabled: !!branchId,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const { data: activeOrders = [], refetch: refetchOrders } = useQuery<Order[]>({
    queryKey: ['active-orders', storeId, branchId],
    queryFn: () => getActiveOrdersForStore(storeId, branchId),
    enabled: !!storeId && !!branchId,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 15,
  });

  const isLoading = staffLoading || areasLoading || tablesLoading;

  const tablesByArea = useMemo(() => {
    const map = new Map<string, Table[]>();
    for (const table of tables) {
      const areaId = table.diningAreaId ?? '__unassigned__';
      if (!map.has(areaId)) map.set(areaId, []);
      map.get(areaId)!.push(table);
    }
    return map;
  }, [tables]);

  const orderedAreas = useMemo(() => {
    const result: Array<{ id: string; name: string; tables: Table[] }> = [];
    for (const area of diningAreas) {
      const areaTables = tablesByArea.get(area.id) ?? [];
      if (areaTables.length > 0) result.push({ id: area.id, name: area.name, tables: areaTables });
    }
    const unassigned = tablesByArea.get('__unassigned__') ?? [];
    if (unassigned.length > 0) result.push({ id: '__unassigned__', name: 'Other', tables: unassigned });
    return result;
  }, [diningAreas, tablesByArea]);

  function handleTileClick(table: Table) {
    setPendingTable(table);
  }

  async function handleMarkAvailable(table: Table, e: MouseEvent) {
    e.stopPropagation();
    if (markingCleanId) return;
    setMarkingCleanId(table.id);
    try {
      await updateTableStatus(table.id, 'available');
      await Promise.all([refetchTables(), refetchOrders()]);
    } catch {
      alert('Failed to mark table available. Please try again.');
    } finally {
      setMarkingCleanId(null);
    }
  }

  async function handleMarkClean(table: Table, e: MouseEvent) {
    e.stopPropagation();
    if (markingCleanId) return;
    setMarkingCleanId(table.id);
    try {
      await updateTableStatus(table.id, 'cleaning');
      await Promise.all([refetchTables(), refetchOrders()]);
    } catch {
      alert('Failed to mark table for cleaning. Please try again.');
    } finally {
      setMarkingCleanId(null);
    }
  }

  async function handleConfirm() {
    if (!pendingTable || confirmLoading) return;
    const tileStatus = getTileStatus(pendingTable);
    if (tileStatus === 'running' || tileStatus === 'ready') {
      setConfirmLoading(true);
      try {
        // Query the server directly — more reliable than scanning the bulk list
        const activeOrder = await getActiveOrderForTable(pendingTable.id, storeId);
        if (activeOrder) {
          setPendingConfirm({ table: pendingTable, orders: [activeOrder] });
          return;
        }
        // Fallback: scan the already-fetched list
        const orders = getTableOrders(pendingTable, activeOrders);
        if (orders.length > 0) {
          setPendingConfirm({ table: pendingTable, orders });
          return;
        }
      } catch {
        // Network error — fall through to start a new order
      } finally {
        setConfirmLoading(false);
      }
    }
    onSelect(pendingTable, undefined);
  }

  function handleRefresh() {
    void refetchTables();
    void refetchOrders();
  }

  return (
    <>
      <div className={inline ? 'flex flex-col h-full' : 'fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4'}>
        <div className={inline ? 'flex flex-col h-full overflow-hidden bg-white w-full' : 'bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl'}>
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 shrink-0">
            <h2 className="font-bold text-base text-neutral-900">Select Table</h2>
            {!inline && <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none transition-colors">✕</button>}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100 shrink-0 overflow-x-auto">
            {(Object.entries(TILE_STYLE) as Array<[TileStatus, (typeof TILE_STYLE)[TileStatus]]>).map(([key, s]) => (
              <div key={key} className="flex items-center gap-1.5 shrink-0">
                <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
                <span className="text-xs text-neutral-600 whitespace-nowrap">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {staffError && (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <p className="text-error-600 font-medium text-sm">No staff profile found.</p>
                  <p className="text-xs text-neutral-500 mt-1">Ask a manager to assign you to a branch.</p>
                </div>
              </div>
            )}
            {!staffError && !branchId && !staffLoading && (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <p className="text-neutral-600 font-medium text-sm">Not assigned to a branch.</p>
                  <p className="text-xs text-neutral-500 mt-1">Ask a manager to assign your branch.</p>
                </div>
              </div>
            )}
            {isLoading && (
              <div className="flex items-center justify-center h-40">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {!isLoading && branchId && tables.length === 0 && (
              <div className="flex items-center justify-center h-40">
                <div className="text-center">
                  <p className="text-neutral-600 font-medium text-sm">No tables found.</p>
                  <p className="text-xs text-neutral-500 mt-1">Add tables in the Manager Dashboard.</p>
                </div>
              </div>
            )}
            {!isLoading && orderedAreas.length > 0 && (
              <div className="p-5 space-y-6">
                {orderedAreas.map((area) => (
                  <div key={area.id}>
                    <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">
                      {area.name}
                    </h3>
                    <div className="grid grid-cols-5 gap-2">
                      {area.tables.map((table) => {
                        const tileStatus = getTileStatus(table);
                        const st = TILE_STYLE[tileStatus];
                        const tableOrders = getTableOrders(table, activeOrders);
                        const topOrder = tableOrders[0];
                        const isPending = pendingTable?.id === table.id;
                        const isCleaning = tileStatus === 'cleaning';
                        const isPaid = tileStatus === 'paid';
                        const isMarking = markingCleanId === table.id;
                        const showCount = (tileStatus === 'running' || tileStatus === 'ready') && tableOrders.length > 0;
                        const showElapsed = (tileStatus === 'running' || tileStatus === 'ready') && !!topOrder;

                        // Paid and cleaning tiles can't be tapped to start an order — they
                        // walk through explicit "Mark Clean" then "Mark Available" actions
                        // instead, so they're a div, not a button (a nested button inside a
                        // disabled <button> wouldn't be clickable).
                        if (isCleaning || isPaid) {
                          return (
                            <div
                              key={table.id}
                              className={`relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-xl border-2 text-center min-h-[80px] ${st.bg} ${st.border}`}
                            >
                              <span className={`font-bold text-base leading-none ${st.text}`}>{table.tableNumber}</span>
                              <span className={`text-[11px] ${st.text} opacity-80`}>{table.capacity}p</span>
                              <button
                                onClick={(e) => (isPaid ? handleMarkClean(table, e) : handleMarkAvailable(table, e))}
                                disabled={isMarking}
                                className="mt-0.5 text-[10px] font-semibold px-2 py-1 rounded-md bg-white border border-neutral-300 text-neutral-600 hover:border-primary-400 hover:text-primary-700 disabled:opacity-50 transition-colors"
                              >
                                {isMarking ? 'Marking…' : isPaid ? 'Mark Clean' : 'Mark Available'}
                              </button>
                            </div>
                          );
                        }

                        return (
                          <button
                            key={table.id}
                            onClick={() => handleTileClick(table)}
                            className={`relative flex flex-col items-center justify-center px-2 py-3 rounded-xl border-2 text-center transition-all min-h-[80px] ${
                              isPending
                                ? 'border-primary-500 bg-primary-50 shadow-sm'
                                : `${st.bg} ${st.border} hover:brightness-95 active:scale-95 cursor-pointer`
                            }`}
                          >
                            {isPending && (
                              <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary-600 rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                            <span className={`font-bold text-base leading-none ${isPending ? 'text-primary-700' : st.text}`}>
                              {table.tableNumber}
                            </span>
                            <span className={`text-[11px] mt-1 ${isPending ? 'text-primary-500' : st.text} opacity-80`}>
                              {table.capacity}p
                            </span>
                            {showCount && (
                              <span className={`text-xs font-bold mt-0.5 ${isPending ? 'text-primary-600' : st.text}`}>
                                {tableOrders.length}
                              </span>
                            )}
                            {showElapsed && (
                              <span className={`flex items-center gap-0.5 text-[10px] font-medium mt-0.5 ${isPending ? 'text-primary-500' : st.text} opacity-80`}>
                                <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2M12 21a9 9 0 100-18 9 9 0 000 18z" />
                                </svg>
                                {formatElapsedSince(topOrder.createdAt)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100 shrink-0">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800 font-medium border border-neutral-200 rounded-lg px-3 py-2 hover:bg-neutral-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
            <div className="flex items-center gap-2">
              {!inline && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900 font-medium border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={() => void handleConfirm()}
                disabled={!pendingTable || confirmLoading}
                className="px-5 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-200 disabled:text-neutral-400 text-white font-semibold rounded-lg transition-colors"
              >
                {confirmLoading ? 'Checking…' : 'Select Table'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {pendingConfirm && (
        <ActiveOrderConfirm
          table={pendingConfirm.table}
          activeOrders={pendingConfirm.orders}
          onContinue={(orderId) => {
            setPendingConfirm(null);
            onSelect(pendingConfirm.table, orderId);
          }}
          onStartNew={() => {
            setPendingConfirm(null);
            onSelect(pendingConfirm.table, undefined);
          }}
          onCancel={() => setPendingConfirm(null)}
        />
      )}
    </>
  );
}

// ─── Main POS Page ────────────────────────────────────────────────────────────

export default function POSPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const storeId = user?.storeId ?? '';

  const { data: staffProfile } = useQuery<StaffProfile>({
    queryKey: ['staff-me'],
    queryFn: getMyStaffProfile,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });
  const branchId = staffProfile?.branchId;

  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings', storeId],
    queryFn: () => getStoreSettings(storeId),
    enabled: !!storeId,
    staleTime: 1000 * 60 * 10,
  });
  const captureCustomerDetails = storeSettings?.posCaptureCustomerDetails ?? false;

  const { data: activeShift, refetch: refetchActiveShift } = useQuery({
    queryKey: ['active-shift'],
    queryFn: getActiveShift,
    enabled: !!storeId,
    staleTime: 1000 * 15,
    refetchInterval: 1000 * 30,
  });
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCashManagementModal, setShowCashManagementModal] = useState(false);
  const [showCloseRegisterModal, setShowCloseRegisterModal] = useState(false);

  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showLoyaltyModal, setShowLoyaltyModal] = useState(false);
  const [showSplitBillModal, setShowSplitBillModal] = useState(false);

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', storeId],
    queryFn: () => getFullMenu(storeId),
    enabled: !!storeId,
    // The global default (5min staleTime, no refetch-on-focus) is right for
    // most POS queries but too slow here — a manager marking an item Sold
    // Out mid-shift needs that to reach the terminal fast, not sit stale for
    // up to 5 minutes while staff keep trying to add it to a cart.
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  // ─ UI state ─────────────────────────────────────────────────────────────
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [addingItem, setAddingItem] = useState<MenuItem | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [checkoutTotal, setCheckoutTotal] = useState(0);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<number | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  // Table labels aren't always plain integers (e.g. "T2", "A1"), but
  // cart.tableNumber is coerced to a number for the orders API and silently
  // becomes undefined for anything parseInt can't read — which blanked the
  // table display entirely for non-numeric labels. selectedTable carries the
  // real string label straight from store-service, so prefer that for display.
  const tableLabel = selectedTable?.tableNumber ?? (cart.tableNumber != null ? String(cart.tableNumber) : undefined);
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [expandNotes, setExpandNotes] = useState(false);
  const guestInputRef = useRef<HTMLInputElement>(null);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [showServiceTypeModal, setShowServiceTypeModal] = useState(false);

  // Local optimistic flag, OR'd with the order's real backend status below —
  // needed because reopening a table via handleTableSelect doesn't know yet
  // whether the order it's attaching to was already bill_requested/paid.
  const [billRequestedLocal, setBillRequestedLocal] = useState(false);

  // ─ Nav section ─────────────────────────────────────────────────────────
  const POS_NAV_SECTIONS: POSNavSection[] = [
    { id: 'walk-in', label: 'Walk-In' },
    { id: 'dine-in', label: 'Dine-In' },
    { id: 'delivery', label: 'Delivery' },
    { id: 'orders', label: 'Orders' },
  ];
  const sectionToOrderType: Record<string, OrderType> = {
    'walk-in': OrderType.TAKEOUT,
    'dine-in': OrderType.DINE_IN,
    'delivery': OrderType.DELIVERY,
  };
  const orderTypeToSection: Record<OrderType, string> = {
    [OrderType.TAKEOUT]: 'walk-in',
    [OrderType.DINE_IN]: 'dine-in',
    [OrderType.DELIVERY]: 'delivery',
  };
  const ORDER_TYPE_LABEL: Record<OrderType, string> = {
    [OrderType.TAKEOUT]: 'Walk-In',
    [OrderType.DINE_IN]: 'Dine-In',
    [OrderType.DELIVERY]: 'Delivery',
  };

  // ─ Lazy-fetch item details (modifiers + variants) when the options dialog opens,
  // whether that's editing an existing cart line or adding a fresh one ─
  const dialogItemId = editingCartItem?.menuItem.id ?? addingItem?.id;
  const { data: itemDetail, isLoading: itemDetailLoading } = useQuery({
    queryKey: ['item', dialogItemId],
    queryFn: () => getItemById(dialogItemId!),
    enabled: !!dialogItemId,
    staleTime: 1000 * 60 * 10,
  });

  const cart = useCartStore();

  // Items already sent to the kitchen for the order the cashier just reopened.
  // Mostly read-only — except items still 'pending' (kitchen hasn't started
  // them), which stay editable in case the customer changes their mind.
  const { data: existingOrderDetail } = useQuery({
    queryKey: ['order-detail', cart.existingOrderId],
    queryFn: () => getOrder(cart.existingOrderId!),
    enabled: !!cart.existingOrderId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });
  const existingOrderItems = existingOrderDetail?.items ?? [];

  // A menu item can go Sold Out after it was already sent to the kitchen for
  // this table — that ticket doesn't retroactively change (the kitchen may
  // already be on it), but a waiter needs to know so they can pull it before
  // it's accepted and tell the customer, rather than finding out when the
  // kitchen can't make it.
  const soldOutMenuItemIds = useMemo(() => {
    const set = new Set<string>();
    for (const it of menu?.items ?? []) {
      if (it.status === 'sold_out') set.add(it.id);
    }
    return set;
  }, [menu]);

  const { warning: warnToast } = useToast();
  const soldOutWarnedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of existingOrderItems) {
      if (
        item.status === OrderItemStatus.PENDING &&
        soldOutMenuItemIds.has(item.menuItemId) &&
        !soldOutWarnedRef.current.has(item.id)
      ) {
        soldOutWarnedRef.current.add(item.id);
        warnToast(
          `${item.itemName ?? 'Item'} is now Sold Out`,
          'Already sent to the kitchen for this order — remove it or check with the kitchen before it gets started.',
        );
      }
    }
  }, [existingOrderItems, soldOutMenuItemIds, warnToast]);

  const billRequested =
    billRequestedLocal ||
    existingOrderDetail?.status === OrderStatus.BILL_REQUESTED ||
    existingOrderDetail?.status === OrderStatus.PAID;
  const showingTableSelector = cart.orderType === OrderType.DINE_IN && !cart.tableId;

  const [updatingSentItemId, setUpdatingSentItemId] = useState<string | null>(null);

  async function refreshSentItems() {
    await queryClient.invalidateQueries({ queryKey: ['order-detail', cart.existingOrderId] });
    void queryClient.invalidateQueries({ queryKey: ['active-orders', storeId] });
  }

  async function handleSentItemQuantityChange(itemId: string, quantity: number) {
    if (!cart.existingOrderId || updatingSentItemId) return;
    setUpdatingSentItemId(itemId);
    try {
      if (quantity <= 0) {
        await removeSentItem(cart.existingOrderId, itemId);
      } else {
        await updateSentItemQuantity(cart.existingOrderId, itemId, quantity);
      }
      await refreshSentItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update item';
      alert(msg);
    } finally {
      setUpdatingSentItemId(null);
    }
  }

  async function handleRemoveSentItem(itemId: string) {
    if (!cart.existingOrderId || updatingSentItemId) return;
    setUpdatingSentItemId(itemId);
    try {
      await removeSentItem(cart.existingOrderId, itemId);
      await refreshSentItems();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to remove item';
      alert(msg);
    } finally {
      setUpdatingSentItemId(null);
    }
  }

  // Restore the guest count that was saved with the order when a table is
  // reopened — but only once per order, so it doesn't stomp on edits the
  // cashier makes while existingOrderDetail keeps refetching in the background.
  const guestCountSyncedForOrderRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cart.existingOrderId) {
      guestCountSyncedForOrderRef.current = null;
      return;
    }
    if (existingOrderDetail && guestCountSyncedForOrderRef.current !== existingOrderDetail.id) {
      cart.setGuestCount(existingOrderDetail.guestCount);
      guestCountSyncedForOrderRef.current = existingOrderDetail.id;
    }
  }, [existingOrderDetail, cart.existingOrderId]);

  // Same problem, same fix, for the customer attached to the order — Order
  // only carries customerId (the cart needs name/phone to display), and
  // customerId lives in a separate service, so it has to be fetched
  // explicitly rather than just copied off existingOrderDetail.
  const customerSyncedForOrderRef = useRef<string | null>(null);
  useEffect(() => {
    if (!cart.existingOrderId) {
      customerSyncedForOrderRef.current = null;
      return;
    }
    if (existingOrderDetail && customerSyncedForOrderRef.current !== existingOrderDetail.id) {
      customerSyncedForOrderRef.current = existingOrderDetail.id;
      if (existingOrderDetail.customerId) {
        getCustomerById(existingOrderDetail.customerId)
          .then((c) => cart.setCustomer({ id: c.id, name: c.name, phone: c.phone }))
          .catch(() => { /* customer may have been deleted since — leave the order's cart state as-is */ });
      } else {
        cart.setCustomer(undefined);
      }
    }
  }, [existingOrderDetail, cart.existingOrderId]);

  const categories = menu?.categories ?? [];
  const activeCategory = selectedCategory;

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (menu?.items ?? []).filter((i) => {
      if (i.status === 'inactive' || i.status === 'hidden') return false;
      if (q) {
        return (
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.sku?.toLowerCase().includes(q)
        );
      }
      return i.categoryId === activeCategory;
    });
  }, [menu?.items, activeCategory, searchQuery]);

  // ─ Actions ──────────────────────────────────────────────────────────────

  const handleAddItem = useCallback((
    item: MenuItem,
    qty: number,
    mods: OrderItemModification[],
    variantId?: string,
    variantName?: string,
    notes?: string,
    unitPrice?: number,
  ) => {
    const modAdj = mods.reduce((s, m) => s + m.priceAdjustment, 0);
    cart.addItem({
      menuItem: item,
      variantId,
      variantName,
      quantity: qty,
      unitPrice: unitPrice ?? item.basePrice + modAdj,
      modifications: mods,
      notes,
    });
  }, [cart]);

  // Items with variants or modifier groups need the options dialog — quick-add
  // would otherwise silently skip a required choice (e.g. size, bean type).
  const handleItemTap = useCallback((item: MenuItem) => {
    if (item.status === 'sold_out') return;
    if (item.hasVariants || item.hasModifierGroups) {
      setAddingItem(item);
    } else {
      handleAddItem(item, 1, []);
    }
  }, [handleAddItem]);

  const handleSaveCartItem = useCallback((
    id: string,
    qty: number,
    mods: OrderItemModification[],
    variantId?: string,
    variantName?: string,
    notes?: string,
    unitPrice?: number,
  ) => {
    cart.updateItem(id, {
      quantity: qty,
      modifications: mods,
      variantId,
      variantName,
      notes: notes || undefined,
      unitPrice: unitPrice ?? cart.items.find((i) => i.id === id)?.unitPrice ?? 0,
    });
  }, [cart]);

  const clearAll = useCallback(() => {
    cart.clearCart();
    setSelectedTable(null);
    setBillRequestedLocal(false);
    // Land back on the top-level category grid, not wherever the cashier
    // last drilled into while building the order that just got paid for —
    // otherwise the next walk-in customer's order starts mid-category.
    setSelectedCategory(null);
    setSearchQuery('');
  }, [cart]);

  const handleTableSelect = useCallback((table: Table, existingOrderId?: string) => {
    const tableNum = parseInt(table.tableNumber, 10);
    cart.setTableNumber(isNaN(tableNum) ? undefined : tableNum);
    cart.setTableId(table.id);
    cart.setExistingOrderId(existingOrderId);
    // Clear any customer left over from whatever table was open before —
    // the sync effect below will repopulate it from the order's real
    // customerId once existingOrderDetail loads, if this order has one.
    cart.setCustomer(undefined);
    setBillRequestedLocal(false);
    setSelectedTable(table);
    setShowTableSelector(false);
  }, [cart]);

  const handleHoldOrder = useCallback(() => {
    if (cart.items.length === 0) return;
    const label = cart.tableNumber
      ? `Table ${cart.tableNumber}`
      : `#${(heldOrders.length + 1)}`;
    setHeldOrders((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        label,
        items: [...cart.items],
        orderType: cart.orderType,
        tableNumber: cart.tableNumber,
        table: selectedTable ?? undefined,
        guestCount: cart.guestCount,
        notes: cart.notes,
        heldAt: Date.now(),
      },
    ]);
    clearAll();
  }, [cart, heldOrders.length, selectedTable, clearAll]);

  const handleResumeOrder = useCallback((held: HeldOrder) => {
    if (cart.items.length > 0) {
      if (!confirm('This will clear your current order. Resume held order?')) return;
    }
    clearAll();
    held.items.forEach((i) =>
      cart.addItem({
        menuItem: i.menuItem,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        modifications: i.modifications,
        notes: i.notes,
      }),
    );
    if (held.tableNumber !== undefined) cart.setTableNumber(held.tableNumber);
    if (held.table) { cart.setTableId(held.table.id); setSelectedTable(held.table); }
    if (held.guestCount !== undefined) cart.setGuestCount(held.guestCount);
    if (held.notes) cart.setNotes(held.notes);
    cart.setOrderType(held.orderType);
    setHeldOrders((prev) => prev.filter((o) => o.id !== held.id));
  }, [cart, clearAll]);

  async function handleSendToKitchen() {
    if (cart.items.length === 0) return;
    setPlacingOrder(true);
    setLastOrderId(null);
    try {
      const kitchenItems = cart.items.map((i) => ({
        menuItemId: i.menuItem.id,
        variantId: i.variantId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        modifications: i.modifications,
        notes: i.notes,
        itemName: i.menuItem.name,
      }));

      const isReorder = !!cart.existingOrderId;
      let orderNumberForTicket = existingOrderDetail?.orderNumber;

      if (cart.existingOrderId) {
        // Subsequent send — add new items to existing order
        await sendToKitchen(cart.existingOrderId, kitchenItems);
      } else {
        // First send — create the order (auto-dispatches to KDS)
        const order = await createOrder({
          storeId,
          deviceId: useAuthStore.getState().deviceId!,
          cashierId: user!.id,
          orderType: cart.orderType as OrderType,
          tableNumber: cart.tableNumber,
          tableId: cart.tableId,
          branchId,
          customerId: cart.customerId,
          guestCount: cart.guestCount,
          notes: cart.notes,
          items: kitchenItems,
        });
        cart.setExistingOrderId(order.id);
        orderNumberForTicket = order.orderNumber;
      }

      printKOT({
        storeName: storeSettings?.name ?? 'Restaurant',
        orderNumber: orderNumberForTicket,
        orderType: ORDER_TYPE_LABEL[cart.orderType],
        tableNumber: tableLabel,
        guestCount: cart.guestCount,
        cashierName: user?.username ?? 'Cashier',
        items: kitchenItems.map((i) => ({
          name: i.itemName ?? 'Item',
          quantity: i.quantity,
          notes: i.notes,
        })),
        notes: cart.notes,
        isReorder,
      });

      // Dine-in: hand the table back to the floor grid, marked in-progress,
      // so the cashier can move on and re-open it later to view/edit/send more.
      if (cart.orderType === OrderType.DINE_IN) {
        void queryClient.invalidateQueries({ queryKey: ['active-orders', storeId] });
        clearAll();
      } else {
        cart.clearItems();
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to send to kitchen';
      alert(msg);
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleRequestBill() {
    if (!cart.existingOrderId) return;
    setPlacingOrder(true);
    try {
      await requestBill(cart.existingOrderId);
      setBillRequestedLocal(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to request bill';
      alert(msg);
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handleCharge() {
    if (!cart.existingOrderId) return;
    // Cart items are only the not-yet-sent items (and are empty by the time
    // Charge is reachable), so fetch the order's real, backend-computed total
    // rather than trusting cart.totalAmount(), which would show AED 0.00 here.
    setPlacingOrder(true);
    try {
      const order = await getOrder(cart.existingOrderId);
      // order.totalAmount already reflects any discount applied via the
      // Apply Discount modal — recalculateOrderTotal bakes it in server-side.
      setCheckoutTotal(order.totalAmount);
      setCheckoutOrderId(order.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to load order total';
      alert(msg);
    } finally {
      setPlacingOrder(false);
    }
  }

  async function handlePlaceOrder() {
    if (cart.items.length === 0) return;
    setPlacingOrder(true);
    setLastOrderId(null);
    try {
      const order = await createOrder({
        storeId,
        deviceId: useAuthStore.getState().deviceId!,
        cashierId: user!.id,
        orderType: cart.orderType as OrderType,
        tableNumber: cart.tableNumber,
        branchId,
        customerId: cart.customerId,
        notes: cart.notes,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItem.id,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          modifications: i.modifications,
          notes: i.notes,
          itemName: i.menuItem.name,
        })),
      });
      setCheckoutTotal(order.totalAmount);
      setCheckoutOrderId(order.id);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to place order';
      alert(msg);
    } finally {
      setPlacingOrder(false);
    }
  }

  // Prints the customer-facing receipt once a payment actually clears — a
  // separate moment from the KOT, which prints on send-to-kitchen and never
  // shows a payment method or total. Pulled from live order + payment data
  // rather than local cart state, since split-bill orders carry several
  // payments that only the backend has a record of.
  async function printReceiptForOrder(orderId: string, orderTypeLabel: string, tableNumber?: string | number) {
    try {
      const [order, summary] = await Promise.all([getOrder(orderId), getPaymentSummary(orderId)]);
      printReceipt({
        storeName: storeSettings?.name ?? 'Restaurant',
        orderNumber: order.orderNumber,
        orderType: orderTypeLabel,
        tableNumber,
        cashierName: user?.username ?? 'Cashier',
        items: (order.items ?? []).map((i) => ({
          name: i.itemName ?? 'Item',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
        subtotal: order.totalAmount - order.taxAmount + order.discountAmount,
        taxAmount: order.taxAmount,
        discountAmount: order.discountAmount,
        totalAmount: order.totalAmount,
        payments: summary.payments.map((p) => ({
          method: p.paymentMethod,
          amount: p.amount,
          cashTendered: p.cashTendered,
          changeDue: p.changeDue,
        })),
      });
    } catch {
      // Receipt is a nice-to-have on top of a payment that already
      // succeeded — never block checkout on it failing to load/print.
    }
  }

  async function handlePaymentSuccess(changeDue?: number) {
    const paidOrderId = checkoutOrderId;
    const orderTypeLabel = ORDER_TYPE_LABEL[cart.orderType];
    const tableNumberForReceipt = tableLabel;
    // Dine-in pays at the END of service (after the kitchen's already done),
    // so closing right away is correct there. Takeout/delivery pay UPFRONT —
    // closing immediately would skip the kitchen entirely, since the backend
    // only dispatches their items to KDS once payment lands. Those close
    // themselves once every item is collected (see updateOrderItemStatus).
    const shouldCloseNow = cart.orderType === OrderType.DINE_IN;
    setLastOrderId(paidOrderId);
    setLastChange(changeDue ?? null);
    setCheckoutOrderId(null);
    if (paidOrderId) void printReceiptForOrder(paidOrderId, orderTypeLabel, tableNumberForReceipt);
    if (paidOrderId && shouldCloseNow) {
      try { await closeOrder(paidOrderId); } catch { /* ignore — order already paid */ }
    }
    clearAll();
    // closeOrder just flipped the table to 'cleaning' server-side — without this,
    // the table grid we're about to land back on can show up to 30s of cached
    // status (still "KOT Ready") since payment doesn't otherwise touch these queries.
    void queryClient.invalidateQueries({ queryKey: ['tables'] });
    void queryClient.invalidateQueries({ queryKey: ['active-orders', storeId] });
  }

  async function handleSplitBillSuccess() {
    const paidOrderId = cart.existingOrderId;
    const orderTypeLabel = ORDER_TYPE_LABEL[cart.orderType];
    const tableNumberForReceipt = tableLabel;
    setShowSplitBillModal(false);
    if (paidOrderId) void printReceiptForOrder(paidOrderId, orderTypeLabel, tableNumberForReceipt);
    const shouldCloseNow = cart.orderType === OrderType.DINE_IN;
    if (paidOrderId && shouldCloseNow) {
      try { await closeOrder(paidOrderId); } catch { /* ignore — order already paid */ }
    }
    clearAll();
    void queryClient.invalidateQueries({ queryKey: ['tables'] });
    void queryClient.invalidateQueries({ queryKey: ['active-orders', storeId] });
  }

  // ─ Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-900">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  // ─ Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-neutral-100 overflow-hidden">
      <POSTopNav
        storeName="Questbyt POS"
        username={user?.username ?? ''}
        sections={POS_NAV_SECTIONS}
        activeSection={orderTypeToSection[cart.orderType] ?? 'walk-in'}
        onSectionChange={(id) => {
          if (id === 'orders') { navigate('/orders'); return; }
          if (id === 'walk-in') { setShowServiceTypeModal(true); return; }
          const type = sectionToOrderType[id];
          if (type !== undefined) {
            cart.setOrderType(type);
          }
        }}
        onMenuToggle={logout}
        rightSlot={<NotificationBell />}
      />
      <POSActionBar
        orderTypeLabel={ORDER_TYPE_LABEL[cart.orderType]}
        orderDescription={
          cart.tableId && tableLabel
            ? `Table ${tableLabel}${selectedTable ? ` · ${selectedTable.capacity} seats` : ''}`
            : undefined
        }
        onAddNotes={cart.existingOrderId ? undefined : () => setExpandNotes((v) => !v)}
        onCustomer={captureCustomerDetails ? () => setShowCustomerModal(true) : undefined}
        customerLabel={cart.customerName}
        loyaltyEnabled={captureCustomerDetails}
        onLoyalty={() => setShowLoyaltyModal(true)}
        onApplyDiscount={
          cart.existingOrderId && cart.items.length === 0 ? () => setShowDiscountModal(true) : undefined
        }
        applyDiscountDisabledReason={
          !cart.existingOrderId
            ? 'Available once this order has been created'
            : 'Send pending items to kitchen first — a promo code checks the order total already on file, which won\'t include items still waiting to be sent'
        }
        onSplitBill={
          cart.existingOrderId && cart.items.length === 0 ? () => setShowSplitBillModal(true) : undefined
        }
        splitBillDisabledReason={
          !cart.existingOrderId
            ? 'Available once this order has been created'
            : 'Send pending items to kitchen first — splitting divides the order total already on file, which won\'t include items still waiting to be sent'
        }
        onOpenShift={!activeShift ? () => setShowOpenShiftModal(true) : undefined}
        onManageCashFlow={activeShift ? () => setShowCashManagementModal(true) : undefined}
        onCloseRegister={activeShift ? () => setShowCloseRegisterModal(true) : undefined}
        onPlaceOrder={
          cart.orderType === OrderType.DINE_IN
            ? cart.items.length > 0
              ? handleSendToKitchen
              : billRequested
              ? handleCharge
              : handleRequestBill
            : handlePlaceOrder
        }
        placeOrderLabel={
          cart.orderType === OrderType.DINE_IN
            ? cart.items.length > 0
              ? cart.existingOrderId
                ? 'Send More to Kitchen'
                : 'Send to Kitchen'
              : billRequested
              ? `Charge · AED ${(existingOrderDetail?.totalAmount ?? 0).toFixed(2)}`
              : 'Request Bill'
            : `Charge · AED ${cart.totalAmount().toFixed(2)}`
        }
        onHold={cart.items.length > 0 ? handleHoldOrder : undefined}
        canPlaceOrder={
          cart.orderType === OrderType.DINE_IN
            ? cart.items.length > 0 || !!cart.existingOrderId
            : cart.items.length > 0
        }
        isPlacingOrder={placingOrder}
      />
      <div className="flex flex-1 overflow-hidden">

      {/* ══ LEFT: Menu Panel ══════════════════════════════════════════════ */}
      <div className={`flex flex-col bg-white ${showingTableSelector ? 'w-full' : 'w-2/3 border-r border-neutral-200'}`}>

        {cart.orderType === OrderType.DINE_IN && !cart.tableId ? (
          <TableSelectorModal
            storeId={storeId}
            initialTable={null}
            onSelect={handleTableSelect}
            onClose={() => {}}
            inline
          />
        ) : (<>

        {/* Search */}
        <div className="px-3 py-2 border-b border-neutral-100 shrink-0">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search items, SKU…"
              className="w-full bg-neutral-50 border border-neutral-200 rounded-lg pl-8 pr-8 py-2 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-base leading-none"
              >✕</button>
            )}
          </div>
        </div>

        {/* Breadcrumb — only shown one level deep in a category, not while searching */}
        {!searchQuery && selectedCategory && (
          <div className="relative px-3 py-2.5 border-b border-neutral-100 shrink-0 bg-neutral-50">
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() => { setSelectedCategory(null); setCategoryDropdownOpen(false); }}
                className="flex items-center gap-1 text-neutral-500 hover:text-neutral-800 font-medium transition-colors shrink-0"
              >
                <span aria-hidden>⌂</span> Menu Categories
              </button>
              <span className="text-neutral-300 shrink-0">›</span>
              <button
                onClick={() => setCategoryDropdownOpen((v) => !v)}
                className="flex items-center gap-1 font-semibold text-neutral-900 min-w-0"
              >
                <span className="truncate">{categories.find((c) => c.id === selectedCategory)?.name}</span>
                <span className={`text-xs transition-transform shrink-0 ${categoryDropdownOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
            </div>
            {categoryDropdownOpen && (
              <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg z-20 max-h-64 overflow-y-auto">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedCategory(c.id); setCategoryDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors ${
                      c.id === selectedCategory ? 'font-semibold text-primary-700 bg-primary-50' : 'text-neutral-700'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Body: category grid (level 1) when nothing picked yet, else item grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {!searchQuery && !selectedCategory ? (
            <CategoryGrid
              categories={categories}
              selectedId={null}
              onSelect={(id) => setSelectedCategory(id)}
              itemsPerPage={24}
              heading="Menu Categories"
            />
          ) : (
            <>
              {searchQuery && (
                <p className="text-xs text-neutral-400 mb-2 px-1">
                  {filteredItems.length} result{filteredItems.length !== 1 ? 's' : ''} for "{searchQuery}"
                </p>
              )}
              {filteredItems.length === 0 ? (
                <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
                  {searchQuery ? `No items matching "${searchQuery}"` : 'No items in this category'}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {filteredItems.map((item: MenuItem) => {
                    const soldOut = item.status === 'sold_out';
                    const hasOptions = item.hasVariants || item.hasModifierGroups;
                    return (
                      <div
                        key={item.id}
                        onClick={() => !soldOut && handleItemTap(item)}
                        className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border-2 px-2 py-3 min-h-[72px] text-center transition-all ${
                          soldOut
                            ? 'border-neutral-200 bg-neutral-50 opacity-50 cursor-not-allowed'
                            : 'border-neutral-200 bg-white hover:border-primary-300 hover:shadow-sm cursor-pointer active:scale-95'
                        }`}
                      >
                        {(item.dietaryType || item.isFeatured || item.isRecommended) && (
                          <span className="absolute top-1.5 left-1.5 flex items-center gap-0.5">
                            {item.dietaryType && <DietaryMark type={item.dietaryType} size={12} />}
                            {item.isFeatured && (
                              <span className="text-amber-500 text-[11px] leading-none" title="Featured">★</span>
                            )}
                            {item.isRecommended && (
                              <span className="text-blue-500 text-[11px] leading-none" title="Recommended">✦</span>
                            )}
                          </span>
                        )}
                        <p className="text-xs font-semibold text-neutral-900 leading-tight line-clamp-2">{item.name}</p>
                        {soldOut ? (
                          <p className="text-[10px] text-error-500 font-medium">Sold Out</p>
                        ) : (
                          <p className="text-primary-600 font-bold text-xs">
                            {item.hasVariants ? 'From ' : ''}AED {item.basePrice.toFixed(2)}
                          </p>
                        )}
                        {!soldOut && hasOptions && (
                          <span className="text-[9px] text-neutral-400 -mt-0.5">Customize</span>
                        )}

                        {/* Quick-add — instant for plain items, opens the options
                            dialog when the item has variants/modifiers to choose */}
                        {!soldOut && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemTap(item);
                            }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs font-bold leading-none flex items-center justify-center shadow-sm transition-colors"
                            aria-label={hasOptions ? `Choose options for ${item.name}` : `Quick add ${item.name}`}
                          >
                            +
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
        </>)}
      </div>

      {/* ══ RIGHT: Cart Panel — hidden while picking a table; nothing to show yet ══ */}
      {!showingTableSelector && (
      <div className="flex flex-col w-1/3 bg-white">

        {/* Order type + table/guest */}
        <div className="px-4 py-3 border-b border-neutral-100 bg-neutral-50 shrink-0 space-y-2.5">
          {/* Single header row: back, title, quick-access icons, customer badge, hold */}
          <div className="flex items-center gap-1.5">
            {cart.orderType === OrderType.DINE_IN && cart.tableId && (
              <button
                onClick={() => {
                  if (cart.items.length > 0 && !confirm('You have unsent items for this table. Leave without sending them?')) return;
                  clearAll();
                }}
                title="Back to tables"
                className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-white shrink-0"
              >
                <ChevronLeftIcon size={16} />
              </button>
            )}
            <h2 className="font-bold text-sm text-neutral-900 flex items-center gap-1.5 min-w-0 shrink-0">
              <span>Current Order</span>
              {billRequested && (
                <span className="text-[10px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded shrink-0">
                  Bill Requested
                </span>
              )}
            </h2>

            <div className="flex items-center gap-1.5 ml-1">
              {captureCustomerDetails && (
                <button
                  onClick={() => setShowCustomerModal(true)}
                  title={cart.customerName ? `Customer: ${cart.customerName}` : 'Attach customer'}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors shrink-0 ${
                    cart.customerName
                      ? 'bg-accent-100 border-accent-300 text-accent-700'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  <UserIcon size={14} />
                </button>
              )}
              {cart.orderType === OrderType.DINE_IN && (
                <button
                  onClick={() => guestInputRef.current?.focus()}
                  title="Guests"
                  className="w-7 h-7 flex items-center justify-center rounded-lg border bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300 transition-colors shrink-0"
                >
                  <UsersIcon size={14} />
                </button>
              )}
              {!cart.existingOrderId && (
                <button
                  onClick={() => setExpandNotes((v) => !v)}
                  title="Order notes"
                  className={`w-7 h-7 flex items-center justify-center rounded-lg border transition-colors shrink-0 ${
                    expandNotes
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
                  }`}
                >
                  <EditIcon size={14} />
                </button>
              )}
            </div>

            {cart.customerName && (
              <span className="bg-accent-500 text-white text-xs font-bold px-2 py-1 rounded-lg truncate min-w-0">
                {cart.customerName}
              </span>
            )}

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {cart.existingOrderId && (
                <span className="text-xs font-normal text-neutral-400 truncate max-w-[70px]">
                  #{cart.existingOrderId.slice(-8).toUpperCase()}
                </span>
              )}
              {cart.items.length > 0 && (
                <button
                  onClick={handleHoldOrder}
                  className="text-xs text-neutral-500 hover:text-neutral-800 font-medium border border-neutral-300 rounded-lg px-2.5 py-1 hover:bg-white transition-colors shrink-0"
                >
                  Hold
                </button>
              )}
            </div>
          </div>

          {/* Table + guest (dine-in only) */}
          {cart.orderType === OrderType.DINE_IN && (
            <div className="space-y-2">
              {/* Table row */}
              <div>
                <label className="text-xs text-neutral-500 font-medium block mb-1">Table</label>
                {cart.tableId ? (
                  <div className="flex items-center gap-2 border border-neutral-200 bg-white rounded-lg px-3 py-2">
                    <span className="text-sm font-semibold text-neutral-900 flex-1 min-w-0">
                      Table {tableLabel}
                    </span>
                    {selectedTable && (
                      <span className="text-xs text-neutral-400 shrink-0">{selectedTable.capacity} Seats</span>
                    )}
                    <button
                      onClick={() => setShowTableSelector(true)}
                      className="text-xs text-primary-600 font-semibold hover:text-primary-700 shrink-0 ml-1"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowTableSelector(true)}
                    className="w-full text-left text-sm border border-neutral-200 bg-white rounded-lg px-3 py-2 text-neutral-400 hover:border-primary-300 hover:text-neutral-600 transition-colors"
                  >
                    Tap to select a table →
                  </button>
                )}
              </div>

              {/* Guest count — only editable after table is selected */}
              <div>
                <label className="text-xs text-neutral-500 font-medium block mb-1">Guests</label>
                <input
                  ref={guestInputRef}
                  type="number"
                  min={1}
                  value={cart.guestCount ?? ''}
                  onChange={(e) => cart.setGuestCount(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder={cart.tableId ? '—' : 'Select a table first'}
                  disabled={!cart.tableId}
                  className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-1.5 text-neutral-800 focus:outline-none focus:ring-2 focus:ring-primary-400 bg-white disabled:bg-neutral-50 disabled:text-neutral-400 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100">
          {existingOrderItems.length === 0 && cart.items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-neutral-400 gap-2">
              <span className="text-3xl">🛒</span>
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            <>
              {existingOrderItems.length > 0 && (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wide">
                    Sent to Kitchen
                  </p>
                  {existingOrderItems.map((item) => (
                    <ExistingOrderLine
                      key={item.id}
                      item={item}
                      updating={updatingSentItemId === item.id}
                      isNowSoldOut={soldOutMenuItemIds.has(item.menuItemId)}
                      onQuantityChange={(qty) => handleSentItemQuantityChange(item.id, qty)}
                      onRemove={() => handleRemoveSentItem(item.id)}
                    />
                  ))}
                </div>
              )}
              {cart.items.length > 0 && (
                <div>
                  {existingOrderItems.length > 0 && (
                    <p className="px-4 pt-3 pb-1 text-[11px] font-bold text-neutral-400 uppercase tracking-wide">
                      Adding Now
                    </p>
                  )}
                  {cart.items.map((item) => (
                    <CartLine key={item.id} item={item} cart={cart} onEdit={() => setEditingCartItem(item)} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Kitchen notes — only editable before the order exists; there's no
            endpoint to update notes on an order that's already been sent, so
            offering the field there would silently discard whatever's typed. */}
        {!cart.existingOrderId && (
          <div className="border-t border-neutral-100 shrink-0">
            <button
              onClick={() => setExpandNotes((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 text-xs text-neutral-500 hover:bg-neutral-50 transition-colors"
            >
              <span className="font-semibold">Kitchen Notes</span>
              <span className={`transition-transform ${expandNotes ? 'rotate-180' : ''}`}>▾</span>
            </button>
            {expandNotes && (
              <div className="px-4 pb-3">
                <textarea
                  value={cart.notes ?? ''}
                  onChange={(e) => cart.setNotes(e.target.value)}
                  placeholder="Add notes for the kitchen…"
                  rows={2}
                  className="w-full text-xs border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary-400 text-neutral-800 placeholder:text-neutral-400"
                />
              </div>
            )}
          </div>
        )}

        {/* Totals + actions */}
        <div className="border-t border-neutral-200 px-4 pt-3 pb-4 space-y-3 shrink-0">
          {lastOrderId && (
            <div className="bg-success-50 border border-success-200 text-success-700 text-xs rounded-lg px-3 py-2 flex items-center justify-between">
              <span>✓ Order placed</span>
              {lastChange !== null && lastChange > 0 && (
                <span className="font-bold">Change: AED {lastChange.toFixed(2)}</span>
              )}
            </div>
          )}

          <div className="space-y-1">
            {existingOrderItems.length > 0 && (
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Already sent to kitchen</span>
                <span>AED {(existingOrderDetail?.totalAmount ?? 0).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{existingOrderItems.length > 0 ? 'New items' : 'Subtotal'} ({cart.itemCount()} items)</span>
              <span>AED {cart.subtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>VAT (5%)</span>
              <span>AED {cart.taxAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-neutral-900 pt-1.5 border-t border-neutral-200 text-sm">
              <span>{existingOrderItems.length > 0 ? 'Order Total' : 'Total'}</span>
              <span>AED {((existingOrderDetail?.totalAmount ?? 0) + cart.totalAmount()).toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={clearAll}
              disabled={cart.items.length === 0 && !cart.existingOrderId}
              className="btn-secondary flex-1 py-3"
            >
              Clear
            </button>
            {cart.orderType === OrderType.DINE_IN ? (
              cart.items.length > 0 ? (
                <button
                  onClick={handleSendToKitchen}
                  disabled={placingOrder}
                  className="btn-primary flex-1 py-3 text-sm"
                >
                  {placingOrder ? 'Sending…' : cart.existingOrderId ? 'Send More' : 'Send to Kitchen'}
                </button>
              ) : billRequested ? (
                <button
                  onClick={handleCharge}
                  disabled={!cart.existingOrderId}
                  className="btn-primary flex-1 py-3 text-sm bg-green-600 hover:bg-green-700"
                >
                  Charge · AED {(existingOrderDetail?.totalAmount ?? 0).toFixed(2)}
                </button>
              ) : (
                <button
                  onClick={handleRequestBill}
                  disabled={!cart.existingOrderId || placingOrder}
                  className="btn-primary flex-1 py-3 text-sm bg-orange-500 hover:bg-orange-600"
                >
                  {placingOrder ? 'Requesting…' : 'Request Bill'}
                </button>
              )
            ) : (
              <button
                onClick={handlePlaceOrder}
                disabled={cart.items.length === 0 || placingOrder}
                className="btn-primary flex-1 py-3 text-sm"
              >
                {placingOrder ? 'Sending…' : `Charge · AED ${cart.totalAmount().toFixed(2)}`}
              </button>
            )}
          </div>
        </div>

        {/* Held orders */}
        {heldOrders.length > 0 && (
          <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 shrink-0 max-h-36 overflow-y-auto">
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">
              On Hold ({heldOrders.length})
            </p>
            <div className="space-y-1">
              {heldOrders.map((held) => (
                <button
                  key={held.id}
                  onClick={() => handleResumeOrder(held)}
                  className="w-full flex items-center justify-between bg-white border border-neutral-200 rounded-lg px-3 py-2 hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-neutral-800">{held.label}</p>
                    <p className="text-xs text-neutral-400">
                      {held.items.length} items ·{' '}
                      {new Date(held.heldAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary-600">
                    AED {held.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      )}
      </div>{/* panel wrapper */}

      {/* ══ Walk-In Service Type Modal ══════════════════════════════════ */}
      {showServiceTypeModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="font-bold text-neutral-900 text-base text-center mb-5">Select Service Type</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { cart.setOrderType(OrderType.DINE_IN); setShowServiceTypeModal(false); }}
                className="py-6 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm transition-colors"
              >
                Eat-In
              </button>
              <button
                onClick={() => { cart.setOrderType(OrderType.TAKEOUT); setShowServiceTypeModal(false); }}
                className="py-6 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm transition-colors"
              >
                Takeout
              </button>
            </div>
            <button
              onClick={() => setShowServiceTypeModal(false)}
              className="w-full mt-4 py-2 text-neutral-400 hover:text-neutral-600 text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ══ Table Selector Modal ═════════════════════════════════════════ */}
      {showTableSelector && (
        <TableSelectorModal
          storeId={storeId}
          initialTable={selectedTable}
          onSelect={handleTableSelect}
          onClose={() => setShowTableSelector(false)}
        />
      )}

      {/* ══ Item Options Dialog — editing a cart line ═══════════════════════ */}
      {editingCartItem && (
        <ItemOptionsDialog
          menuItem={editingCartItem.menuItem}
          detail={itemDetail}
          detailLoading={itemDetailLoading}
          initialQuantity={editingCartItem.quantity}
          initialVariantId={editingCartItem.variantId}
          initialModifications={editingCartItem.modifications}
          initialNotes={editingCartItem.notes}
          confirmLabel="Save"
          onConfirm={(qty, mods, variantId, variantName, notes, unitPrice) =>
            handleSaveCartItem(editingCartItem.id, qty, mods, variantId, variantName, notes, unitPrice)
          }
          onRemove={() => cart.removeItem(editingCartItem.id)}
          onClose={() => setEditingCartItem(null)}
        />
      )}

      {/* ══ Item Options Dialog — adding a fresh item ═══════════════════════ */}
      {addingItem && (
        <ItemOptionsDialog
          menuItem={addingItem}
          detail={itemDetail}
          detailLoading={itemDetailLoading}
          confirmLabel="Add to Order"
          onConfirm={(qty, mods, variantId, variantName, notes, unitPrice) =>
            handleAddItem(addingItem, qty, mods, variantId, variantName, notes, unitPrice)
          }
          onClose={() => setAddingItem(null)}
        />
      )}

      {/* ══ Checkout Modal ════════════════════════════════════════════════ */}
      {checkoutOrderId && (
        <CheckoutModal
          orderId={checkoutOrderId}
          storeId={storeId}
          totalAmount={checkoutTotal}
          onSuccess={handlePaymentSuccess}
          onClose={() => setCheckoutOrderId(null)}
        />
      )}

      {/* ══ Customer Modal ════════════════════════════════════════════════ */}
      {showCustomerModal && (
        <CustomerModal
          storeId={storeId}
          currentCustomerId={cart.customerId}
          currentCustomerName={cart.customerName}
          currentCustomerPhone={cart.customerPhone}
          onAttach={(customer) => {
            cart.setCustomer(customer);
            setShowCustomerModal(false);
          }}
          onRemove={() => {
            cart.setCustomer(undefined);
            setShowCustomerModal(false);
          }}
          onViewHistory={(customer) => {
            setShowCustomerModal(false);
            setHistoryCustomer(customer);
          }}
          onClose={() => setShowCustomerModal(false)}
        />
      )}

      {/* ══ Customer History Modal ═══════════════════════════════════════════ */}
      {historyCustomer && (
        <CustomerHistoryModal
          storeId={storeId}
          customer={historyCustomer}
          onClose={() => setHistoryCustomer(null)}
        />
      )}

      {/* ══ Discount Modal ════════════════════════════════════════════════ */}
      {showDiscountModal && cart.existingOrderId && (
        <DiscountModal
          orderId={cart.existingOrderId}
          currentDiscountAmount={existingOrderDetail?.discountAmount ?? 0}
          onApplied={() => {
            setShowDiscountModal(false);
            queryClient.invalidateQueries({ queryKey: ['order-detail', cart.existingOrderId] });
            queryClient.invalidateQueries({ queryKey: ['active-orders', storeId] });
          }}
          onClose={() => setShowDiscountModal(false)}
        />
      )}

      {/* ══ Loyalty Modal ═════════════════════════════════════════════════ */}
      {showLoyaltyModal && (
        <LoyaltyModal
          customerId={cart.customerId}
          onOpenCustomer={() => {
            setShowLoyaltyModal(false);
            setShowCustomerModal(true);
          }}
          onClose={() => setShowLoyaltyModal(false)}
        />
      )}

      {/* ══ Split Bill Modal ══════════════════════════════════════════════ */}
      {showSplitBillModal && cart.existingOrderId && (
        <SplitBillModal
          orderId={cart.existingOrderId}
          storeId={storeId}
          onSuccess={handleSplitBillSuccess}
          onClose={() => setShowSplitBillModal(false)}
        />
      )}

      {/* ══ Open Shift Modal ══════════════════════════════════════════════ */}
      {showOpenShiftModal && (
        <OpenShiftModal
          storeId={storeId}
          onSuccess={() => {
            setShowOpenShiftModal(false);
            void refetchActiveShift();
          }}
          onClose={() => setShowOpenShiftModal(false)}
        />
      )}

      {/* ══ Cash Management Modal ═════════════════════════════════════════ */}
      {showCashManagementModal && activeShift && (
        <CashManagementModal
          summary={activeShift}
          onChanged={() => void refetchActiveShift()}
          onClose={() => setShowCashManagementModal(false)}
        />
      )}

      {/* ══ Close Register Modal ══════════════════════════════════════════ */}
      {showCloseRegisterModal && activeShift && (
        <CloseRegisterModal
          summary={activeShift}
          onSuccess={() => {
            setShowCloseRegisterModal(false);
            void refetchActiveShift();
          }}
          onClose={() => setShowCloseRegisterModal(false)}
        />
      )}
    </div>
  );
}

// ─── Cart Line Item ────────────────────────────────────────────────────────────

interface CartLineCartActions {
  updateQuantity: (id: string, quantity: number) => void;
}

function CartLine({ item, cart, onEdit }: { item: CartItem; cart: CartLineCartActions; onEdit: () => void }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-neutral-900 leading-tight flex-1 min-w-0 truncate">
              {item.menuItem.name}
              {item.variantName && <span className="font-normal text-neutral-500"> ({item.variantName})</span>}
            </p>
            <button
              onClick={onEdit}
              className="text-neutral-400 hover:text-primary-600 transition-colors shrink-0"
              title="Edit item"
              aria-label="Edit item"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          {item.modifications.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5 leading-tight">
              {item.modifications.map((m) => m.modifierName).join(', ')}
            </p>
          )}
          {item.notes && (
            <p className="text-xs text-primary-600 mt-0.5 italic leading-tight">{item.notes}</p>
          )}
          <span className="text-xs text-neutral-400 mt-0.5 block">AED {item.unitPrice.toFixed(2)}</span>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
            className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 text-xs font-bold flex items-center justify-center transition-colors"
          >−</button>
          <span className="w-4 text-center text-xs font-bold text-neutral-900">{item.quantity}</span>
          <button
            onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
            className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 text-xs font-bold flex items-center justify-center transition-colors"
          >+</button>
        </div>

        <p className="text-xs font-bold text-neutral-900 w-14 text-right shrink-0">
          AED {(item.unitPrice * item.quantity).toFixed(2)}
        </p>
      </div>
    </div>
  );
}

const ORDER_ITEM_STATUS_STYLE: Record<OrderItemStatus, { label: string; className: string }> = {
  [OrderItemStatus.PENDING]: { label: 'Pending', className: 'bg-neutral-100 text-neutral-600' },
  [OrderItemStatus.ACCEPTED]: { label: 'Accepted', className: 'bg-blue-100 text-blue-700' },
  [OrderItemStatus.COOKING]: { label: 'Cooking', className: 'bg-orange-100 text-orange-700' },
  [OrderItemStatus.PREPARING]: { label: 'Preparing', className: 'bg-orange-100 text-orange-700' },
  [OrderItemStatus.READY]: { label: 'Ready', className: 'bg-green-100 text-green-700' },
  [OrderItemStatus.COLLECTED]: { label: 'Collected', className: 'bg-teal-100 text-teal-700' },
  [OrderItemStatus.SERVED]: { label: 'Served', className: 'bg-neutral-100 text-neutral-500' },
  [OrderItemStatus.CANCELLED]: { label: 'Cancelled', className: 'bg-error-100 text-error-600' },
};

// Line for an item already sent to the kitchen. Read-only once the kitchen has
// accepted/started it — but while it's still 'pending', the customer can still
// change their mind, so quantity/removal controls stay available.
function ExistingOrderLine({
  item,
  updating,
  isNowSoldOut,
  onQuantityChange,
  onRemove,
}: {
  item: OrderItem;
  updating: boolean;
  isNowSoldOut: boolean;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
}) {
  const statusStyle = ORDER_ITEM_STATUS_STYLE[item.status] ?? ORDER_ITEM_STATUS_STYLE[OrderItemStatus.PENDING];
  const isEditable = item.status === OrderItemStatus.PENDING;
  const showSoldOutWarning = isNowSoldOut && isEditable;
  return (
    <div className={`px-4 py-2.5 ${showSoldOutWarning ? 'bg-warning-50' : 'bg-neutral-50/60'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold text-neutral-700 leading-tight flex-1 min-w-0 truncate">
              {item.itemName ?? 'Item'}
            </p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${statusStyle.className}`}>
              {statusStyle.label}
            </span>
          </div>
          {showSoldOutWarning && (
            <p className="text-[11px] font-semibold text-warning-700 mt-0.5 leading-tight">
              ⚠ Now Sold Out — remove or check with kitchen
            </p>
          )}
          {item.modifications && item.modifications.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5 leading-tight">
              {item.modifications.map((m) => m.modifierName).join(', ')}
            </p>
          )}
          {item.notes && (
            <p className="text-xs text-primary-500 mt-0.5 italic leading-tight">{item.notes}</p>
          )}
          <span className="text-xs text-neutral-400 mt-0.5 block">AED {item.unitPrice.toFixed(2)}</span>
        </div>

        {isEditable ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onQuantityChange(item.quantity - 1)}
              disabled={updating}
              className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-50"
            >−</button>
            <span className="w-4 text-center text-xs font-bold text-neutral-900">{item.quantity}</span>
            <button
              onClick={() => onQuantityChange(item.quantity + 1)}
              disabled={updating}
              className="w-6 h-6 rounded-md bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-neutral-900 text-xs font-bold flex items-center justify-center transition-colors disabled:opacity-50"
            >+</button>
          </div>
        ) : (
          <span className="text-xs text-neutral-400 shrink-0">{item.quantity}×</span>
        )}

        <p className="text-xs font-bold text-neutral-600 w-14 text-right shrink-0">
          AED {item.totalPrice.toFixed(2)}
        </p>
      </div>
      {isEditable && (
        <button
          onClick={onRemove}
          disabled={updating}
          className="text-[11px] font-semibold text-error-600 hover:text-error-700 mt-1 disabled:opacity-50"
        >
          Remove
        </button>
      )}
    </div>
  );
}
