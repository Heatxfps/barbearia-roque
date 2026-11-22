/**
 * Painel da equipe da Barbearia Roque. Página própria (painel.html), fora do app do cliente.
 * Computador: menu lateral em grupos. Celular: barra inferior com as 4 seções do dia a dia + "Mais".
 * A equipe toda vê tudo, menos os Resultados (financeiro), que são só do dono.
 * Ajustes: o dono configura tudo; o barbeiro só troca a própria senha.
 */
import { useEffect, useState, type ReactNode } from 'react'
import Icone from '../../components/Icone'
import { api, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import Agenda from './Agenda'
import Ajustes from './Ajustes'
import Avaliacoes from './Avaliacoes'
import Clientes from './Clientes'
import Divulgacao from './Divulgacao'
import LojaPainel from './LojaPainel'
import Mensagens from './Mensagens'
import Resultados from './Resultados'

const B = import.meta.env.BASE_URL

type Secao = 'agenda' | 'loja' | 'clientes' | 'avaliacoes' | 'mensagens' | 'resultados' | 'divulgacao' | 'ajustes'
type Item = { id: Secao; rotulo: string; icone: string; titulo: string; dono?: boolean }

const ITENS: Item[] = [
  { id: 'agenda', rotulo: 'Agenda', icone: 'agenda', titulo: 'Agenda' },
  { id: 'loja', rotulo: 'Loja', icone: 'sacola', titulo: 'Pedidos da loja' },
  { id: 'clientes', rotulo: 'Clientes', icone: 'perfil', titulo: 'Clientes' },
  { id: 'avaliacoes', rotulo: 'Avaliações', icone: 'estrela', titulo: 'Avaliações' },
  { id: 'mensagens', rotulo: 'Mensagens', icone: 'whats', titulo: 'Mensagens do WhatsApp' },
  { id: 'resultados', rotulo: 'Resultados', icone: 'painel', titulo: 'Resultados', dono: true },
  { id: 'divulgacao', rotulo: 'Divulgação', icone: 'insta', titulo: 'Divulgação' },
  { id: 'ajustes', rotulo: 'Ajustes', icone: 'ajustes', titulo: 'Ajustes' },
]
const GRUPOS: [string, Secao[]][] = [
  ['Dia a dia', ['agenda', 'loja']],
  ['Clientes', ['clientes', 'avaliacoes', 'mensagens']],
  ['Gestão', ['resultados', 'divulgacao', 'ajustes']],
]
const PRINCIPAIS: Secao[] = ['agenda', 'loja', 'clientes', 'avaliacoes']

const lerSecao = (): Secao => { try { return (localStorage.getItem('roque-painel-secao') as Secao) || 'agenda' } catch { return 'agenda' } }

export default function Painel() {
  const [usuario, setUsuario] = useState<UsuarioPainel | null>(null)
  const [verificando, setVerificando] = useState(api.painel.logado())

  useEffect(() => {
    if (!api.painel.logado()) return
    api.painel.eu().then(setUsuario).catch(() => api.painel.sair()).finally(() => setVerificando(false))
  }, [])

  if (verificando) return <div className="painel"><div className="carregando" /></div>
  if (!usuario) return <Login aoEntrar={setUsuario} />
  if (usuario.trocarSenha) return <PrimeiroAcesso usuario={usuario} aoTrocar={() => setUsuario({ ...usuario, trocarSenha: false })} />
  return <Area usuario={usuario} sair={() => { api.painel.sair(); setUsuario(null) }} />
}

function Area({ usuario, sair }: { usuario: UsuarioPainel; sair: () => void }) {
  const { confirmar } = useApp()
  const dono = usuario.papel === 'dono'
  const itens = ITENS.filter((i) => !i.dono || dono)
  const [secao, setSecao] = useState<Secao>(() => { const s = lerSecao(); return itens.some((i) => i.id === s) ? s : 'agenda' })
  const [mais, setMais] = useState(false)
  const atual = itens.find((i) => i.id === secao)!

  const ir = (s: Secao) => {
    setSecao(s); setMais(false); window.scrollTo(0, 0)
    try { localStorage.setItem('roque-painel-secao', s) } catch { /* ok */ }
  }
  const pedirSaida = async () => { if (await confirmar('Sair do painel neste aparelho?', { botao: 'Sair', perigo: false })) sair() }

  const conteudo: Record<Secao, ReactNode> = {
    agenda: <Agenda usuario={usuario} />,
    loja: <LojaPainel />,
    clientes: <Clientes />,
    avaliacoes: <Avaliacoes />,
    mensagens: <Mensagens usuario={usuario} />,
    resultados: <Resultados />,
    divulgacao: <Divulgacao usuario={usuario} />,
    ajustes: <Ajustes usuario={usuario} />,
  }

  return (
    <div className="painel2">
      <aside className="painel2__lateral">
        <div className="painel2__marca">
          <img src={`${B}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
          <div><strong className="painel__titulo">Painel da Roque</strong><span className="suave pequeno">{usuario.nome} · {dono ? 'dono' : 'barbeiro'}</span></div>
        </div>
        <nav aria-label="Seções do painel">
          {GRUPOS.map(([grupo, ids]) => {
            const doGrupo = itens.filter((i) => ids.includes(i.id))
            if (!doGrupo.length) return null
            return (
              <div key={grupo} className="painel2__grupo">
                <span className="painel2__grupo-titulo">{grupo}</span>
                {doGrupo.map((i) => (
                  <button key={i.id} className={`painel2__item ${secao === i.id ? 'ativo' : ''}`} onClick={() => ir(i.id)} aria-current={secao === i.id ? 'page' : undefined}>
                    <Icone nome={i.icone} tam={19} /> {i.rotulo}
                  </button>
                ))}
              </div>
            )
          })}
        </nav>
        <button className="painel2__item painel2__sair" onClick={pedirSaida}><Icone nome="voltar" tam={19} /> Sair</button>
      </aside>

      <main className="painel2__conteudo">
        <header className="painel2__topo">
          <img className="painel2__logo-mini" src={`${B}logo-partes/logo-completa.png`} alt="" />
          <h1 className="titulo-editorial pequeno-ed">{atual.titulo}</h1>
          <span className="suave pequeno painel2__quem">{usuario.nome.split(' ')[0]}</span>
        </header>
        {api.modo === 'local' && <p className="aviso">Demonstração offline: dados fictícios guardados neste aparelho</p>}
        {conteudo[secao]}
      </main>

      <nav className="painel2__barra" aria-label="Seções principais">
        {PRINCIPAIS.map((id) => {
          const i = itens.find((x) => x.id === id)!
          return (
            <button key={id} className={`aba ${secao === id ? 'aba--ativa' : ''}`} onClick={() => ir(id)}>
              <Icone nome={i.icone} /><span>{i.rotulo}</span>
            </button>
          )
        })}
        <button className={`aba ${!PRINCIPAIS.includes(secao) ? 'aba--ativa' : ''}`} onClick={() => setMais(true)}>
          <Icone nome="menu" /><span>Mais</span>
        </button>
      </nav>

      {mais && (
        <div className="confirmar" role="presentation" onClick={() => setMais(false)}>
          <div className="painel2__mais" role="dialog" aria-label="Mais seções" onClick={(e) => e.stopPropagation()}>
            {itens.filter((i) => !PRINCIPAIS.includes(i.id)).map((i) => (
              <button key={i.id} className={`painel2__item ${secao === i.id ? 'ativo' : ''}`} onClick={() => ir(i.id)}><Icone nome={i.icone} tam={19} /> {i.rotulo}</button>
            ))}
            <button className="painel2__item painel2__sair" onClick={() => { setMais(false); pedirSaida() }}><Icone nome="voltar" tam={19} /> Sair</button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------- entrada ---------------- */
function Login({ aoEntrar }: { aoEntrar: (u: UsuarioPainel) => void }) {
  const { avisar } = useApp()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [lembrar, setLembrar] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [desafio, setDesafio] = useState<null | { desafio: string; destino: string; codigoDemo?: string }>(null)
  const [codigo, setCodigo] = useState('')

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    try {
      const r = await api.painel.entrar(email, senha, lembrar)
      if ('usuario' in r) aoEntrar(r.usuario)
      else { setDesafio(r); setCodigo(r.codigoDemo ?? '') }
    } catch (er) { avisar((er as Error).message, 'erro') } finally { setCarregando(false) }
  }
  const confirmarCodigo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!desafio) return
    setCarregando(true)
    try { aoEntrar(await api.painel.confirmarCodigo(desafio.desafio, codigo)) } catch (er) { avisar((er as Error).message, 'erro') } finally { setCarregando(false) }
  }

  return (
    <div className="painel painel--login">
      {!desafio ? (
        <form className="cartao login" onSubmit={entrar}>
          <img src={`${B}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
          <h1 className="titulo-editorial pequeno-ed centro">Painel da equipe</h1>
          <label className="campo"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label className="campo"><span>Senha</span><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></label>
          <label className="check"><input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} /> Manter conectado neste aparelho (30 dias)</label>
          <button className="botao botao--principal" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
          <p className="suave pequeno centro">{lembrar ? 'Use só no seu celular ou no tablet do balcão.' : 'Por segurança, o acesso expira em 12 horas.'}</p>
          {api.modo === 'local' && <p className="suave pequeno centro">Demonstração: dono@roque.local · roque123</p>}
        </form>
      ) : (
        <form className="cartao login" onSubmit={confirmarCodigo}>
          <img src={`${B}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
          <h1 className="titulo-editorial pequeno-ed centro">Confirme que é você</h1>
          <p className="suave centro">Mandamos um código para o WhatsApp {desafio.destino}.</p>
          {desafio.codigoDemo && (
            <div className="demo-codigo"><span className="sobretitulo">Modo demonstração</span><p>Na versão final o código chega no WhatsApp. Aqui ele já veio preenchido: <strong>{desafio.codigoDemo}</strong></p></div>
          )}
          <label className="campo"><span>Código de 6 dígitos</span>
            <input className="campo-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" autoFocus />
          </label>
          <button className="botao botao--principal" disabled={codigo.length !== 6 || carregando}>{carregando ? 'Conferindo…' : 'Entrar'}</button>
          <button type="button" className="link" onClick={() => { setDesafio(null); setCodigo('') }}>Voltar</button>
        </form>
      )}
    </div>
  )
}

/** Barbeiro novo: troca a senha inicial (que o dono passou) antes de usar o painel */
function PrimeiroAcesso({ usuario, aoTrocar }: { usuario: UsuarioPainel; aoTrocar: () => void }) {
  const { avisar } = useApp()
  const [s, setS] = useState({ atual: '', nova: '', repetir: '' })
  const ok = s.atual && s.nova.length >= 8 && s.nova === s.repetir && s.nova !== s.atual
  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try { await api.painel.trocarSenha(s.atual, s.nova); avisar('Senha criada. Bem-vindo ao painel!'); aoTrocar() } catch (er) { avisar((er as Error).message, 'erro') }
  }
  return (
    <div className="painel painel--login">
      <form className="cartao login" onSubmit={salvar}>
        <img src={`${B}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
        <h1 className="titulo-editorial pequeno-ed centro">Olá, {usuario.nome.split(' ')[0]}!</h1>
        <p className="suave centro">É seu primeiro acesso. Crie uma senha só sua (mínimo 8 caracteres).</p>
        <label className="campo"><span>Senha que você recebeu</span><input type="password" value={s.atual} onChange={(e) => setS({ ...s, atual: e.target.value })} autoComplete="current-password" /></label>
        <label className="campo"><span>Nova senha</span><input type="password" value={s.nova} onChange={(e) => setS({ ...s, nova: e.target.value })} autoComplete="new-password" /></label>
        <label className="campo"><span>Repita a nova senha</span><input type="password" value={s.repetir} onChange={(e) => setS({ ...s, repetir: e.target.value })} autoComplete="new-password" /></label>
        {s.repetir && s.nova !== s.repetir && <p className="pequeno erro">As senhas não conferem.</p>}
        <button className="botao botao--principal" disabled={!ok}>Criar senha e entrar</button>
      </form>
    </div>
  )
}
