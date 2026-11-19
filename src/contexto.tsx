/** Estado global do app: dados da barbearia, cliente logado e avisos (toast). */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type Barbearia, type Cliente } from './api'

type Contexto = {
  barbearia: Barbearia | null
  erroCarga: string | null
  cliente: Cliente | null
  recarregar: () => Promise<void>
  definirCliente: (c: Cliente | null) => void
  avisar: (texto: string, tipo?: 'ok' | 'erro' | 'info') => void
}

const Ctx = createContext<Contexto>(null as never)
export const useApp = () => useContext(Ctx)

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [cliente, definirCliente] = useState<Cliente | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; tipo: string; n: number } | null>(null)

  const recarregar = useCallback(async () => {
    try {
      const [b, c] = await Promise.all([api.barbearia(), api.eu()])
      setBarbearia(b); definirCliente(c); setErroCarga(null)
    } catch (e) {
      setErroCarga((e as Error).message)
    }
  }, [])

  useEffect(() => { recarregar() }, [recarregar])

  const avisar = useCallback((texto: string, tipo: 'ok' | 'erro' | 'info' = 'ok') => {
    const n = Date.now()
    setAviso({ texto, tipo, n })
    setTimeout(() => setAviso((a) => (a?.n === n ? null : a)), tipo === 'info' ? 9000 : 4000)
  }, [])

  return (
    <Ctx.Provider value={{ barbearia, erroCarga, cliente, recarregar, definirCliente, avisar }}>
      {children}
      {aviso && <div className={`toast toast--${aviso.tipo}`} role="status" onClick={() => setAviso(null)}>{aviso.texto}</div>}
    </Ctx.Provider>
  )
}
