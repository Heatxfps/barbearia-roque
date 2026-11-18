import { useMemo, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { moeda, profissionais, servicos } from '../data'
import { dataLonga, horariosLivres, iso, proximosDias } from '../agenda'
import { atualizar, novoId, useEstado } from '../store'

const ETAPAS = ['Serviço', 'Profissional', 'Horário', 'Confirmar'] as const

export default function Agendar({ servicoInicial, navegar }: { servicoInicial?: string; navegar: Navegar }) {
  const { agendamentos, cliente } = useEstado()
  const [etapa, setEtapa] = useState(servicoInicial ? 1 : 0)
  const [servicoId, setServicoId] = useState(servicoInicial ?? '')
  const [profId, setProfId] = useState('')
  const dias = useMemo(() => proximosDias(14), [])
  const [data, setData] = useState(iso(dias[0]))
  const [hora, setHora] = useState('')
  const [nome, setNome] = useState(cliente?.nome ?? '')
  const [tel, setTel] = useState(cliente?.telefone ?? '')
  const [feito, setFeito] = useState(false)

  const servico = servicos.find((s) => s.id === servicoId)
  const prof = profissionais.find((p) => p.id === profId)
  const livres = useMemo(() => (profId ? horariosLivres(data, profId, agendamentos) : []), [data, profId, agendamentos])

  const voltar = () => (etapa === 0 ? navegar('inicio') : setEtapa(etapa - 1))

  const confirmar = () => {
    let p = profId
    if (p === 'qualquer') {
      // escolhe o primeiro profissional livre nesse horário
      p = profissionais.find((x) => x.id !== 'qualquer' && horariosLivres(data, x.id, agendamentos).includes(hora))?.id ?? 'p1'
    }
    atualizar((e) => ({
      ...e,
      cliente: { nome: nome.trim(), telefone: tel.trim() },
      agendamentos: [
        ...e.agendamentos,
        { id: novoId(), servicoId, profissionalId: p, data, hora, cliente: nome.trim(), telefone: tel.trim(), status: 'confirmado', criadoEm: Date.now() },
      ],
    }))
    setFeito(true)
  }

  if (feito && servico) {
    return (
      <div className="tela tela--centro">
        <div className="sucesso"><Icone nome="check" tam={44} /></div>
        <h1 className="titulo">Horário confirmado!</h1>
        <p className="suave centro">{servico.nome} · {dataLonga(data)} às {hora}</p>
        <p className="suave centro pequeno">Você vai receber um lembrete 1 dia antes e 1 hora antes pelo WhatsApp.</p>
        <button className="botao botao--principal" onClick={() => navegar('agenda')}>Ver meus horários</button>
        <button className="botao botao--fantasma" onClick={() => navegar('inicio')}>Voltar ao início</button>
      </div>
    )
  }

  const telValido = tel.replace(/\D/g, '').length >= 10

  return (
    <div className="tela">
      <header className="topo">
        <button className="icone-botao" onClick={voltar} aria-label="Voltar"><Icone nome="voltar" /></button>
        <h1 className="topo__titulo">Agendar</h1>
        <span style={{ width: 40 }} />
      </header>

      <ol className="etapas">
        {ETAPAS.map((e, i) => (
          <li key={e} className={i === etapa ? 'atual' : i < etapa ? 'feita' : ''}>{e}</li>
        ))}
      </ol>

      {etapa === 0 && (
        <div className="lista">
          {servicos.map((s) => (
            <button key={s.id} className={`item ${servicoId === s.id ? 'item--sel' : ''}`} onClick={() => { setServicoId(s.id); setEtapa(1) }}>
              <div><strong>{s.nome}</strong><span className="suave">{s.descricao}</span></div>
              <div className="item__preco"><strong>{moeda(s.preco)}</strong><span className="suave">{s.duracao} min</span></div>
            </button>
          ))}
        </div>
      )}

      {etapa === 1 && (
        <div className="lista">
          {profissionais.map((p) => (
            <button key={p.id} className={`item ${profId === p.id ? 'item--sel' : ''}`} onClick={() => { setProfId(p.id); setHora(''); setEtapa(2) }}>
              <div className="item__com-avatar">
                <div className="avatar avatar--p">{p.iniciais}</div>
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
            {dias.map((d) => {
              const v = iso(d)
              return (
                <button key={v} className={`dia ${data === v ? 'dia--sel' : ''}`} onClick={() => { setData(v); setHora('') }}>
                  <span>{d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
                  <strong>{d.getDate()}</strong>
                  <span>{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                </button>
              )
            })}
          </div>
          <p className="suave pequeno capitalizar">{dataLonga(data)}</p>
          {livres.length ? (
            <div className="horas">
              {livres.map((h) => (
                <button key={h} className={`hora ${hora === h ? 'hora--sel' : ''}`} onClick={() => setHora(h)}>{h}</button>
              ))}
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
          <label className="campo">
            <span>Seu nome</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" />
          </label>
          <label className="campo">
            <span>WhatsApp</span>
            <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(27) 9 9999-9999" inputMode="tel" autoComplete="tel" />
          </label>
          <button className="botao botao--principal fixo" disabled={!nome.trim() || !telValido} onClick={confirmar}>Confirmar agendamento</button>
        </>
      )}
    </div>
  )
}
