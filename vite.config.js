import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/emblem.svg'],
      manifest: {
        name: 'The Chronicle — Macro Codex',
        short_name: 'Chronicle',
        description:
          'A private, local-first nutrition chronicle. Adaptive expenditure, barcode scanning, weight trends — no subscription, no account, yours.',
        theme_color: '#0D0B0E',
        background_color: '#0D0B0E',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        runtimeCaching: [
          {
            // cache food API lookups so recently seen foods work offline
            urlPattern: /^https:\/\/(world\.openfoodfacts\.org|api\.nal\.usda\.gov)\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'food-api',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1200 },
});
