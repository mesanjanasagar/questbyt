import React from 'react';
import { useKioskStore } from '../store/kioskStore';

export const CartPage: React.FC = () => {
  const { cart, updateQuantity, removeFromCart, cartTotal, setStep } = useKioskStore();
  const total = cartTotal();

  if (cart.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-6">
        <p className="text-6xl">🛒</p>
        <p className="text-2xl font-bold text-gray-700">Your cart is empty</p>
        <button
          onClick={() => setStep('menu')}
          className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg"
        >
          Browse Menu
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm p-4 flex items-center gap-4">
        <button
          onClick={() => setStep('menu')}
          className="text-2xl text-gray-500 hover:text-gray-800"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Your Order</h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.map((item) => (
          <div key={item.menuItemId} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-lg">{item.name}</p>
                {item.selectedModifiers.length > 0 && (
                  <p className="text-sm text-gray-500 mt-1">
                    {item.selectedModifiers.map((m) => m.name).join(', ')}
                  </p>
                )}
                <p className="text-blue-700 font-bold mt-1">${item.lineTotal.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => updateQuantity(item.menuItemId, -1)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xl flex items-center justify-center"
                >
                  −
                </button>
                <span className="text-xl font-bold w-8 text-center">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.menuItemId, 1)}
                  className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 font-bold text-xl flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border-t border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between text-2xl font-bold">
          <span>Total</span>
          <span className="text-blue-700">${total.toFixed(2)}</span>
        </div>
        <button
          onClick={() => setStep('payment')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-5 rounded-2xl font-bold text-2xl transition"
        >
          Proceed to Payment
        </button>
      </div>
    </div>
  );
};