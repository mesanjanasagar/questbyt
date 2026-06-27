import React, { useEffect } from 'react';
import { useKioskStore } from '../store/kioskStore';

export const ConfirmationPage: React.FC = () => {
  const { orderNumber, setStep } = useKioskStore();

  useEffect(() => {
    const timer = setTimeout(() => {
      setStep('menu');
    }, 30000);
    return () => clearTimeout(timer);
  }, [setStep]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-green-50 gap-8 p-6">
      <div className="text-8xl">✅</div>

      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold text-green-700">Order Placed!</h1>
        <p className="text-xl text-gray-600">Thank you for your order</p>
      </div>

      {orderNumber && (
        <div className="bg-white rounded-2xl border border-green-200 shadow-sm px-12 py-8 text-center">
          <p className="text-gray-500 text-lg mb-2">Your Order Number</p>
          <p className="text-6xl font-bold text-gray-900 tracking-wider">{orderNumber}</p>
        </div>
      )}

      <div className="text-center space-y-2">
        <p className="text-gray-500 text-lg">Please wait for your number to be called</p>
        <p className="text-gray-400 text-sm">This screen will reset in 30 seconds</p>
      </div>

      <button
        onClick={() => setStep('menu')}
        className="mt-4 bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-2xl font-bold text-xl transition"
      >
        Start New Order
      </button>
    </div>
  );
};