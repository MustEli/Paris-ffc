import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { useAuth } from './core/auth/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { ReceptionsPage } from './pages/ReceptionsPage';
import { ReferenceListsPage } from './pages/ReferenceListsPage';
import { SellerStockPage } from './pages/SellerStockPage';
import { TaskBoardPage } from './pages/TaskBoardPage';

export function App() {
  const { status } = useAuth();

  if (status !== 'authenticated') {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/task-board" element={<TaskBoardPage />} />
        <Route path="/reference-lists" element={<ReferenceListsPage />} />
        <Route path="/receptions" element={<ReceptionsPage />} />
        <Route path="/seller-stock" element={<SellerStockPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
