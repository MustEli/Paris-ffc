import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { useAuth } from './core/auth/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ReceptionIntakePage } from './pages/ReceptionIntakePage';
import { ReferenceListsPage } from './pages/ReferenceListsPage';
import { SchedulesPage } from './pages/SchedulesPage';
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
        <Route path="/schedules" element={<SchedulesPage />} />
        <Route path="/reception-intake" element={<ReceptionIntakePage />} />
        <Route
          path="/put-away"
          element={
            <PlaceholderPage
              title="Put-Away & Location Assignment"
              description="Warehouse mapping and racks."
            />
          }
        />
        <Route
          path="/order-prep"
          element={<PlaceholderPage title="Order Prep (Pick & Pack)" description="Labor calculator and staggering." />}
        />
        <Route
          path="/return-processing"
          element={<PlaceholderPage title="Return Processing" description="Returns processing workflow." />}
        />
        <Route
          path="/issue-queue"
          element={
            <PlaceholderPage
              title="Exceptions & Issue Queue"
              description="Damaged stock, overweight flags, incidents, requests, and questions."
            />
          }
        />
        <Route path="/reference-lists" element={<ReferenceListsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
