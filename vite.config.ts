import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona no GitHub Pages, na VPS ou abrindo localmente.
// Em desenvolvimento, /api e /fotos são repassados para o servidor (pasta server/, porta 3333).
export default defineConfig({
  plugins: [react()],
  base: './',
  // duas páginas: o app do cliente (index.html) e o painel da equipe (painel.html)
  build: { rollupOptions: { input: { app: 'index.html', painel: 'painel.html' } } },
  server: {
    proxy: { '/api': 'http://localhost:3333', '/fotos': 'http://localhost:3333' },
  },
})
