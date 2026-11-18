import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes } from 'react-router-dom';

import { Layout } from './components/Layout';
import { useAuth } from './core/auth/AuthContext';
import { DashboardPage } from './pages/DashboardPage';
import { IssueReportsPage } from './pages/IssueReportsPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { ReceptionIntakePage } from './pages/ReceptionIntakePage';
import { ReceptionReportsPage } from './pages/ReceptionReportsPage';
import { ReferenceListsPage } from './pages/ReferenceListsPage';
import { SchedulesPage } from './pages/SchedulesPage';
import { TaskBoardPage } from './pages/TaskBoardPage';

export function App() {
  const { t } = useTranslation('common');
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
        <Route path="/reception-reports" element={<ReceptionReportsPage />} />
        <Route
          path="/order-prep"
          element={
            <PlaceholderPage
              variant="orderPrep"
              title={t('nav.orderPrep')}
              description={t('placeholder.orderPrepDescription')}
            />
          }
        />
        <Route
          path="/return-processing"
          element={
            <PlaceholderPage
              variant="returnProcessing"
              title={t('nav.returnProcessing')}
              description={t('placeholder.returnProcessingDescription')}
            />
          }
        />
        <Route path="/issue-queue" element={<IssueReportsPage />} />
        <Route path="/reference-lists" element={<ReferenceListsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
