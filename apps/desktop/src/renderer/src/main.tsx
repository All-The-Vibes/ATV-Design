import { initI18n } from '@atv-design/i18n';
import '@atv-design/ui/fonts';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { installRendererLogBridge } from './lib/renderer-logger';
import { useCodesignStore } from './store';

// Install as early as possible so errors during bootstrap are captured.
installRendererLogBridge();

// Expose the Zustand store on window for Playwright E2E tests.
// isE2E is bridged from the preload (Node context) where process.env is readable.
if (typeof window !== 'undefined' && (window.codesign?.isE2E || import.meta.env.DEV)) {
  (
    window as Window & { __codesign_test_store__?: typeof useCodesignStore }
  ).__codesign_test_store__ = useCodesignStore;
}

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found');
const root = createRoot(container);

async function bootstrap(): Promise<void> {
  const locale = window.codesign ? await window.codesign.locale.getCurrent() : undefined;
  await initI18n(locale);

  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void bootstrap();
