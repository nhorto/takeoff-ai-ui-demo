/**
 * Minimal Electron shim for running the orchestrator outside Electron.
 * Only stubs the APIs that tools.ts and pdf-extractor.ts actually use.
 */

export class BrowserWindow {
  constructor() {}
  loadURL() { return Promise.resolve(); }
  webContents = {
    executeJavaScript: () => Promise.resolve(),
    on: () => {},
    session: { setPermissionRequestHandler: () => {} }
  };
  on() { return this; }
  once() { return this; }
  show() {}
  close() {}
  destroy() {}
  isDestroyed() { return false; }
  static getAllWindows() { return []; }
  static getFocusedWindow() { return null; }
}

export const app = {
  getPath: (name) => {
    if (name === 'userData') return '/tmp/takeoff-eval-userdata';
    if (name === 'temp') return '/tmp';
    return '/tmp';
  },
  isReady: () => true,
  whenReady: () => Promise.resolve(),
  on: () => {},
  getName: () => 'takeoff-eval',
  getVersion: () => '0.0.0',
};

export const dialog = {
  showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
  showMessageBox: () => Promise.resolve({ response: 0 }),
};

export const shell = {
  openPath: () => Promise.resolve(''),
  openExternal: () => Promise.resolve(),
};

export const ipcMain = {
  handle: () => {},
  on: () => {},
};

export default {
  app,
  BrowserWindow,
  dialog,
  shell,
  ipcMain,
};
