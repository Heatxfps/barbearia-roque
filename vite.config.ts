import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base relativa: funciona no GitHub Pages, Vercel, Netlify ou abrindo localmente
export default defineConfig({
  plugins: [react()],
  base: './',
})
