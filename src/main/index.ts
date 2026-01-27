// Main process entry point for TakeoffAI Electron
import { app, BrowserWindow } from 'electron';
import { setupIPCHandlers } from './ipc-handlers.js';
import { createMainWindow } from './window.js';
import * as path from 'path';

// This method will be called when Electron has finished
// initialization and is ready to create browser windows
app.whenReady().then(() => {
  console.log('🚀 TakeoffAI Electron starting...');
  console.log(`   App path: ${app.getAppPath()}`);
  console.log(`   User data: ${app.getPath('userData')}`);

  // Setup IPC handlers before creating window
  setupIPCHandlers();

  // Create the main window
  createMainWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
