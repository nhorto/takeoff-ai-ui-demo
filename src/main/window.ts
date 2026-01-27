// Window management for TakeoffAI Electron
import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log(`📦 Preload script path: ${preloadPath}`);
  console.log(`   __dirname: ${__dirname}`);
  console.log(`   Preload exists: ${fs.existsSync(preloadPath)}`);

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'TakeoffAI - Construction Quantity Takeoff',
    webPreferences: {
      nodeIntegration: false,  // Security: don't expose Node.js to renderer
      contextIsolation: true,  // Security: isolate renderer context
      preload: preloadPath,
      sandbox: false  // Need false for IPC to work properly
    },
    backgroundColor: '#1f2937', // Dark gray background
    show: false  // Don't show until ready-to-show
  });

  // Show window when ready to prevent flicker
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow?.show();
  });

  // Load the renderer
  if (app.isPackaged) {
    // Production: load from dist/renderer
    mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
  } else {
    // Development: load from Vite dev server
    mainWindow.loadURL('http://localhost:5173');

    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  }

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle navigation (security)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // Only allow navigation to localhost in development
    if (!app.isPackaged && !url.startsWith('http://localhost')) {
      event.preventDefault();
      console.warn(`Blocked navigation to: ${url}`);
    }
  });

  console.log('✅ Main window created');

  return mainWindow;
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}
