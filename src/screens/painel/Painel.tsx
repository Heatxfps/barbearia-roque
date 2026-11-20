/**
 * Painel da barbearia (dono e barbeiros). Também abre direto pelo endereço /#painel.
 */
import { useCallback, useEffect, useState } from 'react'
import type { Navegar } from '../../App'
import Icone from '../../components/Icone'
import { api, type Bloqueio, type ClientePainel, type ItemAgenda, type Mensagem, type Profissional, type Resumo, type Status, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, dataIso, dataLonga, foto, formatarTelefone, hora, lerData, linkWhats, moeda, primeiroNome } from '../../util'
import Ajustes from './Ajustes'
import Divulgacao from './Divulgacao'

type Aba = 'hoje' | 'clientes' | 'whatsapp' | 'divulgacao' | 'ajustes'

export default function Painel({ navegar }: { navegar: Navegar }) {
  const { avisar } = useApp()
  const [usuario, setUsuario] = useState<UsuarioPainel | null>(null)
  const [verificando, setVerificando] = useState(api.painel.logado())
  const [aba, setAba] = useState<Aba>('hoje')

  useEffect(() => {
    if (!api.painel.logado()) return
    api.painel.eu().then(setUsuario).catch(() => api.painel.sair()).finally(() => setVerificando(false))
  }, [])

  const sair = () => { api.painel.sair(); setUsuario(null) }

  if (verificando) return <div className="painel"><div className="carregando" /></div>
  if (!usuario) return <Login aoEntrar={setUsuario} voltar={() => navegar('perfil')} />

  const dono = usuario.papel === 'dono'
  const abas: [Aba, string][] = [['hoje', 'Agenda'], ['clientes', 'Clientes'], ['whatsapp', 'WhatsApp'], ['divulgacao', 'Divulgação'], ['ajustes', 'Ajustes']]

  return (
    <div className="painel">
      <header className="painel__topo">
        <button className="icone-botao" onClick={() => navegar('perfil')} aria-label="Voltar ao app"><Icone nome="voltar" /></button>
        <div className="painel__marca">
          <img src={`${import.meta.env.BASE_URL}logo-partes/logo-completa.png`} alt="" />
          <div><strong className="painel__titulo">Painel da Roque</strong><span className="suave pequeno">{usuario.nome} · {dono ? 'dono' : 'barbeiro'}</span></div>
        </div>
        <button className="link" onClick={sair}>Sair</button>
      </header>
      {api.modo === 'local' && <p className="aviso">Demonstração offline: dados fictícios guardados neste aparelho</p>}

      <nav className="painel__abas">
        {abas.map(([id, rot]) => <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>{rot}</button>)}
      </nav>

      {aba === 'hoje' && <AbaAgenda usuario={usuario} avisar={avisar} />}
      {aba === 'clientes' && <AbaClientes />}
      {aba === 'whatsapp' && <AbaWhatsApp />}
      {aba === 'divulgacao' && <Divulgacao />}
      {aba === 'ajustes' && <Ajustes usuario={usuario} />}
    </div>
  )
}

function Login({ aoEntrar, voltar }: { aoEntrar: (u: UsuarioPainel) => void; voltar: () => void }) {
  const { avisar } = useApp()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    try { aoEntrar(await api.painel.entrar(email, senha)) } catch (er) { avisar((er as Error).message, 'erro') } finally { setCarregando(false) }
  }
  return (
    <div className="painel painel--login">
      <button className="icone-botao" onClick={voltar} aria-label="Voltar"><Icone nome="voltar" /></button>
      <form className="cartao login" onSubmit={entrar}>
        <img src={`${import.meta.env.BASE_URL}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
        <h1 className="topo__titulo centro">Área da barbearia</h1>
        <label className="campo"><span>E-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="campo"><span>Senha</span><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></label>
        <button className="botao botao--principal" disabled={carregando}>{carregando ? 'Entrando…' : 'Entrar'}</button>
        {api.modo === 'local' && <p className="suave pequeno centro">Demonstração: dono@roque.local · roque123</p>}
      </form>
    </div>
  )
}

const ROTULO: Record<Status, string> = { confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' }
const pct = (v: number) => `${Math.round(v * 100)}%`

function AbaAgenda({ usuario, avisar }: { usuario: UsuarioPainel; avisar: (t: string, tipo?: 'ok' | 'erro') => void }) {
  const { barbearia } = useApp()
  const [data, setData] = useState(dataIso(new Date()))
  const [filtro, setFiltro] = useState('todos')
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [agenda, setAgenda] = useState<{ agendamentos: ItemAgenda[]; bloqueios: Bloqueio[] } | null>(null)
  const [form, setForm] = useState<null | 'encaixe' | 'bloqueio'>(null)

  const carregar = useCallback(() => {
    api.painel.resumo(data).then(setResumo).catch((e) => avisar(e.message, 'erro'))
    api.painel.agenda(data, filtro).then(setAgenda).catch((e) => avisar(e.message, 'erro'))
  }, [data, filtro, avisar])
  useEffect(() => { carregar() }, [carregar])

  const mudarDia = (n: number) => { const d = lerData(data); d.setDate(d.getDate() + n); setData(dataIso(d)) }
  const marcar = async (a: ItemAgenda, s: Status) => {
    if (s === 'cancelado' && !window.confirm(`Cancelar o horário de ${a.cliente}? Ele recebe um aviso no WhatsApp.`)) return
    try { await api.painel.status(a.id, s); avisar(`${a.cliente}: ${ROTULO[s].toLowerCase()}`); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }

  const liberar = async (b: Bloqueio) => { try { await api.painel.desbloquear(b.id); carregar() } catch (e) { avisar((e as Error).message, 'erro') } }
  const ativos = agenda?.agendamentos.filter((a) => a.status !== 'cancelado') ?? []
  const cancelados = agenda?.agendamentos.filter((a) => a.status === 'cancelado') ?? []
  const ehHoje = data === dataIso(new Date())

  return (
    <div className="painel__grade">
      <section className="painel__col">
        <div className="seletor-dia">
          <button className="icone-botao" onClick={() => mudarDia(-1)} aria-label="Dia anterior"><Icone nome="voltar" /></button>
          <div className="centro">
            <strong className="capitalizar">{ehHoje ? 'Hoje' : dataLonga(data).split(',')[0]}</strong>
            <span className="suave pequeno">{dataLonga(data).split(', ')[1]}</span>
          </div>
          <button className="icone-botao" onClick={() => mudarDia(1)} aria-label="Próximo dia"><Icone nome="seta" /></button>
        </div>

        {resumo && (
          <div className="metricas">
            <div className="metrica"><span className="suave">Atendimentos</span><strong>{resumo.hoje.atendimentos}</strong></div>
            <div className="metrica"><span className="suave">Previsto no dia</span><strong>{moeda(resumo.hoje.previsto)}</strong></div>
            <div className="metrica"><span className="suave">{usuario.papel === 'dono' ? 'Faturado no mês' : 'Seu faturamento no mês'}</span><strong>{moeda(resumo.mes.faturado)}</strong></div>
            <div className="metrica"><span className="suave">Faltas no mês</span><strong>{resumo.mes.faltas} <small className="suave">({pct(resumo.mes.taxaFalta)})</small></strong></div>
            <div className="metrica"><span className="suave">Marcados pelo app</span><strong>{pct(resumo.mes.percentualApp)}</strong></div>
            <div className="metrica"><span className="suave">Concluídos no mês</span><strong>{resumo.mes.concluidos}</strong></div>
          </div>
        )}

        {barbearia && barbearia.profissionais.length > 1 && (
          <div className="filtros">
            <button className={filtro === 'todos' ? 'ativo' : ''} onClick={() => setFiltro('todos')}>Agenda da casa</button>
            {barbearia.profissionais.map((p) => (
              <button key={p.id} className={`filtro-foto ${filtro === p.id ? 'ativo' : ''}`} onClick={() => setFiltro(p.id)}>
                {p.foto && <img src={foto(p.foto, 'avatar')} alt="" />}{primeiroNome(p.nome)}
              </button>
            ))}
          </div>
        )}

        <div className="acoes">
          <button className="botao botao--fantasma pequeno" onClick={() => setForm(form === 'encaixe' ? null : 'encaixe')}><Icone nome="mais" tam={18} /> Encaixe</button>
          <button className="botao botao--fantasma pequeno" onClick={() => setForm(form === 'bloqueio' ? null : 'bloqueio')}><Icone nome="relogio" tam={18} /> Bloquear horário</button>
        </div>
        {form === 'encaixe' && <FormEncaixe data={data} usuario={usuario} aoSalvar={() => { setForm(null); carregar() }} />}
        {form === 'bloqueio' && <FormBloqueio data={data} usuario={usuario} aoSalvar={() => { setForm(null); carregar() }} />}

        {!agenda && <div className="cartao cartao--esqueleto" />}
        {agenda && !ativos.length && !agenda.bloqueios.length && <p className="vazio">Nenhum horário marcado neste dia.</p>}
        {agenda && (ativos.length > 0 || agenda.bloqueios.length > 0) && (
          filtro === 'todos' && barbearia && barbearia.profissionais.length > 1 ? (
            <div className="agenda-colunas">
              {barbearia.profissionais.map((p) => (
                <Coluna key={p.id} prof={p}
                  itens={ativos.filter((a) => a.profissionalId === p.id)}
                  bloqueios={agenda.bloqueios.filter((b) => b.profissionalId === p.id)}
                  marcar={marcar} liberar={liberar} />
              ))}
            </div>
          ) : <LinhaTempo itens={ativos} bloqueios={agenda.bloqueios} marcar={marcar} liberar={liberar} mostrarProf />
        )}
        {cancelados.length > 0 && <p className="suave pequeno">{cancelados.length} cancelado(s) neste dia</p>}
      </section>

      {resumo && usuario.papel === 'dono' && (
        <aside className="painel__col">
          <h2 className="secao">Clientes para chamar de volta</h2>
          <p className="suave pequeno">Há 20+ dias sem cortar e sem horário marcado. O app manda o lembrete sozinho.</p>
          <div className="lista">
            {resumo.retorno.length === 0 && <p className="vazio">Ninguém sumido. 👏</p>}
            {resumo.retorno.map((r) => (
              <a key={r.id} className="item" href={linkWhats(r.telefone, `Fala, ${r.nome.split(' ')[0]}! Bora marcar aquele corte na Roque?`)} target="_blank" rel="noreferrer">
                <div><strong>{r.nome}</strong><span className="suave">há {r.dias} dias</span></div>
                <span className={`badge ${r.avisado ? '' : 'badge--off'}`}>{r.avisado ? 'Lembrete enviado' : 'Na fila'}</span>
              </a>
            ))}
          </div>

          {resumo.porProfissional.length > 0 && (
            <>
              <h2 className="secao">Faturamento do mês por profissional</h2>
              <div className="barras">
                {resumo.porProfissional.map((p) => {
                  const max = Math.max(...resumo.porProfissional.map((x) => x.total))
                  return (
                    <div key={p.nome} className="barra-linha">
                      <span>{p.nome}</span>
                      <div className="barra"><div style={{ width: `${(p.total / max) * 100}%` }} /></div>
                      <strong>{moeda(p.total)}</strong>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {resumo.porServico.length > 0 && (
            <>
              <h2 className="secao">Mais vendidos no mês</h2>
              <div className="lista">
                {resumo.porServico.map((s, i) => (
                  <div key={s.nome} className="item item--estatico"><div><strong>{i + 1}. {s.nome}</strong></div><span className="suave">{s.n}×</span></div>
                ))}
              </div>
            </>
          )}
        </aside>
      )}
    </div>
  )
}

function FormEncaixe({ data, usuario, aoSalvar }: { data: string; usuario: UsuarioPainel; aoSalvar: () => void }) {
  const { barbearia, avisar } = useApp()
  const [f, setF] = useState({ nome: '', telefone: '', servicoId: barbearia?.servicos[0]?.id ?? '', profissionalId: usuario.profissionalId ?? barbearia?.profissionais[0]?.id ?? '', hora: '' })
  const [horas, setHoras] = useState<string[]>([])
  useEffect(() => { if (f.servicoId && f.profissionalId) api.horarios(data, f.servicoId, f.profissionalId).then(setHoras).catch(() => setHoras([])) }, [data, f.servicoId, f.profissionalId])
  const salvar = async () => {
    try { await api.painel.encaixe({ ...f, telefone: f.telefone || undefined, data }); avisar('Encaixe marcado'); aoSalvar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <section className="cartao form">
      <h3>Encaixe · {dataCurta(data)}</h3>
      <label className="campo"><span>Cliente</span><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome" /></label>
      <label className="campo"><span>WhatsApp (opcional)</span><input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} inputMode="tel" placeholder="(27) 9 9999-9999" /></label>
      <div className="campos-2">
        <label className="campo"><span>Serviço</span>
          <select value={f.servicoId} onChange={(e) => setF({ ...f, servicoId: e.target.value, hora: '' })}>{barbearia?.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        </label>
        <label className="campo"><span>Barbeiro</span>
          <select value={f.profissionalId} onChange={(e) => setF({ ...f, profissionalId: e.target.value, hora: '' })}>{barbearia?.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </label>
      </div>
      <div className="horas">{horas.map((h) => <button key={h} className={`hora ${f.hora === h ? 'hora--sel' : ''}`} onClick={() => setF({ ...f, hora: h })}>{h}</button>)}</div>
      {!horas.length && <p className="suave pequeno">Sem horários livres para esse serviço neste dia.</p>}
      <button className="botao botao--principal" disabled={f.nome.trim().length < 2 || !f.hora} onClick={salvar}>Marcar encaixe</button>
    </section>
  )
}

function FormBloqueio({ data, usuario, aoSalvar }: { data: string; usuario: UsuarioPainel; aoSalvar: () => void }) {
  const { barbearia, avisar } = useApp()
  const [f, setF] = useState({ profissionalId: usuario.profissionalId ?? 'todos', inicio: '12:00', fim: '13:00', motivo: '' })
  const salvar = async () => {
    try { await api.painel.bloquear({ ...f, data }); avisar('Horário bloqueado'); aoSalvar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <section className="cartao form">
      <h3>Bloquear horário · {dataCurta(data)}</h3>
      <label className="campo"><span>Barbeiro</span>
        <select value={f.profissionalId} onChange={(e) => setF({ ...f, profissionalId: e.target.value })}>
          <option value="todos">Todos (barbearia fechada)</option>
          {barbearia?.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <div className="campos-2">
        <label className="campo"><span>De</span><input type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></label>
        <label className="campo"><span>Até</span><input type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></label>
      </div>
      <label className="campo"><span>Motivo</span><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Folga, médico, curso…" /></label>
      <button className="botao botao--principal" onClick={salvar}>Bloquear</button>
    </section>
  )
}

function AbaClientes() {
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<ClientePainel[] | null>(null)
  useEffect(() => { const t = setTimeout(() => api.painel.clientes(busca).then(setLista).catch(() => setLista([])), 250); return () => clearTimeout(t) }, [busca])
  return (
    <div className="painel__col">
      <label className="campo"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" /></label>
      <p className="suave pequeno">{lista?.length ?? '…'} clientes</p>
      <div className="lista">
        {lista?.map((c) => (
          <a key={c.id} className="item" href={linkWhats(c.telefone)} target="_blank" rel="noreferrer">
            <div>
              <strong>{c.nome}</strong>
              <span className="suave">{formatarTelefone(c.telefone)} · {c.visitas} visitas{c.faltas ? ` · ${c.faltas} falta(s)` : ''}</span>
            </div>
            <span className="suave pequeno">{c.ultimaVisita ? `última ${dataCurta(c.ultimaVisita)}` : 'novo'}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

const TIPO: Record<string, string> = { codigo: 'Código de acesso', confirmacao: 'Confirmação', lembrete_24h: 'Lembrete 24h', lembrete_1h: 'Lembrete 1h', cancelamento: 'Cancelamento', retorno: 'Volte a cortar' }

function AbaWhatsApp() {
  const { barbearia } = useApp()
  const [lista, setLista] = useState<Mensagem[] | null>(null)
  useEffect(() => {
    const f = () => api.painel.mensagens().then(setLista).catch(() => setLista([]))
    f(); const t = setInterval(f, 10000); return () => clearInterval(t)
  }, [])
  const demo = barbearia?.whatsappModo === 'demo' || barbearia?.whatsappModo === 'offline'
  return (
    <div className="painel__col">
      <p className="suave pequeno">
        {demo ? 'Modo demonstração: as mensagens abaixo seriam enviadas pelo WhatsApp da barbearia. Ao conectar o WhatsApp, elas saem de verdade.'
          : 'Mensagens enviadas automaticamente pelo WhatsApp da barbearia.'}
      </p>
      {lista && !lista.length && <p className="vazio">Nenhuma mensagem ainda.</p>}
      <div className="mensagens">
        {lista?.map((m) => (
          <div key={m.id} className="mensagem">
            <div className="linha-entre">
              <span className="badge">{TIPO[m.tipo] ?? m.tipo}</span>
              <span className="suave pequeno">{dataCurta(m.criadoEm)} {hora(m.criadoEm)} · {formatarTelefone(m.telefone)}</span>
            </div>
            <p className="mensagem__texto">{m.tipo === 'codigo' ? m.texto.replace(/\*(\d{6})\*/, '*••••••*') : m.texto}</p>
            {m.status === 'erro' && <p className="pequeno erro">Falhou: {m.erro}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

type Marcar = (a: ItemAgenda, s: Status) => void

/** Uma coluna por barbeiro: a agenda conjunta da casa, lado a lado */
function Coluna({ prof, itens, bloqueios, marcar, liberar }: { prof: Profissional; itens: ItemAgenda[]; bloqueios: Bloqueio[]; marcar: Marcar; liberar: (b: Bloqueio) => void }) {
  const total = itens.filter((a) => a.status !== 'faltou').reduce((t, a) => t + a.preco, 0)
  return (
    <div className="coluna">
      <header className="coluna__topo">
        {prof.foto ? <img src={foto(prof.foto, 'avatar')} alt="" /> : <div className="avatar avatar--p">{prof.nome[0]}</div>}
        <div><strong>{prof.nome}</strong><span className="suave pequeno">{itens.length} {itens.length === 1 ? 'horário' : 'horários'} · {moeda(total)}</span></div>
      </header>
      {itens.length || bloqueios.length
        ? <LinhaTempo itens={itens} bloqueios={bloqueios} marcar={marcar} liberar={liberar} />
        : <p className="vazio pequeno">Agenda livre</p>}
    </div>
  )
}

function LinhaTempo({ itens, bloqueios, marcar, liberar, mostrarProf }: { itens: ItemAgenda[]; bloqueios: Bloqueio[]; marcar: Marcar; liberar: (b: Bloqueio) => void; mostrarProf?: boolean }) {
  return (
    <div className="linha-tempo">
      {[...itens.map((a) => ({ t: a.inicio, a })), ...bloqueios.map((b) => ({ t: b.inicio, b }))]
        .sort((x, y) => x.t.localeCompare(y.t))
        .map((x) => 'a' in x ? (
          <div key={x.a.id} className={`evento evento--${x.a.status}`}>
            <span className="evento__hora">{hora(x.a.inicio)}<small>{hora(x.a.fim)}</small></span>
            <div className="evento__corpo">
              <strong>{x.a.cliente} {x.a.visitas === 0 && <span className="badge">1ª vez</span>}</strong>
              <span className="suave">{x.a.servico}{mostrarProf ? ` · ${primeiroNome(x.a.profissional)}` : ''} · {moeda(x.a.preco)} · {x.a.origem === 'balcao' ? 'balcão' : 'app'}</span>
              <div className="evento__acoes">
                {x.a.status === 'confirmado' ? (
                  <>
                    <button className="chip chip--ok" onClick={() => marcar(x.a, 'concluido')}>✓ Concluído</button>
                    <button className="chip" onClick={() => marcar(x.a, 'faltou')}>Faltou</button>
                    <button className="chip" onClick={() => marcar(x.a, 'cancelado')}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span className={`badge ${x.a.status === 'concluido' ? '' : 'badge--off'}`}>{ROTULO[x.a.status]}</span>
                    <button className="chip" onClick={() => marcar(x.a, 'confirmado')}>Desfazer</button>
                  </>
                )}
                {!x.a.telefone.startsWith('balcao') && <a className="chip" href={linkWhats(x.a.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>}
              </div>
            </div>
          </div>
        ) : (
          <div key={x.b.id} className="evento evento--bloqueio">
            <span className="evento__hora">{hora(x.b.inicio)}<small>{hora(x.b.fim)}</small></span>
            <div className="evento__corpo">
              <strong>Bloqueado {x.b.motivo && `· ${x.b.motivo}`}</strong>
              {mostrarProf && <span className="suave">{x.b.profissional}</span>}
              <div className="evento__acoes"><button className="chip" onClick={() => liberar(x.b)}>Liberar</button></div>
            </div>
          </div>
        ))}
    </div>
  )
}
