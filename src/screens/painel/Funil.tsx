/**
 * Funil de clientes (os 5 A's do Kotler): só para olhar, ninguém precisa mexer em nada.
 * Mostra ao vivo quem está no app, de onde as pessoas vêm, em que etapa param
 * e a retomada automática de quem parou no meio (a mensagem sai sozinha).
 */
import { useEffect, useState } from 'react'
import { api, type EstadoParado, type Funil as DadosFunil } from '../../api'
import { useApp } from '../../contexto'

const ORIGENS: Record<string, string> = {
  instagram: 'Instagram', qr: 'QR code do cartaz', whatsapp: 'WhatsApp', google: 'Google', indicacao: 'Indicação de cliente',
  facebook: 'Facebook', site: 'Outro site', direto: 'Direto (digitou ou salvou o app)',
}
export const nomeOrigem = (o: string) => ORIGENS[o] ?? o.replace(/-/g, ' ')

const ETAPA_AGORA = ['abriu o app', 'escolhendo o serviço', 'escolhendo o barbeiro', 'escolhendo o horário', 'confirmando']

const ESTADO: Record<EstadoParado, { rotulo: string; classe: string }> = {
  aguardando: { rotulo: 'Mensagem programada', classe: 'funil-estado--espera' },
  enviada: { rotulo: 'Mensagem enviada', classe: 'funil-estado--enviada' },
  recuperado: { rotulo: 'Recuperado ✓', classe: 'funil-estado--ok' },
  voltou_sozinho: { rotulo: 'Voltou sozinho ✓', classe: 'funil-estado--ok' },
  nao_voltou: { rotulo: 'Não voltou', classe: 'funil-estado--off' },
}

const PERIODOS: [number, string][] = [[1, 'Hoje'], [7, '7 dias'], [30, '30 dias']]

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
const hora = (c: string) => c.slice(11, 16)
const ha = (c: string, agora: string) => {
  const m = Math.max(0, Math.round((new Date(agora.replace(' ', 'T')).getTime() - new Date(c.replace(' ', 'T')).getTime()) / 60000))
  if (m < 1) return 'agora'
  if (m < 60) return `há ${m} min`
  if (m < 1440) return `há ${Math.floor(m / 60)} h`
  return `${c.slice(8, 10)}/${c.slice(5, 7)} ${hora(c)}`
}

/** Onde mais gente sai, com uma dica em linguagem simples */
function ondeMelhorar(f: DadosFunil) {
  const e = f.etapas
  const trechos = [
    { de: e.chegou, para: e.atracao, onde: 'logo depois de abrir o app', dica: 'Muita gente abre o app e sai sem escolher nada. Poste preços e fotos dos cortes no Instagram, para quem chega já saber o que quer.' },
    { de: e.atracao, para: e.arguicao, onde: 'na hora de escolher barbeiro e horário', dica: 'Muitos param quando veem os horários. Pode estar faltando vaga nos dias e horas mais procurados: veja se dá para abrir mais horários no fim da tarde ou no sábado.' },
    { de: e.arguicao, para: e.acao, onde: 'no último passo, antes de confirmar', dica: 'Muitos escolhem o horário e não confirmam. A retomada automática já chama no WhatsApp quem deixou o número.' },
  ]
  // em menos de 30 dias muita gente ainda nem foi atendida: a comparação fica injusta
  if (f.dias >= 30) trechos.push({ de: e.atendidos, para: e.apologia, onde: 'depois do atendimento', dica: 'Poucos voltam ou dão nota alta. Peça a avaliação antes de o cliente sair e lembre do cartão fidelidade.' })
  const validos = trechos.filter((t) => t.de >= 5)
  if (!validos.length) return null
  return validos.reduce((pior, t) => (t.para / t.de < pior.para / pior.de ? t : pior))
}

export default function Funil() {
  const { avisar } = useApp()
  const [dias, setDias] = useState(7)
  const [f, setF] = useState<DadosFunil | null>(null)
  const [todos, setTodos] = useState(false)

  // atualiza sozinho a cada 15 s (tempo real)
  useEffect(() => {
    let vivo = true
    const carregar = () => api.painel.funil(dias).then((r) => vivo && setF(r)).catch((e) => vivo && avisar(e.message, 'erro'))
    setF(null); carregar()
    const t = setInterval(carregar, 15_000)
    return () => { vivo = false; clearInterval(t) }
  }, [dias, avisar])

  const e = f?.etapas
  const etapas = e ? [
    { nome: 'Chegaram', kotler: 'Assimilação', n: e.chegou, txt: 'abriram o app' },
    { nome: 'Se interessaram', kotler: 'Atração', n: e.atracao, txt: 'escolheram um serviço' },
    { nome: 'Consideraram', kotler: 'Arguição', n: e.arguicao, txt: 'escolheram um horário' },
    { nome: 'Agendaram', kotler: 'Ação', n: e.acao, txt: 'marcaram o horário' },
    { nome: 'Voltaram ou elogiaram', kotler: 'Apologia', n: e.apologia, txt: 'deram nota 4–5 ou marcaram de novo' },
  ] : []
  const melhorar = f && ondeMelhorar(f)
  const maxOrigem = Math.max(1, ...(f?.origens.map((o) => o.visitas) ?? []))

  return (
    <div className="painel__col">
      <div className="filtros" role="group" aria-label="Período">
        {PERIODOS.map(([d, r]) => <button key={d} className={dias === d ? 'ativo' : ''} aria-pressed={dias === d} onClick={() => setDias(d)}>{r}</button>)}
      </div>

      {!f ? <div className="cartao cartao--esqueleto" /> : (
        <>
          <section className="cartao funil-vivo" aria-live="polite">
            <div className="linha-entre">
              <h2 className="secao funil-vivo__titulo"><span className="funil-pulso" aria-hidden="true" /> Agora no app</h2>
              <span className="suave pequeno">atualiza sozinho</span>
            </div>
            {f.aoVivo.length === 0 ? <p className="suave">Ninguém mexendo no app agora.</p> : (
              <ul className="funil-lista">
                {f.aoVivo.map((v) => (
                  <li key={v.id}>
                    <strong>{v.nome ? v.nome.split(' ')[0] : 'Visitante'}</strong>
                    <span className="suave funil-lista__det">Veio por {nomeOrigem(v.origem)} · {ETAPA_AGORA[v.etapa]}{v.servico ? ` (${v.servico})` : ''}</span>
                    <span className="suave pequeno funil-lista__quando">{ha(v.quando, f.agora)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <h2 className="secao">O caminho do cliente</h2>
          <ol className="funil" aria-label="Funil dos 5 A's">
            {etapas.map((x, i) => (
              <li key={x.kotler} className="funil__etapa" style={{ '--larg': `${Math.max(28, pct(x.n, etapas[0].n || 1))}%` } as React.CSSProperties}>
                <div className="funil__barra">
                  <span className="funil__num">{x.n}</span>
                  <span className="funil__nome">{x.nome}<small>{x.kotler}</small></span>
                </div>
                <span className="suave pequeno funil__txt">
                  {x.txt}{i > 0 && etapas[i - 1].n ? ` · ${pct(x.n, i === 4 ? e!.atendidos || x.n : etapas[i - 1].n)}% ${i === 4 ? 'dos atendidos' : 'da etapa anterior'}` : ''}
                </span>
              </li>
            ))}
          </ol>

          {melhorar && (
            <section className="cartao cartao--destaque funil-dica">
              <span className="sobretitulo">Onde dá para melhorar</span>
              <p><strong>{100 - pct(melhorar.para, melhorar.de)}% saem {melhorar.onde}.</strong> {melhorar.dica}</p>
            </section>
          )}

          <div className="painel__grade funil-grade">
            <section className="painel__col">
              <h2 className="secao">De onde vêm</h2>
              {f.origens.length === 0 ? <p className="vazio">Ainda sem visitas no período.</p> : (
                <div className="barras">
                  {f.origens.map((o) => (
                    <div key={o.origem} className="funil-origem">
                      <div className="linha-entre"><span>{nomeOrigem(o.origem)}</span><strong>{o.visitas}</strong></div>
                      <div className="barra"><div style={{ width: `${(o.visitas / maxOrigem) * 100}%` }} /></div>
                      <span className="suave pequeno">{o.agendaram} agendaram ({pct(o.agendaram, o.visitas)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="painel__col">
              <h2 className="secao">Pararam no meio</h2>
              <div className="metricas">
                <div className="metrica metrica--destaque"><span className="suave">Recuperados pela mensagem</span><strong>{f.retomada.recuperados}</strong></div>
                <div className="metrica"><span className="suave">Mensagens enviadas</span><strong>{f.retomada.enviadas}</strong></div>
              </div>
              <p className="suave pequeno">
                Quem já deixou o WhatsApp e parou no meio recebe uma mensagem {f.retomada.esperaMin} min depois, com um link que abre o agendamento onde parou. Só uma vez, e no máximo uma por semana para a mesma pessoa.
              </p>
              {f.parados.length === 0 ? <p className="vazio">Ninguém parou no meio nos últimos 7 dias.</p> : (
                <ul className="funil-parados">
                  {(todos ? f.parados : f.parados.slice(0, 6)).map((p) => (
                    <li key={p.id} className="funil-parado">
                      <div className="linha-entre">
                        <strong>{p.nome}</strong>
                        <span className={`funil-estado ${ESTADO[p.estado].classe}`}>
                          {p.estado === 'aguardando' && p.mensagemEm ? `Mensagem às ${hora(p.mensagemEm)}` : ESTADO[p.estado].rotulo}
                        </span>
                      </div>
                      <span className="suave pequeno">
                        Parou em: {p.parouEm}{p.servico ? ` · ${p.servico}` : ''}{p.profissional ? ` com ${p.profissional.split(' ')[0]}` : ''}{p.data && p.hora ? ` · ${p.data.slice(8, 10)}/${p.data.slice(5, 7)} ${p.hora}` : ''}
                      </span>
                      <span className="suave pequeno">{nomeOrigem(p.origem)} · {ha(p.quando, f.agora)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {f.parados.length > 6 && (
                <button className="botao botao--fantasma pequeno" onClick={() => setTodos(!todos)}>{todos ? 'Mostrar menos' : `Ver todos (${f.parados.length})`}</button>
              )}
              {f.retomada.anonimos > 0 && (
                <p className="suave pequeno">Mais {f.retomada.anonimos} {f.retomada.anonimos === 1 ? 'pessoa parou' : 'pessoas pararam'} sem deixar o WhatsApp. Essas não dá para chamar, mas entram nos números do funil.</p>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
