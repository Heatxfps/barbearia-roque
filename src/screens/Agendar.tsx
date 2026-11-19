import { useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import Entrar from '../components/Entrar'
import { api, type Dia } from '../api'
import { useApp } from '../contexto'
import { dataLonga, lerData, moeda } from '../util'
import { iniciais } from './Inicio'

const ETAPAS = ['Serviço', 'Profissional', 'Horário', 'Confirmar'] as const

export default function Agendar({ servicoInicial, navegar }: { servicoInicial?: string; navegar: Navegar }) {
  const { barbearia, cliente, avisar } = useApp()
  const [etapa, setEtapa] = useState(servicoInicial ? 1 : 0)
  const [servicoId, setServicoId] = useState(servicoInicial ?? '')
  const [profId, setProfId] = useState('')
  const [dias, setDias] = useState<Dia[] | null>(null)
  const [data, setData] = useState('')
  const [horas, setHoras] = useState<string[] | null>(null)
  const [hora, setHora] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ profissional: string } | null>(null)

  const servico = barbearia?.servicos.find((s) => s.id === servicoId)
  const profs = [{ id: 'qualquer', nome: 'Sem preferência', especialidade: 'Primeiro profissional livre' }, ...(barbearia?.profissionais ?? [])]
  const prof = profs.find((p) => p.id === profId)

  // dias com vaga
  useEffect(() => {
    if (etapa !== 2 || !servicoId || !profId) return
    setDias(null)
    api.dias(servicoId, profId).then((d) => {
      setDias(d)
      setData((atual) => (d.some((x) => x.data === atual && x.livres) ? atual : d.find((x) => x.livres)?.data ?? d[0]?.data ?? ''))
    }).catch((e) => avisar(e.message, 'erro'))
  }, [etapa, servicoId, profId, avisar])

  // horários do dia
  useEffect(() => {
    if (etapa !== 2 || !data) return
    setHoras(null)
    api.horarios(data, servicoId, profId).then(setHoras).catch((e) => avisar(e.message, 'erro'))
  }, [etapa, data, servicoId, profId, avisar])

  const voltar = () => (etapa === 0 ? navegar('inicio') : setEtapa(etapa - 1))

  const confirmar = async () => {
    setEnviando(true)
    try {
      const r = await api.agendar({ servicoId, profissionalId: profId, data, hora })
      setFeito({ profissional: barbearia?.profissionais.find((p) => p.id === r.profissionalId)?.nome ?? '' })
    } catch (e) {
      avisar((e as Error).message, 'erro')
      setHora(''); setEtapa(2)
    } finally { setEnviando(false) }
  }

  if (!barbearia) return null

  if (feito && servico) {
    return (
      <div className="tela tela--centro">
        <div className="sucesso"><Icone nome="check" tam={44} /></div>
        <h1 className="titulo">Horário confirmado!</h1>
        <p className="suave centro capitalizar">{servico.nome} com {feito.profissional}<br />{dataLonga(data)} às {hora}</p>
        <p className="suave centro pequeno">
          {barbearia.whatsappModo === 'demo' || barbearia.whatsappModo === 'offline'
            ? 'Na versão final, a confirmação e os lembretes (1 dia e 1 hora antes) chegam no WhatsApp. Veja as mensagens no painel da barbearia.'
            : 'A confirmação chegou no seu WhatsApp. Você também recebe lembretes 1 dia e 1 hora antes.'}
        </p>
        <button className="botao botao--principal" onClick={() => navegar('agenda')}>Ver meus horários</button>
        <button className="botao botao--fantasma" onClick={() => navegar('inicio')}>Voltar ao início</button>
      </div>
    )
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="icone-botao" onClick={voltar} aria-label="Voltar"><Icone nome="voltar" /></button>
        <h1 className="topo__titulo">Agendar</h1>
        <span style={{ width: 40 }} />
      </header>

      <ol className="etapas">
        {ETAPAS.map((e, i) => <li key={e} className={i === etapa ? 'atual' : i < etapa ? 'feita' : ''}>{e}</li>)}
      </ol>

      {etapa === 0 && (
        <div className="lista">
          {barbearia.servicos.map((s) => (
            <button key={s.id} className={`item ${servicoId === s.id ? 'item--sel' : ''}`} onClick={() => { setServicoId(s.id); setHora(''); setEtapa(1) }}>
              <div><strong>{s.nome}</strong><span className="suave">{s.descricao}</span></div>
              <div className="item__preco"><strong>{moeda(s.preco)}</strong><span className="suave">{s.duracao} min</span></div>
            </button>
          ))}
        </div>
      )}

      {etapa === 1 && (
        <div className="lista">
          {profs.map((p) => (
            <button key={p.id} className={`item ${profId === p.id ? 'item--sel' : ''}`} onClick={() => { setProfId(p.id); setHora(''); setEtapa(2) }}>
              <div className="item__com-avatar">
                <div className="avatar avatar--p">{p.id === 'qualquer' ? '★' : iniciais(p.nome)}</div>
                <div><strong>{p.nome}</strong><span className="suave">{p.especialidade}</span></div>
              </div>
              <Icone nome="seta" />
            </button>
          ))}
        </div>
      )}

      {etapa === 2 && (
        <>
          <div className="dias">
            {!dias && Array.from({ length: 6 }, (_, i) => <div key={i} className="dia dia--esqueleto" />)}
            {dias?.map((d) => {
              const dt = lerData(d.data)
              return (
                <button key={d.data} disabled={!d.livres} className={`dia ${data === d.data ? 'dia--sel' : ''}`} onClick={() => { setData(d.data); setHora('') }}>
                  <span>{dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                  <strong>{dt.getDate()}</strong>
                  <span>{d.livres ? dt.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') : 'lotado'}</span>
                </button>
              )
            })}
          </div>
          {data && <p className="suave pequeno capitalizar">{dataLonga(data)} · {servico?.nome} ({servico?.duracao} min)</p>}
          {horas === null ? (
            <div className="horas">{Array.from({ length: 8 }, (_, i) => <div key={i} className="hora hora--esqueleto" />)}</div>
          ) : horas.length ? (
            <div className="horas">
              {horas.map((h) => <button key={h} className={`hora ${hora === h ? 'hora--sel' : ''}`} onClick={() => setHora(h)}>{h}</button>)}
            </div>
          ) : (
            <p className="vazio">Sem horários livres neste dia. Tente outra data.</p>
          )}
          <button className="botao botao--principal fixo" disabled={!hora} onClick={() => setEtapa(3)}>Continuar</button>
        </>
      )}

      {etapa === 3 && servico && prof && (
        <>
          <section className="cartao resumo">
            <div className="linha-entre"><span className="suave">Serviço</span><strong>{servico.nome}</strong></div>
            <div className="linha-entre"><span className="suave">Profissional</span><strong>{prof.nome}</strong></div>
            <div className="linha-entre"><span className="suave">Quando</span><strong className="capitalizar">{dataLonga(data)}, {hora}</strong></div>
            <div className="linha-entre"><span className="suave">Duração</span><strong>{servico.duracao} min</strong></div>
            <hr />
            <div className="linha-entre total"><span>Total</span><strong>{moeda(servico.preco)}</strong></div>
            <p className="suave pequeno">Pagamento na barbearia (Pix, cartão ou dinheiro).</p>
          </section>

          {cliente ? (
            <>
              <p className="suave pequeno">Agendando como <strong>{cliente.nome}</strong></p>
              <button className="botao botao--principal fixo" disabled={enviando} onClick={confirmar}>{enviando ? 'Confirmando…' : 'Confirmar agendamento'}</button>
            </>
          ) : (
            <section className="cartao">
              <h3>Quase lá: identifique-se</h3>
              <Entrar textoBotao="Continuar" aoEntrar={() => avisar('Pronto! Agora é só confirmar.')} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
