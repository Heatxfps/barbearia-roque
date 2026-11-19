/**
 * Escolhe de onde vêm os dados:
 *  - VITE_MODO=local  → modo offline/vitrine (GitHub Pages), tudo no celular
 *  - padrão           → servidor real (pasta server/), na mesma origem ou em VITE_API_URL
 */
import { apiHttp } from './http'
import { apiLocal } from './local'

export const api = import.meta.env.VITE_MODO === 'local' ? apiLocal : apiHttp
export * from './tipos'
