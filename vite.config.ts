// Konfiguration für Vite (Entwicklungsserver + Build), die PWA und die Tests.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Auf GitHub Pages liegt die App unter /<repo-name>/. Der Pfad wird im
  // GitHub-Workflow über BASE_PATH gesetzt; lokal ist es einfach "/".
  base: process.env.BASE_PATH ?? '/',
  define: {
    // Versionsnummer aus package.json, wird unter „Über“ angezeigt
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? 'dev'),
  },
  plugins: [
    react(),
    VitePWA({
      // Neue Versionen werden im Hintergrund geladen und beim nächsten Start aktiv.
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tango – Japanisch-Vokabeltrainer',
        short_name: 'Tango',
        description: 'Persönlicher Japanisch-Vokabeltrainer mit Spaced Repetition',
        lang: 'de',
        theme_color: '#1e293b',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Alles, was die App braucht, wird für den Offline-Betrieb gespeichert.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
