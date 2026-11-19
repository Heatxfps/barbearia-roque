import { useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api, type Agendamento } from '../api'
import { useApp } from '../contexto'
import { dataLonga, foto, hora, moeda, primeiroNome } from '../util'

const B = import.meta.env.BASE_URL

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Inicio({ navegar }: { navegar: Navegar }) {
  const { barbearia, cliente } = useApp()
  const [proximo, setProximo] = useState<Agendamento | null>(null)

  useEffect(() => {
    if (!cliente) { setProximo(null); return }
    api.meusAgendamentos().then(({ agora, agendamentos }) => {
      const fut = agendamentos.filter((a) => a.status === 'confirmado' && a.inicio >= agora).sort((a, b) => a.inicio.localeCompare(b.inicio))
      setProximo(fut[0] ?? null)
    }).catch(() => {})
  }, [cliente])

  if (!barbearia) return null
  const hoje = barbearia.horarios[new Date().getDay()]
  const meta = barbearia.fidelidadeMeta
  const selos = cliente?.fidelidade.selos ?? 0
  const destaques = barbearia.servicos.filter((s) => s.destaque)

  return (
    <div className="tela">
      <header className="hero" style={{ backgroundImage: `url(${B}img/parede-sem-letreiro.jpg)` }}>
        <div className="hero__sombra" />
        <img className="hero__logo" src={`${B}logo-partes/logo-completa.png`} alt={barbearia.nome} />
        <div className="hero__texto">
          <p className="sobretitulo">{saudacao()}{cliente ? `, ${primeiroNome(cliente.nome)}` : ''}</p>
          <h1 className="titulo-editorial">Tradição no corte,<br /><em>presença</em> no estilo.</h1>
          <p className="hero__status">
            <span className={`ponto ${hoje ? 'ponto--on' : ''}`} />
            {hoje ? `Aberto hoje · ${hoje[0].replace(':00', 'h')} às ${hoje[1].replace(':00', 'h')}` : 'Fechado hoje'}
          </p>
        </div>
      </header>

      <button className="botao botao--principal botao--grande botao--brilho" onClick={() => navegar('agendar')}>
        <Icone nome="tesoura" /> Agendar horário
      </button>

      {proximo && (
        <button className="cartao cartao--destaque cartao--botao" onClick={() => navegar('agenda')}>
          <p className="sobretitulo">Seu próximo horário</p>
          <div className="linha-entre">
            <div>
              <h3>{proximo.servico}</h3>
              <p className="suave capitalizar">{dataLonga(proximo.inicio)} · {hora(proximo.inicio)} · {proximo.profissional}</p>
            </div>
            <Icone nome="seta" />
          </div>
        </button>
      )}

      <Ornamento texto="Os barbeiros" />
      <div className="equipe">
        {barbearia.profissionais.map((p) => (
          <button key={p.id} className="retrato" onClick={() => navegar('agendar', { profissionalId: p.id })}>
            {p.foto ? <img src={foto(p.foto)} alt={p.nome} loading="lazy" /> : <div className="retrato__vazio">{p.nome[0]}</div>}
            <div className="retrato__legenda">
              <strong>{p.nome}</strong>
              <span>Agendar <Icone nome="seta" tam={14} /></span>
            </div>
          </button>
        ))}
      </div>

      <Ornamento texto="Serviços da casa" />
      <div className="cardapio">
        {destaques.map((s) => (
          <button key={s.id} className="cardapio__item" onClick={() => navegar('agendar', { servicoId: s.id })}>
            <div className="cardapio__linha">
              <strong>{s.nome}</strong>
              <span className="cardapio__pontos" />
              <strong className="cardapio__preco">{moeda(s.preco)}</strong>
            </div>
            <span className="suave">{s.descricao} · {s.duracao} min</span>
          </button>
        ))}
        <button className="link" onClick={() => navegar('agendar')}>Ver todos os serviços</button>
      </div>

      <button className="noivo-chamada" onClick={() => navegar('noivo')} style={{ backgroundImage: `url(${B}img/fundo-parede.jpg)` }}>
        <div className="noivo-chamada__sombra" />
        <div className="noivo-chamada__texto">
          <p className="sobretitulo">Experiência exclusiva</p>
          <h2 className="titulo-editorial pequeno-ed">Dia do <em>Noivo</em></h2>
          <p>Making of, cuidado completo e os padrinhos juntos. O seu grande dia começa aqui.</p>
          <span className="noivo-chamada__acao">Conhecer <Icone nome="seta" tam={14} /></span>
        </div>
      </button>

      <button className="cartao cartao--botao cartao--fidelidade-mini" onClick={() => navegar('fidelidade')}>
        <div className="linha-entre">
          <div>
            <p className="sobretitulo">Clube Roque</p>
            <h3>{cliente ? `${selos} de ${meta} cortes` : `A cada ${meta} cortes, 1 é por nossa conta`}</h3>
          </div>
          {cliente ? <span className="badge">faltam {meta - selos}</span> : <Icone nome="seta" />}
        </div>
        {cliente && <div className="barra"><div style={{ width: `${(selos / meta) * 100}%` }} /></div>}
      </button>
    </div>
  )
}

export function Ornamento({ texto }: { texto: string }) {
  return (
    <div className="ornamento">
      <span aria-hidden="true" /><h2>{texto}</h2><span aria-hidden="true" />
    </div>
  )
}

export const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/)
  const ultimo = partes[partes.length - 1]
  return /^\d+$/.test(ultimo) ? `${partes[0][0]}${ultimo}` : (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}
