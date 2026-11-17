import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';

import { App } from './App';
import { AuthProvider } from './core/auth/AuthContext';
import './core/i18n/config';
import './styles.css';

const queryClient = new QueryClient();

// HashRouter, not BrowserRouter — URLs like /#/put-away instead of
// /put-away. A route after the # is never sent to the server, so a
// reload or a browser auto-reloading a backgrounded tab always just
// requests the site's root (which exists) — no server-side rewrite
// rule needed to avoid a raw 404 on anything but the homepage.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <HashRouter>
          <App />
        </HashRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
