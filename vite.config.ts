import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { applyMetaToHtml, JOIN_META, STATIC_PAGE_META } from './src/seo/pageMeta'

const packageJson = JSON.parse(readFileSync('./package.json', 'utf-8'))
const APP_VERSION = packageJson.version

// Plugin para injetar versão no Service Worker durante o build
const serviceWorkerVersionPlugin = () => {
  return {
    name: 'service-worker-version',
    writeBundle() {
      // Processar o sw.js no diretório dist após ser copiado do public/
      const swDistPath = resolve(__dirname, 'dist/sw.js')
      try {
        let swContent = readFileSync(swDistPath, 'utf-8')
        // Substituir qualquer versão (v1, v2, etc) pela versão atual do app
        swContent = swContent.replace(
          /const CACHE_NAME = ['"]recta-[^'"]+['"];?/,
          `const CACHE_NAME = 'recta-${APP_VERSION}';`
        )
        writeFileSync(swDistPath, swContent, 'utf-8')
      } catch (error) {
        // Arquivo pode não existir ainda, ignorar silenciosamente
        console.warn('Service Worker não encontrado em dist/, pulando injeção de versão')
      }
    }
  }
}

// Static copies of index.html with each public page's own meta tags, so link previews that don't
// run JS (WhatsApp, Discord, iMessage) show the right card. vercel.json rewrites the routes to them.
const staticPageMetaPlugin = () => {
  return {
    name: 'static-page-meta',
    writeBundle() {
      const indexHtml = readFileSync(resolve(__dirname, 'dist/index.html'), 'utf-8')
      for (const [path, meta] of Object.entries(STATIC_PAGE_META)) {
        writeFileSync(resolve(__dirname, `dist${path}.html`), applyMetaToHtml(indexHtml, meta, path), 'utf-8')
      }
      writeFileSync(resolve(__dirname, 'dist/join.html'), applyMetaToHtml(indexHtml, JOIN_META, '/join'), 'utf-8')
    }
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), serviceWorkerVersionPlugin(), staticPageMetaPlugin()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(packageJson.version),
  },
  build: {
    // Optimize chunk splitting for better caching
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'firebase-vendor': ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/analytics'],
          'ui-vendor': ['recharts', '@radix-ui/react-popover', 'cmdk'],
          'utils-vendor': ['date-fns', 'zod', 'react-hook-form', '@hookform/resolvers'],
        },
        // Ensure consistent chunk file names
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Source maps for production debugging (can be disabled for smaller builds)
    sourcemap: false,
    // Minify (using esbuild which is built-in, faster than terser)
    minify: 'esbuild',
    // Ensure assets are properly handled
    assetsDir: 'assets',
    // Build target for better compatibility
    target: 'esnext',
    // Ensure proper module format
    modulePreload: {
      polyfill: true,
    },
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom'],
  },
})

