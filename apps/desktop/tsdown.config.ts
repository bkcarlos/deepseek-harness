import { defineConfig } from 'tsdown'

/**
 * Build the Electron process modules and their shared runtime modules as ESM. Every package import
 * (electron, node builtins, @deepseek-ai/*) stays external so the packaged app
 * carries the full node_modules closure un-bundled — native addons (node-pty,
 * koffi, node-addon-*) must resolve at runtime, never be inlined by a bundler.
 * Every local module imported by an entry is also an entry so tsdown emits its
 * `.js` file and rewrites the import instead of leaving a missing `.ts` path.
 */
export default defineConfig({
  entry: ['src/main.ts', 'src/preload.ts', 'src/boot.ts', 'src/update.ts', 'src/menu.ts'],
  outDir: 'dist-electron',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: false,
  clean: true,
  // Match the repo's built artifacts: ESM in a `type: module` app keeps `.js`.
  fixedExtension: false,
  external: (id: string) => !id.startsWith('.'),
})
