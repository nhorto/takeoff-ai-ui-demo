#!/bin/bash
# Run eval with Electron module shimmed out
# Usage: ./eval/run-eval-cli.sh [--runs N]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Backup and replace electron module
ELECTRON_INDEX="$PROJECT_DIR/node_modules/electron/index.js"
ELECTRON_BACKUP="$PROJECT_DIR/node_modules/electron/index.js.bak"

# Only backup if not already backed up
if [ ! -f "$ELECTRON_BACKUP" ]; then
  cp "$ELECTRON_INDEX" "$ELECTRON_BACKUP"
fi

# Replace with ESM shim
cat > "$ELECTRON_INDEX" << 'SHIM'
export class BrowserWindow {
  constructor() {}
  loadURL() { return Promise.resolve(); }
  webContents = { executeJavaScript: () => Promise.resolve(), on: () => {}, session: { setPermissionRequestHandler: () => {} } };
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
  getPath: (name) => name === 'userData' ? '/tmp/takeoff-eval-userdata' : '/tmp',
  isReady: () => true, whenReady: () => Promise.resolve(), on: () => {},
  getName: () => 'takeoff-eval', getVersion: () => '0.0.0',
};
export const dialog = {
  showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] }),
  showMessageBox: () => Promise.resolve({ response: 0 }),
};
export const shell = { openPath: () => Promise.resolve(''), openExternal: () => Promise.resolve() };
export const ipcMain = { handle: () => {}, on: () => {} };
export default { app, BrowserWindow, dialog, shell, ipcMain };
SHIM

# Run the eval
bun run "$SCRIPT_DIR/run-eval.ts" "$@"
EXIT_CODE=$?

# Restore electron module
mv "$ELECTRON_BACKUP" "$ELECTRON_INDEX"

exit $EXIT_CODE
