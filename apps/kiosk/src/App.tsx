import React from 'react';
import { useKioskStore } from './store/kioskStore';
import { MenuPage } from './pages/MenuPage';
import { CartPage } from './pages/CartPage';
import { PaymentPage } from './pages/PaymentPage';
import { ConfirmationPage } from './pages/ConfirmationPage';

export const App: React.FC = () => {
  const step = useKioskStore((s) => s.step);

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