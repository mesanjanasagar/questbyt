import React, { useState } from 'react';
import { useKioskStore } from './store/kioskStore';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { PaymentPage } from './pages/PaymentPage';
import { ConfirmationPage } from './pages/ConfirmationPage';

const CONFIGURED_STORE_ID = import.meta.env.VITE_STORE_ID || localStorage.getItem('storeId') || '';

const SetupScreen: React.FC<{ onSave: (id: string) => void }> = ({ onSave }) => {
  const [value, setValue] = useState('');
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-50 gap-6 p-8">
      <h1 className="text-3xl font-bold text-gray-800">Kiosk Setup</h1>
      <p className="text-gray-500 text-center max-w-sm">Enter the Store ID to configure this kiosk terminal. You can find it in the Manager Dashboard → Restaurant settings.</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Store UUID (e.g. 03f0c874-74be-...)"
        className="w-full max-w-md border-2 border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500"
      />
      <button
        disabled={!value.trim()}
        onClick={() => {
          localStorage.setItem('storeId', value.trim());
          onSave(value.trim());
        }}
        className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold disabled:bg-gray-300 transition"
      >
        Save &amp; Start
      </button>
    </div>
  );
};

export const App: React.FC = () => {
  const step = useKioskStore((s) => s.step);
  const [storeId, setStoreId] = useState(CONFIGURED_STORE_ID);

  if (!storeId) {
    return <SetupScreen onSave={setStoreId} />;
  }

  switch (step) {
    case 'menu':
      return <MenuPage />;
    case 'cart':
      return <CartPage />;
    case 'payment':
      return <PaymentPage />;
    case 'confirmation':
      return <ConfirmationPage />;
    default:
      return <MenuPage />;
  }
};