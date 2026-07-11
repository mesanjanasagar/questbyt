import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { ToastProvider } from '@pos/ui';
import { useAuthStore } from './store/authStore';
import { useOrderReadyNotifications } from './hooks/useOrderReadyNotifications';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import OrdersPage from './pages/OrdersPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-neutral-900">
      <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Mounted once above the router so the SSE connection survives navigation
// between POS and Orders instead of reconnecting on every route change.
function OrderReadyListener() {
  const isLoggedIn = useAuthStore((s) => !!s.accessToken);
  const storeId = useAuthStore((s) => s.user?.storeId);
  useOrderReadyNotifications(isLoggedIn ? storeId : undefined);
  return null;
}

export default function App() {
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait until Zustand has finished rehydrating from localStorage.
    if (!hasHydrated) return;

    const { accessToken, refreshToken, deviceId, setTokens, logout } =
      useAuthStore.getState();

    if (accessToken) {
      // Token was restored from localStorage — let PrivateRoute handle it.
      // If it's expired the 401 interceptor in apiClient will refresh it transparently.
      setReady(true);
      return;
    }

    if (refreshToken && deviceId) {
      // Access token not persisted yet (first run after upgrade) or was cleared.
      // Exchange the refresh token for a fresh pair before rendering routes.
      axios
        .post('/auth/refresh', { refreshToken, deviceId })
        .then((res) => {
          const { accessToken: newAccess, refreshToken: newRefresh } = res.data.data;
          setTokens(newAccess, newRefresh);
        })
        .catch(() => {
          logout();
        })
        .finally(() => setReady(true));
    } else {
      // No credentials at all — show login.
      setReady(true);
    }
  }, [hasHydrated]);

  if (!ready) return <Spinner />;

  return (
    <ToastProvider>
      <BrowserRouter>
        <OrderReadyListener />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <POSPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <PrivateRoute>
                <OrdersPage />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
