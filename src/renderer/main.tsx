import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('🎨 Renderer starting...');
console.log('   window.electronAPI exists:', typeof window.electronAPI !== 'undefined');
console.log('   window.electronAPI:', window.electronAPI);

// Check if electronAPI is available
if (typeof window.electronAPI === 'undefined') {
  document.body.innerHTML = `
    <div style="padding: 40px; background: #1f2937; color: white; font-family: sans-serif;">
      <h1 style="color: #ef4444;">ERROR: electronAPI not loaded</h1>
      <p>The preload script did not execute properly.</p>
      <p>Check the Electron console for errors.</p>
      <pre style="background: #111; padding: 20px; overflow: auto;">
window.electronAPI = ${typeof window.electronAPI}
      </pre>
    </div>
  `;
  throw new Error('electronAPI not available - preload script failed');
}

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
