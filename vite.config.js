import { defineConfig } from 'vite'
import path from 'path'
import webcontainerFilesPlugin from './.vite/plugins/webcontainer-files.tsx'

export default defineConfig({
  // Suppress warnings about "use client" directives
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE' && 
            warning.message.includes('"use client"')) {
          return
        }
        warn(warning)
      }
    },
    // Increase chunk size limit to avoid too many warnings
    chunkSizeWarningLimit: 800,

  },
  optimizeDeps: {
    exclude: ['@electric-sql/pglite'],
  },
  plugins: [webcontainerFilesPlugin()],
  // Configure server headers for SharedArrayBuffer support
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
}) 