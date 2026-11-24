import { useCallback, useEffect, useState } from 'react'
import Splash from './components/Splash'
import Icone from './components/Icone'
import Inicio from './screens/Inicio'
import Agendar from './screens/Agendar'
import MeusHorarios from './screens/MeusHorarios'
import Fidelidade from './screens/Fidelidade'
import Perfil from './screens/Perfil'
import Noivo from './screens/Noivo'
import Loja from './screens/Loja'
import Avaliar from './screens/Avaliar'
import Adiantar from './screens/Adiantar'
import { ProvedorApp, useApp } from './contexto'
import { api } from './api'
import { iniciarVisita } from './funil'

export type Aba = 'inicio' | 'agenda' | 'fidelidade' | 'perfil'
export type OpcoesAgendar = { servicoId?: string; profissionalId?: string; data?: string; hora?: string }
export type Navegar = (destino: Aba | 'agendar' | 'noivo' | 'loja', opcoes?: OpcoesAgendar) => void

type Modal = null | ({ tipo: 'agendar' } & OpcoesAgendar) | { tipo: 'noivo' } | { tipo: 'loja' } | { tipo: 'avaliar'; id: string } | { tipo: 'adiantar'; id: string }

/** link "faltou terminar" do WhatsApp: /#retomar/ID */
const retomarDoEndereco = () => /^#retomar\/([a-f0-9]{16})$/.exec(location.hash)?.[1]

/** abre direto pelo endereço: /#avaliar/ID e /#adiantar/ID (links do WhatsApp). O painel da equipe fica em painel.html, fora do app. */
function modalDoEndereco(): Modal {
  if (location.hash === '#painel') { location.replace('./painel.html'); return null } // link antigo
  const m = /^#(avaliar|adiantar)\/([\w-]{6,40})$/.exec(location.hash)
  return m ? { tipo: m[1] as 'avaliar' | 'adiantar', id: m[2] } : null
}

/** o splash completo aparece só na 1ª vez neste aparelho; depois o app abre direto.
 *  Na demonstração (vitrine), aparece a cada aba nova: quem recebe o link sempre vê a abertura. */
const guardaSplash = () => (import.meta.env.VITE_MODO === 'local' ? sessionStorage : localStorage)
const splashVisto = () => { try { return !!guardaSplash().getItem('roque-splash-visto') } catch { return true } }

function Conteudo() {
  const { barbearia, erroCarga, recarregar } = useApp()
  const { avisar } = useApp()
  const [splash, setSplash] = useState(() => !splashVisto() && !modalDoEndereco() && !retomarDoEndereco())
  const [aba, setAba] = useState<Aba>('inicio')
  const [modal, setModal] = useState<Modal>(modalDoEndereco)

  const fimSplash = useCallback(() => {
    try { guardaSplash().setItem('roque-splash-visto', '1') } catch { /* ok */ }
    setSplash(false)
  }, [])

  const navegar: Navegar = (destino, opcoes) => {
    if (destino === 'agendar') setModal({ tipo: 'agendar', ...opcoes })
    else if (destino === 'noivo' || destino === 'loja') setModal({ tipo: destino })
    else { setModal(null); setAba(destino); if (location.hash) history.replaceState(null, '', location.pathname) }
    window.scrollTo(0, 0)
  }

  // funil: começa a visita; pelo link "faltou terminar", reabre o agendamento onde a pessoa parou
  useEffect(() => {
    const retomar = () => {
      const id = retomarDoEndereco()
      if (!id) return false
      iniciarVisita(id)
      history.replaceState(null, '', location.pathname)
      api.retomar(id).then((r) => {
        if (r.jaAgendou) { avisar('Esse horário já foi marcado. Veja em Horários.'); setAba('agenda'); return }
        if (!r.livre && r.servicoId) avisar('Aquele horário foi ocupado. Escolha outro, o resto já está pronto.')
        setModal({ tipo: 'agendar', servicoId: r.servicoId ?? undefined, profissionalId: r.servicoId ? r.profissionalId ?? undefined : undefined, data: r.data ?? undefined, hora: r.hora ?? undefined })
      }).catch(() => setModal({ tipo: 'agendar' }))
      return true
    }
    if (!retomar()) iniciarVisita()
    window.addEventListener('hashchange', retomar)
    return () => window.removeEventListener('hashchange', retomar)
  }, [avisar])

  useEffect(() => {
    const f = () => { const m = modalDoEndereco(); if (m) setModal(m) }
    window.addEventListener('hashchange', f)
    return () => window.removeEventListener('hashchange', f)
  }, [])

  const abas: { id: Aba; rotulo: string; icone: string }[] = [
    { id: 'inicio', rotulo: 'Início', icone: 'inicio' },
    { id: 'agenda', rotulo: 'Horários', icone: 'agenda' },
    { id: 'fidelidade', rotulo: 'Fidelidade', icone: 'fidelidade' },
    { id: 'perfil', rotulo: 'A Roque', icone: 'perfil' },
  ]


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
        <Agendar key={`${modal.servicoId}-${modal.hora}`} servicoInicial={modal.servicoId} profissionalInicial={modal.profissionalId} dataInicial={modal.data} horaInicial={modal.hora} navegar={navegar} />
      ) : modal?.tipo === 'noivo' ? (
        <Noivo navegar={navegar} />
      ) : modal?.tipo === 'loja' ? (
        <Loja navegar={navegar} />
      ) : modal?.tipo === 'avaliar' ? (
        <Avaliar id={modal.id} navegar={navegar} />
      ) : modal?.tipo === 'adiantar' ? (
        <Adiantar id={modal.id} navegar={navegar} />
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
