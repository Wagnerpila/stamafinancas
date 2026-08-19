import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  plugins: [
    react(),
    // Sem um service worker registrado, o Chrome no Android não considera o app "instalável":
    // "Adicionar à tela inicial" cria só um atalho que abre o navegador normal (com barra de
    // endereço), nunca a janela standalone que o iOS já dava de graça via apple-mobile-web-app-capable.
    // Esse plugin gera o service worker (via Workbox) e injeta o manifest.json automaticamente,
    // o que faz o Chrome oferecer "Instalar app" de verdade e abrir em modo standalone.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        id: '/',
        name: 'STAMA',
        short_name: 'STAMA',
        description: 'Controle financeiro pessoal',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#1e3a5f',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Nunca cachear chamadas de API/uploads — dados financeiros e sessão têm que vir sempre
        // da rede. O service worker só serve pra deixar o app instalável e cachear o shell estático.
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^\/uploads\//,
            handler: 'NetworkFirst',
            options: { cacheName: 'uploads-cache' },
          },
        ],
      },
      devOptions: {
        // Habilita o SW também em `vite dev`, senão só se reproduz o problema no build de produção.
        enabled: true,
        type: 'module',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
      '/uploads': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
});
