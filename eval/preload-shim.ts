/**
 * Preload script to shim Electron before any imports resolve.
 * Run with: bun --preload ./eval/preload-shim.ts eval/run-eval.ts
 */
import { plugin } from 'bun';
import * as path from 'path';

const shimPath = path.resolve(import.meta.dir, 'electron-shim.js');

plugin({
  name: 'electron-shim',
  setup(build) {
    build.onResolve({ filter: /^electron$/ }, () => ({
      path: shimPath,
    }));
  },
});
