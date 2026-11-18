import { useCallback, useState } from 'react'
import Splash from './components/Splash'
import Icone from './components/Icone'
import Inicio from './screens/Inicio'
import Agendar from './screens/Agendar'
import MeusHorarios from './screens/MeusHorarios'
import Fidelidade from './screens/Fidelidade'
import Perfil from './screens/Perfil'
import Painel from './screens/Painel'

export type Aba = 'inicio' | 'agenda' | 'fidelidade' | 'perfil'
export type Navegar = (destino: Aba | 'agendar' | 'painel', servicoId?: string) => void

export default function App() {
  const [splash, setSplash] = useState(() => !sessionStorage.getItem('roque-splash'))
  const [aba, setAba] = useState<Aba>('inicio')
  const [modal, setModal] = useState<null | { tipo: 'agendar'; servicoId?: string } | { tipo: 'painel' }>(null)

  const fimSplash = useCallback(() => {
    try { sessionStorage.setItem('roque-splash', '1') } catch { /* ok */ }
    setSplash(false)
  }, [])

  const navegar: Navegar = (destino, servicoId) => {
    if (destino === 'agendar') setModal({ tipo: 'agendar', servicoId })
    else if (destino === 'painel') setModal({ tipo: 'painel' })
    else { setModal(null); setAba(destino) }
    window.scrollTo(0, 0)
  }

  const abas: { id: Aba; rotulo: string; icone: string }[] = [
    { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
    { id: 'agenda', rotulo: 'Horários', icone: 'agenda' },
    { id: 'fidelidade', rotulo: 'Fidelidade', icone: 'fidelidade' },
    { id: 'perfil', rotulo: 'A Roque', icone: 'perfil' },
  ]

  return (
    <div className="app">
      {splash && <Splash onFim={fimSplash} />}

      {modal?.tipo === 'agendar' ? (
        <Agendar servicoInicial={modal.servicoId} navegar={navegar} />
      ) : modal?.tipo === 'painel' ? (
        <Painel navegar={navegar} />
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
