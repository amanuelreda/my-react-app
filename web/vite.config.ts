import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// libsodium-wrappers ships a broken ESM entry (its .mjs imports a sibling that isn't bundled).
// Resolve the working CommonJS build (from the shared package, where it's installed) and alias the
// bare specifier to it so the browser bundle works. require.resolve() in a CJS context picks the
// package's "require"/"default" condition = the CJS file.
const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const libsodiumCjs = require.resolve('libsodium-wrappers', { paths: [resolve(here, '../shared')] });

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'libsodium-wrappers': libsodiumCjs,
    },
  },
  server: { port: 5173 },
});
