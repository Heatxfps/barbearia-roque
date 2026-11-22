/** Entrada do painel da equipe (painel.html): página separada do app do cliente. */
import React from 'react'
import ReactDOM from 'react-dom/client'
import { ProvedorApp } from './contexto'
import Painel from './screens/painel/Painel'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProvedorApp>
      <Painel />
    </ProvedorApp>
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}))
}
