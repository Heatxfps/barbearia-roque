/**
 * Clientes: busca, lembretes dos próximos horários, quem sumiu (chamar de volta) e aniversariantes.
 * Em cada lista aparece a situação da mensagem automática: enviada, programada, falhou, não vai ou desligada.
 */
import { useCallback, useEffect, useState } from 'react'
import { api, type Aniversariante, type ClientePainel, type EstadoMsg, type ItemLembrete, type Retorno } from '../../api'
import { useApp } from '../../contexto'
import Icone from '../../components/Icone'
import { aniversarioTxt, dataCurta, dataLonga, formatarTelefone, hora, linkWhats, primeiroNome } from '../../util'

type Vista = 'todos' | 'lembretes' | 'retorno' | 'aniversario'

export default function Clientes() {
  const { barbearia } = useApp()
  const [vista, setVista] = useState<Vista>('todos')
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<ClientePainel[] | null>(null)
  const [lembretes, setLembretes] = useState<ItemLembrete[] | null>(null)
  const [retorno, setRetorno] = useState<Retorno[] | null>(null)
  const [aniv, setAniv] = useState<Aniversariante[] | null>(null)

  useEffect(() => { const t = setTimeout(() => api.painel.clientes(busca).then(setLista).catch(() => setLista([])), 250); return () => clearTimeout(t) }, [busca])
  const carregarLembretes = useCallback(() => { api.painel.lembretes().then(setLembretes).catch(() => setLembretes([])) }, [])
  useEffect(() => {
    carregarLembretes()
    api.painel.retorno().then(setRetorno).catch(() => setRetorno([]))
    api.painel.aniversariantes().then(setAniv).catch(() => setAniv([]))
  }, [carregarLembretes])

  const casa = barbearia?.nome ?? 'Roque'
  const falhas = lembretes?.filter((l) => l.lembretes.some((x) => x.estado === 'falhou')).length ?? 0
  const vistas: [Vista, string, number | undefined][] = [
    ['todos', 'Todos', lista?.length],
    ['lembretes', 'Lembretes', lembretes?.length],
    ['retorno', 'Chamar de volta', retorno?.length],
    ['aniversario', 'Aniversariantes', aniv?.length],
  ]

  return (
    <div className="painel__col">
      <div className="filtros">
        {vistas.map(([id, rot, n]) => (
          <button key={id} className={vista === id ? 'ativo' : ''} onClick={() => setVista(id)}>
            {rot}{n ? ` (${n})` : ''}{id === 'lembretes' && falhas > 0 && <span className="ponto-alerta" aria-label={`${falhas} com falha`} />}
          </button>
        ))}
      </div>

      {vista === 'todos' && (
        <>
          <label className="campo"><input type="search" enterKeyHint="search" aria-label="Buscar cliente" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" /></label>
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
        </>
      )}

      {vista === 'lembretes' && <Lembretes lista={lembretes} recarregar={carregarLembretes} casa={casa} />}

      {vista === 'retorno' && (
        <>
          <p className="suave pequeno">Há um tempo sem cortar e sem horário marcado. O app manda o "volte a cortar" sozinho (das 10h às 19h); toque no cliente para chamar no WhatsApp com uma mensagem sua.</p>
          <div className="lista">
            {retorno?.length === 0 && <p className="vazio">Ninguém sumido. 👏</p>}
            {retorno?.map((r) => (
              <a key={r.id} className="item item--status" href={linkWhats(r.telefone, `Fala, ${primeiroNome(r.nome)}! Bora marcar aquele corte na ${casa}?`)} target="_blank" rel="noreferrer">
                <div>
                  <strong>{r.nome}</strong>
                  <span className="suave">há {r.dias} dias · última visita {dataCurta(r.ultimaVisita)}{r.barbeiro ? ` com ${primeiroNome(r.barbeiro)}` : ''}</span>
                </div>
                {r.estado ? <StatusMsg e={r.estado} /> : <span className={`badge ${r.avisado ? '' : 'badge--off'}`}>{r.avisado ? 'Enviada' : 'Programada'}</span>}
              </a>
            ))}
          </div>
        </>
      )}

      {vista === 'aniversario' && (
        <>
          <p className="suave pequeno">De 3 dias atrás até a próxima semana. No dia, às 9h, o cliente recebe o parabéns com o cupom de {barbearia?.descontoAniversario ?? 15}% no WhatsApp.</p>
          <div className="lista">
            {aniv?.length === 0 && <p className="vazio">Nenhum aniversário por agora.</p>}
            {aniv?.map((c) => (
              <a key={c.id} className="item item--status" href={linkWhats(c.telefone, `Feliz aniversário, ${primeiroNome(c.nome)}! 🎂 Um abraço de toda a equipe da ${casa}.`)} target="_blank" rel="noreferrer">
                <div>
                  <strong>🎂 {c.nome}</strong>
                  <span className="suave">{aniversarioTxt(c.aniversario)} · {c.emDias === 0 ? 'hoje' : c.emDias === 1 ? 'amanhã' : c.emDias === -1 ? 'ontem' : c.emDias < 0 ? `há ${-c.emDias} dias` : `em ${c.emDias} dias`}</span>
                </div>
                <div className="status-col">
                  {c.estado && <StatusMsg e={c.estado} />}
                  {c.cupom && <span className={`badge ${c.cupom.status === 'usado' ? '' : 'badge--off'}`}>{c.cupom.status === 'usado' ? 'Cupom usado ✓' : c.cupom.status === 'ativo' ? `Cupom até ${dataCurta(c.cupom.validoAte)}` : 'Cupom venceu'}</span>}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- lembretes dos próximos horários ---------- */
function Lembretes({ lista, recarregar, casa }: { lista: ItemLembrete[] | null; recarregar: () => void; casa: string }) {
  const { avisar } = useApp()
  const [enviando, setEnviando] = useState<string | null>(null)
  if (!lista) return <div className="cartao cartao--esqueleto" />
  if (!lista.length) return <p className="vazio">Nenhum horário marcado para os próximos 7 dias.</p>
  const dias = [...new Set(lista.map((l) => l.inicio.slice(0, 10)))]
  const lembrar = async (l: ItemLembrete) => {
    setEnviando(l.id)
    try { await api.painel.lembrar(l.id); avisar(`Lembrete enviado para ${primeiroNome(l.cliente)}`); recarregar() } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(null) }
  }
  return (
    <>
      <p className="suave pequeno">Os próximos 7 dias. O app lembra sozinho na véspera e em cima da hora; se uma mensagem falhar ou estiver desligada, dá para lembrar na hora.</p>
      {dias.map((d) => (
        <section key={d} className="painel__col">
          <h2 className="secao capitalizar">{dataLonga(d)}</h2>
          <div className="lembretes">
            {lista.filter((l) => l.inicio.startsWith(d)).map((l) => {
              const falhou = l.lembretes.some((x) => x.estado === 'falhou')
              return (
                <article key={l.id} className={`lembrete ${falhou ? 'lembrete--falhou' : ''}`}>
                  <div className="lembrete__topo">
                    <span className="lembrete__hora">{hora(l.inicio)}</span>
                    <div className="lembrete__quem">
                      <strong>{l.cliente}</strong>
                      <span className="suave pequeno">{l.servico} · {primeiroNome(l.profissional)}</span>
                    </div>
                    {l.adiantarPara && <span className="badge" title="Convite para vir mais cedo, aguardando resposta">⏩ convidado p/ {hora(l.adiantarPara)}</span>}
                  </div>
                  <ul className="lembrete__msgs">
                    {l.lembretes.map((x) => (
                      <li key={x.chave}><span className="suave pequeno">{x.nome}</span><StatusMsg e={x} /></li>
                    ))}
                    {l.manual && <li><span className="suave pequeno">Na mão</span><StatusMsg e={l.manual} /></li>}
                  </ul>
                  {!l.semWhatsapp && (
                    <div className="lembrete__acoes">
                      <button className="chip chip--ok" disabled={enviando === l.id} onClick={() => lembrar(l)}><Icone nome="whats" tam={14} /> {enviando === l.id ? 'Enviando…' : 'Lembrar agora'}</button>
                      <a className="chip" href={linkWhats(l.telefone, `Oi, ${primeiroNome(l.cliente)}! Passando para lembrar do seu horário na ${casa}: ${hora(l.inicio)}.`)} target="_blank" rel="noreferrer">Conversar</a>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </>
  )
}

/* ---------- selo de situação da mensagem ---------- */
function quandoTxt(c: string) {
  const d = c.slice(0, 10)
  const hoje = new Date(); const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  const amanha = new Date(hoje); amanha.setDate(hoje.getDate() + 1)
  const ontem = new Date(hoje); ontem.setDate(hoje.getDate() - 1)
  const dia = d === iso(hoje) ? 'hoje' : d === iso(amanha) ? 'amanhã' : d === iso(ontem) ? 'ontem' : dataCurta(c)
  return `${dia} ${hora(c)}`
}

export function StatusMsg({ e }: { e: EstadoMsg }) {
  switch (e.estado) {
    case 'enviada': return <span className="status-msg status-msg--ok" title={`Enviada ${quandoTxt(e.quando)}`}>✓ Enviada · {quandoTxt(e.quando)}</span>
    case 'falhou': return <span className="status-msg status-msg--erro" title={e.erro ?? ''}>! Falhou · {quandoTxt(e.quando)}</span>
    case 'programada': return <span className="status-msg status-msg--prog">◷ {quandoTxt(e.quando)}</span>
    case 'nao_vai': return <span className="status-msg" title={e.motivo}>— Não vai{e.motivo ? ` · ${e.motivo}` : ''}</span>
    case 'desligada': return <span className="status-msg">Desligada</span>
    case 'sem_whatsapp': return <span className="status-msg">Sem WhatsApp</span>
  }
}
