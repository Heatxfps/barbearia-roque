/**
 * Mensagens do WhatsApp.
 * - Fluxo: a jornada do cliente como um canvas; cada cartão é uma mensagem (editar texto, tempo, ligar/desligar).
 *   Nas etapas "antes" e "depois" do atendimento dá para criar mensagens automáticas novas.
 * - Próximas: o que o app vai mandar nos próximos 7 dias.
 * - Enviadas / Falharam: histórico.
 * A equipe toda vê; só o dono edita.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type Automacao, type ItemFila, type Mensagem, type ModeloMsg, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, dataLonga, formatarTelefone, hora } from '../../util'
import { GATILHOS, VARIAVEIS, VARIAVEIS_AUTOMACAO, exemplo, type Gatilho } from '../../../shared/modelos'

type Aba = 'fluxo' | 'proximas' | 'enviadas' | 'falharam'

export const TIPO: Record<string, string> = {
  codigo: 'Código de acesso', codigo_painel: 'Código do painel', confirmacao: 'Confirmação', lembrete_24h: 'Lembrete da véspera', lembrete_1h: 'Lembrete em cima da hora',
  cancelamento: 'Cancelamento', retorno: 'Volte a cortar', avaliacao: 'Avaliação', aniversario: 'Aniversário', espera: 'Lista de espera',
  pedido: 'Pedido', pedido_separado: 'Pedido separado', aviso_novo: 'Aviso: novo horário', aviso_cancelou: 'Aviso: cancelamento', aviso_pedido: 'Aviso: pedido',
  automacao: 'Automação',
}

export default function Mensagens({ usuario }: { usuario: UsuarioPainel }) {
  const [aba, setAba] = useState<Aba>('fluxo')
  const abas: [Aba, string][] = [['fluxo', 'Fluxo'], ['proximas', 'Próximas'], ['enviadas', 'Enviadas'], ['falharam', 'Falharam']]
  return (
    <div className="painel__col">
      <div className="filtros">
        {abas.map(([id, rot]) => <button key={id} className={aba === id ? 'ativo' : ''} onClick={() => setAba(id)}>{rot}</button>)}
      </div>
      {aba === 'fluxo' && <Fluxo dono={usuario.papel === 'dono'} />}
      {aba === 'proximas' && <Proximas />}
      {(aba === 'enviadas' || aba === 'falharam') && <Historico status={aba} />}
    </div>
  )
}

/* ====================== FLUXO (canvas) ====================== */
type No =
  | { tipo: 'modelo'; m: ModeloMsg }
  | { tipo: 'auto'; a: Automacao }

const ETAPAS: { id: string; titulo: string; sub: string; criar?: Gatilho[] }[] = [
  { id: 'agendamento', titulo: 'Quando marca', sub: 'na hora' },
  { id: 'antes', titulo: 'Antes do horário', sub: 'lembretes', criar: ['antes_horario'] },
  { id: 'atendimento', titulo: 'Atendimento', sub: 'o barbeiro marca "concluído"' },
  { id: 'depois', titulo: 'Depois do atendimento', sub: 'relacionamento', criar: ['depois_atendimento', 'dias_depois', 'primeira_visita'] },
  { id: 'especiais', titulo: 'Datas e avisos', sub: 'quando acontece' },
  { id: 'loja', titulo: 'Loja', sub: 'pedidos' },
]

function minutosDe(n: No): number {
  if (n.tipo === 'auto') { const g = GATILHOS[n.a.gatilho]; return (g.unidade === 'dias' ? n.a.valor * 1440 : n.a.valor * 60) }
  const t = n.m.tempo
  return t ? (t.unidade === 'dias' ? (n.m.valor ?? t.padrao) * 1440 : (n.m.valor ?? t.padrao) * 60) : 0
}

function Fluxo({ dono }: { dono: boolean }) {
  const { avisar } = useApp()
  const [modelos, setModelos] = useState<ModeloMsg[] | null>(null)
  const [autos, setAutos] = useState<Automacao[]>([])
  const [aberto, setAberto] = useState<No | { tipo: 'nova'; gatilho: Gatilho } | null>(null)

  const carregar = useCallback(() => {
    api.painel.modelos().then(setModelos).catch((e) => avisar(e.message, 'erro'))
    api.painel.automacoes().then(setAutos).catch(() => setAutos([]))
  }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  const porEtapa = useMemo(() => {
    const mapa: Record<string, No[]> = {}
    for (const m of modelos ?? []) {
      if (m.grupo === 'divulgacao') continue
      const etapa = m.grupo === 'barbearia' ? (m.chave === 'aviso_pedido' ? 'loja' : 'agendamento') : m.grupo
      ;(mapa[etapa] ??= []).push({ tipo: 'modelo', m })
    }
    for (const a of autos) (mapa[GATILHOS[a.gatilho].grupo] ??= []).push({ tipo: 'auto', a })
    // antes: do mais cedo para o mais perto; depois: do mais perto para o mais longe
    mapa.antes?.sort((x, y) => minutosDe(y) - minutosDe(x))
    mapa.depois?.sort((x, y) => minutosDe(x) - minutosDe(y))
    return mapa
  }, [modelos, autos])

  if (!modelos) return <div className="cartao cartao--esqueleto" />

  return (
    <>
      <p className="suave pequeno">A jornada do cliente, da marcação até a volta. Toque numa mensagem para {dono ? 'editar o texto, o tempo ou desligar' : 'ver o texto'}.</p>
      <div className="fluxo" role="list">
        {ETAPAS.map((e, i) => (
          <section key={e.id} className={`fluxo__etapa ${e.id === 'atendimento' ? 'fluxo__etapa--centro' : ''}`} role="listitem">
            <header className="fluxo__cabeca">
              <span className="fluxo__num">{i + 1}</span>
              <div><strong>{e.titulo}</strong><span className="suave pequeno">{e.sub}</span></div>
            </header>
            {e.id === 'atendimento' ? (
              <div className="fluxo__atendimento"><Icone nome="tesoura" tam={28} /><span>Cliente na cadeira</span></div>
            ) : (
              <div className="fluxo__nos">
                {(porEtapa[e.id] ?? []).map((n) => <CartaoNo key={n.tipo === 'modelo' ? n.m.chave : n.a.id} no={n} abrir={() => setAberto(n)} />)}
                {dono && e.criar && (
                  <button className="fluxo__novo" onClick={() => setAberto({ tipo: 'nova', gatilho: e.criar![0] })}><Icone nome="mais" tam={16} /> Nova mensagem</button>
                )}
              </div>
            )}
          </section>
        ))}
      </div>

      {aberto && (aberto.tipo === 'modelo'
        ? <EditorModelo m={aberto.m} dono={dono} fechar={() => setAberto(null)} salvo={() => { setAberto(null); carregar() }} />
        : <EditorAutomacao inicial={aberto.tipo === 'auto' ? aberto.a : null} gatilhoInicial={aberto.tipo === 'nova' ? aberto.gatilho : aberto.a.gatilho} dono={dono}
            fechar={() => setAberto(null)} salvo={() => { setAberto(null); carregar() }} />)}
    </>
  )
}

function rotuloTempo(n: No) {
  if (n.tipo === 'auto') { const g = GATILHOS[n.a.gatilho]; return `${n.a.valor} ${g.unidade === 'dias' ? (n.a.valor === 1 ? 'dia' : 'dias') : 'h'} ${g.rotulo.replace(/^dias /, '')}` }
  const t = n.m.tempo
  if (!t) return n.m.grupo === 'barbearia' ? 'para a barbearia' : 'na hora'
  const v = n.m.valor ?? t.padrao
  return `${v} ${t.unidade === 'dias' ? 'dias' : 'h'} ${t.rotulo}`
}

function CartaoNo({ no, abrir }: { no: No; abrir: () => void }) {
  const ativo = no.tipo === 'modelo' ? no.m.ativo : no.a.ativo
  const nome = no.tipo === 'modelo' ? no.m.nome : no.a.nome
  const texto = no.tipo === 'modelo' ? no.m.texto : no.a.texto
  const paraCasa = no.tipo === 'modelo' && no.m.grupo === 'barbearia'
  return (
    <button className={`fluxo__no ${ativo ? '' : 'fluxo__no--off'} ${no.tipo === 'auto' ? 'fluxo__no--auto' : ''}`} onClick={abrir}>
      <span className="fluxo__no-topo">
        <span className={`fluxo__ponto ${ativo ? 'on' : ''}`} aria-label={ativo ? 'ligada' : 'desligada'} />
        <strong>{nome}</strong>
      </span>
      <span className="fluxo__tempo">{rotuloTempo(no)}</span>
      <span className="fluxo__trecho">{exemplo(texto).split('\n')[0]}</span>
      <span className="fluxo__tags">
        {paraCasa && <span className="badge badge--off">equipe</span>}
        {no.tipo === 'auto' && <span className="badge">criada por você</span>}
        {no.tipo === 'modelo' && no.m.personalizado && <span className="badge">texto editado</span>}
        {!ativo && <span className="badge badge--off">desligada</span>}
      </span>
    </button>
  )
}

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

/* ====================== PRÓXIMAS ====================== */
function Proximas() {
  const [fila, setFila] = useState<ItemFila[] | null>(null)
  useEffect(() => { api.painel.fila().then(setFila).catch(() => setFila([])) }, [])
  if (!fila) return <div className="cartao cartao--esqueleto" />
  if (!fila.length) return <p className="vazio">Nada programado para os próximos 7 dias.</p>
  const dias = [...new Set(fila.map((f) => f.quando.slice(0, 10)))]
  return (
    <>
      <p className="suave pequeno">Previsão dos próximos 7 dias. Pode mudar se o cliente remarcar ou cancelar.</p>
      {dias.map((d) => (
        <section key={d} className="painel__col">
          <h2 className="secao capitalizar">{dataLonga(d)}</h2>
          <div className="lista">
            {fila.filter((f) => f.quando.startsWith(d)).map((f, i) => (
              <div key={i} className="item item--estatico fila-item">
                <span className="fila-item__hora">{hora(f.quando)}</span>
                <div><strong>{f.nome}</strong><span className="suave">{TIPO[f.tipo] ?? f.tipo} · {f.resumo}</span></div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
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
