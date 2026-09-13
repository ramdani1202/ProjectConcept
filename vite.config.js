import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PENTING: ganti 'project-concept' di bawah ini dengan nama repo GitHub kamu,
// karena GitHub Pages menaruh situs di username.github.io/nama-repo/
const REPO_NAME = 'ProjectConcept' 

export default defineConfig({
  base: `/${REPO_NAME}/`,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Project Concept',
        short_name: 'ProjConcept',
        description: 'Petakan konsep dan alur kerja project lewat canvas visual',
        start_url: `/${REPO_NAME}/`,
        scope: `/${REPO_NAME}/`,
        display: 'standalone',
        background_color: '#FAF8F4',
        theme_color: '#FAF8F4',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // network-first for navigation & scripts so updates always show
        // as soon as the user reopens the app, cache only as offline fallback
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages-cache' }
          },
          {
            urlPattern: ({ request }) => ['script', 'style'].includes(request.destination),
            handler: 'NetworkFirst',
            options: { cacheName: 'assets-cache' }
          }
        ]
      }
    })
  ]
})
