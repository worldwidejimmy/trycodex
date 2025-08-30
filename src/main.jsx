import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// Basic client error reporting to server for debugging
function postLog(payload){
  try {
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch {}
}

window.addEventListener('error', (e) => {
  postLog({ level: 'error', message: String(e.message || 'window.onerror'), stack: e.error && e.error.stack });
});
window.addEventListener('unhandledrejection', (e) => {
  postLog({ level: 'error', message: 'unhandledrejection: ' + String(e.reason), stack: e.reason && e.reason.stack });
});

postLog({ level: 'info', message: 'App boot starting' });

const rootEl = document.getElementById('root');
if (!rootEl) {
  postLog({ level: 'error', message: 'Root element #root not found' });
} else {
  try {
    createRoot(rootEl).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    postLog({ level: 'info', message: 'React render called' });
  } catch (err) {
    postLog({ level: 'error', message: 'Render error', stack: err && err.stack });
  }
}
