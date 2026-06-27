import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { getFullMenu } from '../api/menu';
import { createOrder } from '../api/orders';
import CheckoutModal from '../components/CheckoutModal';
import type { MenuItem, MenuCategory } from '@pos/shared-types';
import { OrderType } from '@pos/shared-types';
import { useState } from 'react';

export default function POSPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const storeId = user?.storeId ?? '';

  const { data: menu, isLoading } = useQuery({
    queryKey: ['menu', storeId],
    queryFn: () => getFullMenu(storeId),
    enabled: !!storeId,
  });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [checkoutOrderId, setCheckoutOrderId] = useState<string | null>(null);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastChange, setLastChange] = useState<number | null>(null);

  const cart = useCartStore();

  const categories = menu?.categories ?? [];
  const activeCategory = selectedCategory ?? categories[0]?.id ?? null;
  const items = (menu?.items ?? []).filter((i) => i.categoryId === activeCategory);

  async function handlePlaceOrder() {
    if (cart.items.length === 0) return;
    setPlacingOrder(true);
    try {
      const order = await createOrder({
        storeId,
        deviceId: useAuthStore.getState().deviceId!,
        cashierId: user!.id,
        orderType: cart.orderType as OrderType,
        tableNumber: cart.tableNumber,
        notes: cart.notes,
        items: cart.items.map((i) => ({
          menuItemId: i.menuItem.id,
          variantId: i.variantId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          modifications: i.modifications,
          notes: i.notes,
        })),
      });
      // Open checkout modal to collect payment
      setCheckoutOrderId(order.id);
    } finally {
      setPlacingOrder(false);
    }
  }

  function handlePaymentSuccess(changeDue?: number) {
    setLastOrderId(checkoutOrderId);
    setLastChange(changeDue ?? null);
    setCheckoutOrderId(null);
    cart.clearCart();
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* — Left: Menu Panel — */}
      <div className="flex flex-col w-2/3 bg-white border-r border-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-primary-800 text-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center font-bold text-sm">POS</div>
            <span className="font-semibold text-sm">{user?.username}</span>
          </div>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">Sign out</button>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-gray-200 px-2 py-2 gap-2 bg-gray-50">
          {categories.map((cat: MenuCategory) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Menu items grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-3 gap-3">
            {items.map((item: MenuItem) => (
              <button
                key={item.id}
                onClick={() =>
                  cart.addItem({
                    menuItem: item,
                    quantity: 1,
                    unitPrice: item.basePrice,
                    modifications: [],
                  })
                }
                disabled={item.status === 'sold_out' || item.status === 'inactive'}
                className={`card text-left transition-all hover:shadow-md hover:border-primary-300 active:scale-95 ${
                  item.status === 'sold_out' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div className="aspect-square bg-gray-100 rounded-lg mb-2 flex items-center justify-center text-2xl">
                  🍽
                </div>
                <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                {item.status === 'sold_out' && (
                  <span className="text-xs text-red-500 font-medium">Sold Out</span>
                )}
                <p className="text-primary-600 font-bold text-sm mt-1">AED {item.basePrice.toFixed(2)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* — Right: Cart Panel — */}
      <div className="flex flex-col w-1/3 bg-white">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-bold text-gray-900">Current Order</h2>
          <div className="flex gap-2 mt-2">
            {(['dine-in', 'takeout', 'delivery'] as const).map((type) => (
              <button
                key={type}
                onClick={() => cart.setOrderType(type as OrderType)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  cart.orderType === type
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {cart.items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              No items added yet
            </div>
          ) : (
            cart.items.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.menuItem.name}</p>
                  <p className="text-xs text-gray-500">AED {item.unitPrice.toFixed(2)} each</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => cart.updateQuantity(item.id, item.quantity - 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold flex items-center justify-center"
                  >-</button>
                  <span className="w-5 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    onClick={() => cart.updateQuantity(item.id, item.quantity + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-sm font-bold flex items-center justify-center"
                  >+</button>
                </div>
                <p className="text-sm font-semibold text-gray-900 w-16 text-right">
                  AED {(item.unitPrice * item.quantity).toFixed(2)}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Order totals + place order */}
        <div className="border-t border-gray-200 p-4 space-y-3">
          {lastOrderId && (
            <div className="bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg px-3 py-2">
              ✓ Paid! Order #{lastOrderId.slice(-8)}
              {lastChange !== null && lastChange > 0 && (
                <span className="ml-2 font-bold">Change: AED {lastChange.toFixed(2)}</span>
              )}
            </div>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>AED {cart.subtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>VAT (5%)</span>
              <span>AED {cart.taxAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>AED {cart.totalAmount().toFixed(2)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => cart.clearCart()}
              disabled={cart.items.length === 0}
              className="btn-secondary flex-1 py-3"
            >
              Clear
            </button>
            <button
              onClick={handlePlaceOrder}
              disabled={cart.items.length === 0 || placingOrder}
              className="btn-primary flex-1 py-3"
            >
              {placingOrder ? 'Placing...' : `Charge (${cart.itemCount()})`}
            </button>
          </div>
        </div>
      </div>

      {/* Checkout modal */}
      {checkoutOrderId && (
        <CheckoutModal
          orderId={checkoutOrderId}
          storeId={storeId}
          totalAmount={cart.totalAmount()}
          onSuccess={handlePaymentSuccess}
          onClose={() => setCheckoutOrderId(null)}
        />
      )}
    </div>
  );
}