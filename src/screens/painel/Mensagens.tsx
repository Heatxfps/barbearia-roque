/**
 * Mensagens do WhatsApp.
 * - Fluxo: um canvas por raia (Cliente, Loja, Equipe); cada cartão é uma mensagem (editar texto, tempo, ligar/desligar).
 *   Nas etapas "antes" e "depois" do atendimento dá para criar mensagens automáticas novas.
 * - Enviadas / Falharam: histórico. (A situação de cada lembrete por cliente fica em Clientes.)
 * A equipe toda vê; só o dono edita.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type Automacao, type Mensagem, type ModeloMsg, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, formatarTelefone, hora } from '../../util'
import { GATILHOS, VARIAVEIS, VARIAVEIS_AUTOMACAO, exemplo, type Gatilho, type Grupo, type Raia } from '../../../shared/modelos'

type Aba = 'fluxo' | 'enviadas' | 'falharam'

export const TIPO: Record<string, string> = {
  codigo: 'Código de acesso', codigo_painel: 'Código do painel', confirmacao: 'Confirmação', lembrete_24h: 'Lembrete da véspera', lembrete_1h: 'Lembrete em cima da hora',
  cancelamento: 'Cancelamento', retorno: 'Volte a cortar', avaliacao: 'Avaliação', aniversario: 'Aniversário', espera: 'Lista de espera',
  pedido: 'Pedido', pedido_separado: 'Pedido separado', aviso_novo: 'Aviso: novo horário', aviso_cancelou: 'Aviso: cancelamento', aviso_pedido: 'Aviso: pedido',
  automacao: 'Automação', cancelamento_casa: 'Barbearia desmarcou', adiantar: 'Pode adiantar', faltou: 'Sentimos sua falta',
  cupom_vencendo: 'Cupom vencendo', pedido_parado: 'Lembrete de retirada', aviso_adiantou: 'Aviso: adiantou', aviso_avaliacao: 'Aviso: avaliação baixa',
  lembrete_manual: 'Lembrete (manual)',
}

export default function Mensagens({ usuario }: { usuario: UsuarioPainel }) {
  const [aba, setAba] = useState<Aba>('fluxo')
  const abas: [Aba, string][] = [['fluxo', 'Fluxo'], ['enviadas', 'Enviadas'], ['falharam', 'Falharam']]
  return (
    <div className="painel__col">
      <div className="filtros">
        {abas.map(([id, rot]) => <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>{rot}</button>)}
      </div>
      {aba === 'fluxo' && <Fluxo dono={usuario.papel === 'dono'} />}
      {(aba === 'enviadas' || aba === 'falharam') && <Historico status={aba} />}
    </div>
  )
}

/* ====================== FLUXO (canvas em raias) ====================== */
type No =
  | { tipo: 'modelo'; m: ModeloMsg }
  | { tipo: 'auto'; a: Automacao }

type Etapa = { id: string; titulo: string; sub: string; grupo?: Grupo; chaves?: string[]; criar?: Gatilho[]; centro?: boolean }
type DefRaia = { id: Raia; titulo: string; icone: 'perfil' | 'sacola' | 'whats'; sub: string; quem: string; etapas: Etapa[]; sequencia: boolean }

const RAIAS: DefRaia[] = [
  {
    id: 'cliente', titulo: 'Cliente', icone: 'perfil', sequencia: true, quem: 'vai para o WhatsApp do cliente',
    sub: 'A jornada de quem corta: da marcação até a próxima visita.',
    etapas: [
      { id: 'marcou', grupo: 'marcou', titulo: 'Marcou', sub: 'na hora em que acontece' },
      { id: 'antes', grupo: 'antes', titulo: 'Antes do horário', sub: 'lembretes', criar: ['antes_horario'] },
      { id: 'no_dia', grupo: 'no_dia', titulo: 'No dia', sub: 'fila e imprevistos' },
      { id: 'cadeira', titulo: 'Na cadeira', sub: 'o barbeiro marca "concluído"', centro: true },
      { id: 'depois', grupo: 'depois', titulo: 'Depois', sub: 'relacionamento', criar: ['depois_atendimento', 'dias_depois', 'primeira_visita'] },
      { id: 'voltar', grupo: 'voltar', titulo: 'Para voltar', sub: 'saudade e datas especiais' },
    ],
  },
  {
    id: 'loja', titulo: 'Loja', icone: 'sacola', sequencia: true, quem: 'vai para o WhatsApp do cliente',
    sub: 'Pedidos de produtos com retirada na barbearia.',
    etapas: [
      { id: 'pedido', chaves: ['pedido'], titulo: 'Pediu', sub: 'reservou no app' },
      { id: 'separado', chaves: ['pedido_separado'], titulo: 'Separado', sub: 'a equipe marca no painel' },
      { id: 'parado', chaves: ['pedido_parado'], titulo: 'Não retirou', sub: 'lembrete' },
    ],
  },
  {
    id: 'equipe', titulo: 'Equipe', icone: 'whats', sequencia: false, quem: 'vai para o WhatsApp da barbearia',
    sub: 'Avisos para quem está no balcão, sem precisar abrir o painel.',
    etapas: [
      { id: 'agenda', chaves: ['aviso_novo', 'aviso_cancelou', 'aviso_adiantou'], titulo: 'Agenda', sub: 'mudou algo pelo app' },
      { id: 'loja', chaves: ['aviso_pedido'], titulo: 'Loja', sub: 'pedido para separar' },
      { id: 'avaliacoes', chaves: ['aviso_avaliacao'], titulo: 'Avaliações', sub: 'cliente insatisfeito' },
    ],
  },
]

function minutosDe(n: No): number {
  const em = (v: number, u: string) => (u === 'dias' ? v * 1440 : u === 'minutos' ? v : v * 60)
  if (n.tipo === 'auto') { const g = GATILHOS[n.a.gatilho]; return em(n.a.valor, g.unidade) }
  const t = n.m.tempo
  return t ? em(n.m.valor ?? t.padrao, t.unidade) : 0
}

function Fluxo({ dono }: { dono: boolean }) {
  const { avisar } = useApp()
  const [modelos, setModelos] = useState<ModeloMsg[] | null>(null)
  const [autos, setAutos] = useState<Automacao[]>([])
  const [raia, setRaia] = useState<Raia>('cliente')
  const [aberto, setAberto] = useState<No | { tipo: 'nova'; gatilho: Gatilho } | null>(null)

  const carregar = useCallback(() => {
    api.painel.modelos().then(setModelos).catch((e) => avisar(e.message, 'erro'))
    api.painel.automacoes().then(setAutos).catch(() => setAutos([]))
  }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  // nós de cada etapa de cada raia
  const nos = useMemo(() => {
    const mapa: Record<string, No[]> = {}
    for (const r of RAIAS) for (const e of r.etapas) {
      const lista: No[] = (modelos ?? []).filter((m) => (e.chaves ? e.chaves.includes(m.chave) : m.grupo === e.grupo)).map((m) => ({ tipo: 'modelo', m }))
      if (e.grupo) for (const a of autos) if (GATILHOS[a.gatilho].grupo === e.grupo) lista.push({ tipo: 'auto', a })
      // antes: do mais cedo para o mais perto; depois: do mais perto para o mais longe
      if (e.grupo === 'antes') lista.sort((x, y) => minutosDe(y) - minutosDe(x))
      if (e.grupo === 'depois') lista.sort((x, y) => minutosDe(x) - minutosDe(y))
      mapa[`${r.id}:${e.id}`] = lista
    }
    return mapa
  }, [modelos, autos])

  if (!modelos) return <div className="cartao cartao--esqueleto" />

  const contar = (r: DefRaia) => {
    const todos = r.etapas.flatMap((e) => nos[`${r.id}:${e.id}`] ?? [])
    return { total: todos.length, ligadas: todos.filter((n) => (n.tipo === 'modelo' ? n.m.ativo : n.a.ativo)).length }
  }
  const atual = RAIAS.find((r) => r.id === raia)!
  const n = contar(atual)

  return (
    <>
      <div className="raias-seletor" role="tablist" aria-label="Para quem vai">
        {RAIAS.map((r) => {
          const c = contar(r)
          return (
            <button key={r.id} role="tab" aria-selected={raia === r.id} className={`raia-botao ${raia === r.id ? 'ativo' : ''}`} onClick={() => setRaia(r.id)}>
              <Icone nome={r.icone} tam={18} />
              <span><strong>{r.titulo}</strong><small>{c.ligadas} de {c.total} ligadas</small></span>
            </button>
          )
        })}
      </div>

      <section className={`raia raia--${atual.id}`} aria-label={atual.titulo}>
        <header className="raia__cabeca">
          <div>
            <h2 className="titulo-editorial pequeno-ed">{atual.titulo}</h2>
            <p className="suave pequeno">{atual.sub} Toque numa mensagem para {dono ? 'editar o texto, o tempo ou desligar' : 'ver o texto'}.</p>
          </div>
          <div className="raia__legenda">
            <span className="badge badge--off"><Icone nome="whats" tam={13} /> {atual.quem}</span>
            <span className="suave pequeno">{n.ligadas}/{n.total} ligadas</span>
          </div>
        </header>
        <div className={`fluxo ${atual.sequencia ? '' : 'fluxo--solto'}`} role="list">
          {atual.etapas.map((e, i) => (
            <section key={e.id} className={`fluxo__etapa ${e.centro ? 'fluxo__etapa--centro' : ''}`} role="listitem">
              <header className="fluxo__cabeca">
                <span className="fluxo__num">{atual.sequencia ? i + 1 : <Icone nome="whats" tam={14} />}</span>
                <div><strong>{e.titulo}</strong><span className="suave pequeno">{e.sub}</span></div>
              </header>
              {e.centro ? (
                <div className="fluxo__atendimento"><Icone nome="tesoura" tam={28} /><span>Cliente na cadeira</span></div>
              ) : (
                <div className="fluxo__nos">
                  {(nos[`${atual.id}:${e.id}`] ?? []).map((no) => <CartaoNo key={no.tipo === 'modelo' ? no.m.chave : no.a.id} no={no} abrir={() => setAberto(no)} />)}
                  {dono && e.criar && (
                    <button className="fluxo__novo" onClick={() => setAberto({ tipo: 'nova', gatilho: e.criar![0] })}><Icone nome="mais" tam={16} /> Nova mensagem</button>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      </section>

      {aberto && (aberto.tipo === 'modelo'
        ? <EditorModelo m={aberto.m} dono={dono} fechar={() => setAberto(null)} salvo={() => { setAberto(null); carregar() }} />
        : <EditorAutomacao inicial={aberto.tipo === 'auto' ? aberto.a : null} gatilhoInicial={aberto.tipo === 'nova' ? aberto.gatilho : aberto.a.gatilho} dono={dono}
            fechar={() => setAberto(null)} salvo={() => { setAberto(null); carregar() }} />)}
    </>
  )
}

const unidadeCurta = (v: number, u: string) => (u === 'dias' ? (v === 1 ? 'dia' : 'dias') : u === 'minutos' ? 'min' : 'h')

function rotuloTempo(n: No) {
  if (n.tipo === 'auto') { const g = GATILHOS[n.a.gatilho]; return `${n.a.valor} ${unidadeCurta(n.a.valor, g.unidade)} ${g.rotulo.replace(/^dias /, '')}` }
  const t = n.m.tempo
  if (!t) return 'na hora'
  const v = n.m.valor ?? t.padrao
  return `${v} ${unidadeCurta(v, t.unidade)} ${t.rotulo}`
}

function CartaoNo({ no, abrir }: { no: No; abrir: () => void }) {
  const ativo = no.tipo === 'modelo' ? no.m.ativo : no.a.ativo
  const nome = no.tipo === 'modelo' ? no.m.nome : no.a.nome
  const texto = no.tipo === 'modelo' ? no.m.texto : no.a.texto
  const nova = no.tipo === 'modelo' && NOVAS.has(no.m.chave)
  return (
    <button className={`fluxo__no ${ativo ? '' : 'fluxo__no--off'} ${no.tipo === 'auto' ? 'fluxo__no--auto' : ''}`} onClick={abrir}>
      <span className="fluxo__no-topo">
        <span className={`fluxo__ponto ${ativo ? 'on' : ''}`} aria-label={ativo ? 'ligada' : 'desligada'} />
        <strong>{nome}</strong>
      </span>
      <span className="fluxo__tempo">{rotuloTempo(no)}</span>
      <span className="fluxo__trecho">{exemplo(texto).split('\n')[0]}</span>
      <span className="fluxo__tags">
        {nova && <span className="badge">nova</span>}
        {no.tipo === 'auto' && <span className="badge">criada por você</span>}
        {no.tipo === 'modelo' && no.m.personalizado && <span className="badge">texto editado</span>}
        {!ativo && <span className="badge badge--off">desligada</span>}
      </span>
    </button>
  )
}

/** mensagens que chegaram nesta versão (selo "nova" no fluxo) */
const NOVAS = new Set(['adiantar', 'faltou', 'cancelamento_casa', 'cupom_vencendo', 'pedido_parado', 'aviso_adiantou', 'aviso_avaliacao'])

/* ---------- editor de texto com variáveis e pré-visualização ---------- */
function EditorTexto({ texto, mudar, variaveis, travado }: { texto: string; mudar: (t: string) => void; variaveis: string[]; travado: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const inserir = (v: string) => {
    const el = ref.current
    const tag = `{${v}}`
    if (!el) return mudar(texto + tag)
    const i = el.selectionStart ?? texto.length, f = el.selectionEnd ?? texto.length
    mudar(texto.slice(0, i) + tag + texto.slice(f))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(i + tag.length, i + tag.length) })
  }
  return (
    <>
      <label className="campo"><span>Texto (use *asteriscos* para negrito no WhatsApp)</span>
        <textarea ref={ref} rows={6} value={texto} onChange={(e) => mudar(e.target.value.slice(0, 1000))} disabled={travado} />
      </label>
      {!travado && (
        <div className="variaveis">
          <span className="suave pequeno">Inserir:</span>
          {variaveis.map((v) => <button key={v} type="button" className="chip" title={VARIAVEIS[v]?.rotulo} onClick={() => inserir(v)}>{VARIAVEIS[v]?.rotulo ?? v}</button>)}
        </div>
      )}
      <div className="previa">
        <span className="suave pequeno">Como o cliente vê (exemplo)</span>
        <p className="mensagem__texto">{exemplo(texto).replace(/\*/g, '')}</p>
      </div>
    </>
  )
}

function EditorModelo({ m, dono, fechar, salvo }: { m: ModeloMsg; dono: boolean; fechar: () => void; salvo: () => void }) {
  const { avisar, confirmar } = useApp()
  const [texto, setTexto] = useState(m.texto)
  const [ativo, setAtivo] = useState(m.ativo)
  const [valor, setValor] = useState(m.valor ?? m.tempo?.padrao ?? 0)
  const salvar = async () => {
    try { await api.painel.salvarModelo(m.chave, { texto, ativo, valor: m.tempo ? valor : null }); avisar('Mensagem salva'); salvo() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const restaurar = async () => {
    if (!(await confirmar('Voltar ao texto original desta mensagem?', { botao: 'Restaurar', perigo: false }))) return
    try { await api.painel.salvarModelo(m.chave, { texto: null }); avisar('Texto original restaurado'); salvo() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <Gaveta titulo={m.nome} fechar={fechar}>
      <p className="suave pequeno">{m.descricao}</p>
      <label className="check"><input type="checkbox" checked={ativo} disabled={!dono} onChange={(e) => setAtivo(e.target.checked)} /> Mensagem ligada</label>
      {m.tempo && (
        <label className="campo"><span>Quando enviar</span>
          <div className="tempo-campo">
            <input type="number" min={m.tempo.min} max={m.tempo.max} value={valor} disabled={!dono} onChange={(e) => setValor(Number(e.target.value))} />
            <span>{m.tempo.unidade} {m.tempo.rotulo}</span>
          </div>
        </label>
      )}
      <EditorTexto texto={texto} mudar={setTexto} variaveis={m.variaveis} travado={!dono} />
      {dono ? (
        <div className="acoes">
          <button className="botao botao--principal pequeno" disabled={texto.trim().length < 5 || (!!m.tempo && (valor < m.tempo.min || valor > m.tempo.max))} onClick={salvar}>Salvar</button>
          <button className="botao botao--fantasma pequeno" onClick={fechar}>Cancelar</button>
          {(m.personalizado || texto !== m.padrao) && <button className="botao botao--fantasma pequeno acoes__direita" onClick={restaurar}>Restaurar original</button>}
        </div>
      ) : <p className="suave pequeno">Só o dono pode editar as mensagens.</p>}
    </Gaveta>
  )
}

function EditorAutomacao({ inicial, gatilhoInicial, dono, fechar, salvo }: { inicial: Automacao | null; gatilhoInicial: Gatilho; dono: boolean; fechar: () => void; salvo: () => void }) {
  const { avisar, confirmar } = useApp()
  const [a, setA] = useState<Omit<Automacao, 'id'>>(inicial ?? { nome: '', gatilho: gatilhoInicial, valor: GATILHOS[gatilhoInicial].padrao, texto: 'Oi, {nome}! ', ativo: true })
  const g = GATILHOS[a.gatilho]
  const ok = a.nome.trim().length >= 2 && a.texto.trim().length >= 5 && a.valor >= g.min && a.valor <= g.max
  const salvar = async () => {
    try { await api.painel.salvarAutomacao(inicial?.id ?? null, a); avisar(inicial ? 'Automação salva' : 'Mensagem automática criada. Ela vale daqui para a frente.'); salvo() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const excluir = async () => {
    if (!inicial || !(await confirmar(`Excluir a mensagem "${inicial.nome}"?`, { botao: 'Excluir' }))) return
    try { await api.painel.removerAutomacao(inicial.id); avisar('Mensagem excluída'); salvo() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <Gaveta titulo={inicial ? inicial.nome : 'Nova mensagem automática'} fechar={fechar}>
      <label className="campo"><span>Nome (só para vocês)</span><input value={a.nome} disabled={!dono} onChange={(e) => setA({ ...a, nome: e.target.value })} placeholder="Ex.: Dica de cuidado com a barba" /></label>
      <label className="campo"><span>Quando enviar</span>
        <div className="tempo-campo">
          <input type="number" min={g.min} max={g.max} value={a.valor} disabled={!dono} onChange={(e) => setA({ ...a, valor: Number(e.target.value) })} />
          <select value={a.gatilho} disabled={!dono} onChange={(e) => { const ng = e.target.value as Gatilho; setA({ ...a, gatilho: ng, valor: GATILHOS[ng].padrao }) }}>
            {(Object.keys(GATILHOS) as Gatilho[]).map((k) => <option key={k} value={k}>{GATILHOS[k].unidade} {GATILHOS[k].rotulo}</option>)}
          </select>
        </div>
      </label>
      <p className="suave pequeno">{g.dica} Vai uma vez por atendimento{a.gatilho === 'antes_horario' ? '' : ', das 8h às 21h'}.</p>
      <label className="check"><input type="checkbox" checked={a.ativo} disabled={!dono} onChange={(e) => setA({ ...a, ativo: e.target.checked })} /> Mensagem ligada</label>
      <EditorTexto texto={a.texto} mudar={(texto) => setA({ ...a, texto })} variaveis={VARIAVEIS_AUTOMACAO} travado={!dono} />
      {dono && (
        <div className="acoes">
          <button className="botao botao--principal pequeno" disabled={!ok} onClick={salvar}>{inicial ? 'Salvar' : 'Criar mensagem'}</button>
          <button className="botao botao--fantasma pequeno" onClick={fechar}>Cancelar</button>
          {inicial && <button className="botao botao--perigo pequeno acoes__direita" onClick={excluir}><Icone nome="lixo" tam={16} /> Excluir</button>}
        </div>
      )}
    </Gaveta>
  )
}

function Gaveta({ titulo, fechar, children }: { titulo: string; fechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && fechar()
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc)
  }, [fechar])
  return (
    <div className="confirmar gaveta-fundo" role="presentation" onClick={fechar}>
      <aside className="gaveta" role="dialog" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header className="linha-entre"><h2 className="titulo-editorial pequeno-ed">{titulo}</h2><button className="icone-botao" onClick={fechar} aria-label="Fechar">✕</button></header>
        {children}
      </aside>
    </div>
  )
}

/* ====================== HISTÓRICO ====================== */
function Historico({ status }: { status: 'enviadas' | 'falharam' }) {
  const { barbearia } = useApp()
  const [lista, setLista] = useState<Mensagem[] | null>(null)
  useEffect(() => {
    setLista(null)
    const f = () => api.painel.mensagens(status).then(setLista).catch(() => setLista([]))
    f(); const t = setInterval(f, 15000); return () => clearInterval(t)
  }, [status])
  const demo = barbearia?.whatsappModo === 'demo' || barbearia?.whatsappModo === 'offline'
  return (
    <>
      {status === 'enviadas' && <p className="suave pequeno">{demo ? 'Modo demonstração: as mensagens abaixo seriam enviadas pelo WhatsApp da barbearia. Ao conectar o WhatsApp, elas saem de verdade.' : 'Mensagens enviadas automaticamente pelo WhatsApp da barbearia.'}</p>}
      {status === 'falharam' && <p className="suave pequeno">Mensagens que o WhatsApp não conseguiu entregar (número errado, WhatsApp desconectado…).</p>}
      {lista && !lista.length && <p className="vazio">{status === 'falharam' ? 'Nenhuma falha. 👌' : 'Nenhuma mensagem ainda.'}</p>}
      <div className="mensagens mensagens--grade">
        {lista?.map((m) => (
          <div key={m.id} className={`mensagem ${m.status === 'erro' ? 'mensagem--erro' : ''}`}>
            <div className="linha-entre">
              <span className="badge">{TIPO[m.tipo] ?? m.tipo}</span>
              <span className="suave pequeno">{dataCurta(m.criadoEm)} {hora(m.criadoEm)} · {formatarTelefone(m.telefone)}</span>
            </div>
            <p className="mensagem__texto">{m.tipo.startsWith('codigo') ? m.texto.replace(/\*(\d{6})\*/, '*••••••*') : m.texto}</p>
            {m.status === 'erro' && <p className="pequeno erro">Falhou: {m.erro}</p>}
          </div>
        ))}
      </div>
    </>
  )
}
