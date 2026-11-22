/** Estado global do app: dados da barbearia, cliente logado, avisos (toast) e confirmações. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type Barbearia, type Cliente } from './api'
import { useDialogo } from './components/useDialogo'

type Contexto = {
  barbearia: Barbearia | null
  erroCarga: string | null
  cliente: Cliente | null
  recarregar: () => Promise<void>
  definirCliente: (c: Cliente | null) => void
  avisar: (texto: string, tipo?: 'ok' | 'erro' | 'info') => void
  /** Pergunta "tem certeza?" dentro do app (o window.confirm é bloqueado em alguns navegadores e apps instalados) */
  confirmar: (texto: string, opcoes?: { botao?: string; perigo?: boolean }) => Promise<boolean>
}

type Pergunta = { texto: string; botao: string; perigo: boolean; responder: (sim: boolean) => void }

const Ctx = createContext<Contexto>(null as never)
export const useApp = () => useContext(Ctx)

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [barbearia, setBarbearia] = useState<Barbearia | null>(null)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [cliente, definirCliente] = useState<Cliente | null>(null)
  const [aviso, setAviso] = useState<{ texto: string; tipo: string; n: number } | null>(null)
  const [pergunta, setPergunta] = useState<Pergunta | null>(null)

  const confirmar = useCallback((texto: string, opcoes: { botao?: string; perigo?: boolean } = {}) =>
    new Promise<boolean>((ok) => setPergunta({ texto, botao: opcoes.botao ?? 'Confirmar', perigo: opcoes.perigo ?? true, responder: ok })), [])
  const responder = (sim: boolean) => { pergunta?.responder(sim); setPergunta(null) }

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
    // erro fica mais tempo na tela: a pessoa precisa ler o que fazer
    setTimeout(() => setAviso((a) => (a?.n === n ? null : a)), tipo === 'info' ? 9000 : tipo === 'erro' ? 7000 : 4000)
  }, [])

  return (
    <Ctx.Provider value={{ barbearia, erroCarga, cliente, recarregar, definirCliente, avisar, confirmar }}>
      {children}
      {pergunta && <Confirmacao pergunta={pergunta} responder={responder} />}
      {aviso && <div className={`toast toast--${aviso.tipo}`} role={aviso.tipo === 'erro' ? 'alert' : 'status'} onClick={() => setAviso(null)}>{aviso.texto}</div>}
    </Ctx.Provider>
  )
}

/** "Tem certeza?" dentro do app. O foco começa em "Voltar" (a opção segura) e Esc também volta. */
function Confirmacao({ pergunta, responder }: { pergunta: Pergunta; responder: (sim: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogo(ref, () => responder(false))
  return (
    <div className="confirmar" role="presentation" onClick={() => responder(false)}>
      <div ref={ref} className="confirmar__caixa" role="alertdialog" aria-modal="true" aria-labelledby="confirmar-texto" onClick={(e) => e.stopPropagation()}>
        <p id="confirmar-texto">{pergunta.texto}</p>
        <div className="confirmar__botoes">
          <button className="botao botao--fantasma" onClick={() => responder(false)} data-foco>Voltar</button>
          <button className={`botao ${pergunta.perigo ? 'botao--perigo-cheio' : 'botao--principal'}`} onClick={() => responder(true)}>{pergunta.botao}</button>
        </div>
      </div>
    </div>
  )
}
