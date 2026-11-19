import { useCallback, useEffect, useState } from 'react'
import Splash from './components/Splash'
import Icone from './components/Icone'
import Inicio from './screens/Inicio'
import Agendar from './screens/Agendar'
import MeusHorarios from './screens/MeusHorarios'
import Fidelidade from './screens/Fidelidade'
import Perfil from './screens/Perfil'
import Painel from './screens/painel/Painel'
import Noivo from './screens/Noivo'
import { ProvedorApp, useApp } from './contexto'

export type Aba = 'inicio' | 'agenda' | 'fidelidade' | 'perfil'
export type OpcoesAgendar = { servicoId?: string; profissionalId?: string }
export type Navegar = (destino: Aba | 'agendar' | 'painel' | 'noivo', opcoes?: OpcoesAgendar) => void

const lerSessao = (k: string) => { try { return sessionStorage.getItem(k) } catch { return null } }

function Conteudo() {
  const { barbearia, erroCarga, recarregar } = useApp()
  const [splash, setSplash] = useState(() => !lerSessao('roque-splash') && location.hash !== '#painel')
  const [aba, setAba] = useState<Aba>('inicio')
  const [modal, setModal] = useState<null | ({ tipo: 'agendar' } & OpcoesAgendar) | { tipo: 'painel' } | { tipo: 'noivo' }>(
    () => (location.hash === '#painel' ? { tipo: 'painel' } : null)
  )

  const fimSplash = useCallback(() => {
    try { sessionStorage.setItem('roque-splash', '1') } catch { /* ok */ }
    setSplash(false)
  }, [])

  const navegar: Navegar = (destino, opcoes) => {
    if (destino === 'agendar') setModal({ tipo: 'agendar', ...opcoes })
    else if (destino === 'noivo') setModal({ tipo: 'noivo' })
    else if (destino === 'painel') { setModal({ tipo: 'painel' }); history.replaceState(null, '', '#painel') }
    else { setModal(null); setAba(destino); if (location.hash) history.replaceState(null, '', location.pathname) }
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    const f = () => location.hash === '#painel' && setModal({ tipo: 'painel' })
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const abas: { id: Aba; rotulo: string; icone: string }[] = [
    { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
    { id: 'agenda', rotulo: 'Horários', icone: 'agenda' },
    { id: 'fidelidade', rotulo: 'Fidelidade', icone: 'fidelidade' },
    { id: 'perfil', rotulo: 'A Roque', icone: 'perfil' },
  ]

  if (modal?.tipo === 'painel') return <Painel navegar={navegar} />

  return (
    <div className="app">
      {splash && <Splash onFim={fimSplash} />}

      {!barbearia ? (
        !splash && (
          <div className="tela tela--centro">
            {erroCarga ? (
              <>
                <h1 className="titulo">Sem conexão</h1>
                <p className="suave centro">{erroCarga}</p>
                <button className="botao botao--principal" onClick={recarregar}>Tentar de novo</button>
              </>
            ) : <div className="carregando" aria-label="Carregando" />}
          </div>
        )
      ) : modal?.tipo === 'agendar' ? (
        <Agendar servicoInicial={modal.servicoId} profissionalInicial={modal.profissionalId} navegar={navegar} />
      ) : modal?.tipo === 'noivo' ? (
        <Noivo navegar={navegar} />
      ) : (
        <>
          <main className="conteudo" key={aba}>
            {aba === 'inicio' && <Inicio navegar={navegar} />}
            {aba === 'agenda' && <MeusHorarios navegar={navegar} />}
            {aba === 'fidelidade' && <Fidelidade navegar={navegar} />}
            {aba === 'perfil' && <Perfil navegar={navegar} />}
          </main>
          <nav className="abas" aria-label="Navegação principal">
            {abas.map((a) => (
              <button key={a.id} className={`aba ${aba === a.id ? 'aba--ativa' : ''}`} onClick={() => navegar(a.id)} aria-current={aba === a.id ? 'page' : undefined}>
                <Icone nome={a.icone} />
                <span>{a.rotulo}</span>
              </button>
            ))}
          </nav>
        </>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ProvedorApp>
      <Conteudo />
    </ProvedorApp>
  )
}
