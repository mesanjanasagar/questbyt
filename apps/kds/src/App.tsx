import { useKDSAuthStore } from './store/authStore';
import { KDSPage } from './pages/KDSPage';
import { LoginPage } from './pages/LoginPage';
import './App.css';

function App() {
  const token = useKDSAuthStore((s) => s.token);
  return token ? <KDSPage /> : <LoginPage />;
}

export default App;