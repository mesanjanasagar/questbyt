import React, { useState } from 'react';
import { useKioskStore } from '../store/kioskStore';
import { kioskAPI } from '../api/kiosk';

const PAYMENT_METHODS = [
  { id: 'card', label: 'Credit / Debit Card', icon: '💳' },
  { id: 'cash', label: 'Cash', icon: '💵' },
  { id: 'mobile', label: 'Mobile Pay', icon: '📱' },
] as const;

const STORE_ID = localStorage.getItem('storeId') || 'default-store';

export const PaymentPage: React.FC = () => {
  const { cart, cartTotal, setStep, setOrderConfirmed, clearCart } = useKioskStore();
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const total = cartTotal();

  const handlePay = async () => {
    if (!selectedMethod) return;
    setProcessing(true);
    setError(null);

    try {
      const order = await kioskAPI.createOrder(
        STORE_ID,
        cart.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          modifiers: item.selectedModifiers.map((m) => m.modifierId),
        })),
        'kiosk'
      );

      await kioskAPI.processPayment(order.id, selectedMethod, total);

      setOrderConfirmed(order.id, order.orderNumber);
      clearCart();
      setStep('confirmation');
    } catch (err) {
      setError('Payment failed. Please try again or choose another method.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <header className="bg-white shadow-sm p-4 flex items-center gap-4">
        <button
          onClick={() => setStep('cart')}
          className="text-2xl text-gray-500 hover:text-gray-800"
          disabled={processing}
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 w-full max-w-md text-center">
          <p className="text-gray-500 text-lg mb-1">Amount Due</p>
          <p className="text-5xl font-bold text-blue-700">${total.toFixed(2)}</p>
        </div>

        <div className="w-full max-w-md space-y-3">
          <p className="text-lg font-semibold text-gray-700 text-center">Select Payment Method</p>
          {PAYMENT_METHODS.map((method) => (
            <button
              key={method.id}
              onClick={() => setSelectedMethod(method.id)}
              disabled={processing}
              className={`w-full flex items-center gap-5 px-6 py-5 rounded-2xl border-2 text-left transition ${
                selectedMethod === method.id
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <span className="text-4xl">{method.icon}</span>
              <span className="text-xl font-semibold text-gray-800">{method.label}</span>
              {selectedMethod === method.id && (
                <span className="ml-auto text-blue-600 text-2xl font-bold">✓</span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-600 font-medium text-center max-w-md">{error}</p>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-6">
        <button
          onClick={handlePay}
          disabled={!selectedMethod || processing}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white py-5 rounded-2xl font-bold text-2xl transition"
        >
          {processing ? 'Processing...' : `Pay $${total.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
};