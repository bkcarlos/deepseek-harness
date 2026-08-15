import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const src = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url))

/** Fail before a bare Vite dev/preview server can expose a boot-manifest-free shell. */
function rejectStandaloneServe(): Plugin {
  return {
    name: 'dsh-desktop-reject-standalone-serve',
    config(_config, env) {
      if (env.command === 'serve') throw new Error(
        'apps/desktop is not a standalone web app: the renderer needs the desktop IPC bridge injected by the Electron main. Build with `pnpm --filter @deepseek-ai/dsh-desktop run build`.',
      )
    },
  }
}

export default defineConfig({
  plugins: [rejectStandaloneServe(), react()],
  base: './',
  build: {
    sourcemap: true,
  },
  resolve: {
    // Workspace packages resolve to SOURCE so CSS rides vite's pipeline, and
    // plugin packages are never bundled (they arrive as runtime bundles).
    alias: [
      { find: /^node:module$/, replacement: src('./src/node-module-stub.ts') },
      { find: /^@deepseek-ai\/dsh-client-web$/, replacement: src('../../packages/client/web/src/boot.tsx') },
      { find: /^@deepseek-ai\/dsh-client-web-react$/, replacement: src('../../packages/client/web-react/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-slots$/, replacement: src('../../packages/client/ui-slots/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: src('../../packages/client/ui-primitives/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-ui-attachment$/, replacement: src('../../packages/client/ui-attachment/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-schema-form$/, replacement: src('../../packages/client/schema-form/src/index.ts') },
      { find: /^@deepseek-ai\/dsh-client-modules\/client$/, replacement: src('../../packages/client/modules/src/client/index.ts') },
    ],
  },
  define: {
    'process.versions.node': '"0.0.0"',
    'process.execArgv': '[]',
    'process.env.CORDIS_SHARED': 'undefined',
  },
})
