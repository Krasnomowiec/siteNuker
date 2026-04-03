import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import BlockedPage from './BlockedPage.tsx';
import '@/assets/styles.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <BlockedPage />
    </StrictMode>,
  );
}
