import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['crypto', 'buffer', 'stream', 'util', 'events', 'process', 'assert', 'querystring', 'url', 'fs', 'path', 'os'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Provide polyfills for fs/promises
      polyfills: {
        fs: true,
        'fs/promises': true,
      },
    }),
  ],
  define: {
    global: 'globalThis',
    'process.env': {},
    'process.browser': true,
    'process.version': '"v16.0.0"',
    'process.platform': '"browser"',
  },
  resolve: {
    alias: {
      '@': '/src',
      // Provide polyfills for node: prefixed modules
      'node:fs': 'fs',
      'node:fs/promises': 'fs/promises',
      'node:path': 'path',
      'node:os': 'os',
      'node:crypto': 'crypto',
      'node:stream': 'stream',
      'node:util': 'util',
      'node:assert': 'assert',
      'node:events': 'events',
      'node:querystring': 'querystring',
      'node:url': 'url',
    },
  },
  server: {
    port: 3000,
  },
  envPrefix: 'VITE_',
  esbuild: {
    target: 'esnext',
  },
  optimizeDeps: {
    include: ['ethers']
  },
  build: {
    rollupOptions: {
      external: ['node:crypto', 'node:fs', 'node:fs/promises', 'node:path', 'node:os', 'node:stream', 'node:util', 'node:assert', 'node:events', 'node:querystring', 'node:url']
    }
  }
})
