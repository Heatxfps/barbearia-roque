import { useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api, type Agendamento } from '../api'
import { useApp } from '../contexto'
import { dataLonga, hora, moeda } from '../util'

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

  return (
    <div className="tela">
      <header className="hero" style={{ backgroundImage: `url(${B}img/parede-sem-letreiro.jpg)` }}>
        <div className="hero__sombra" />
        <img className="hero__logo" src={`${B}logo-partes/logo-completa.png`} alt={barbearia.nome} />
        <div className="hero__texto">
          <p className="sobretitulo">{saudacao()}{cliente ? `, ${cliente.nome.split(' ')[0]}` : ''}</p>
          <h1 className="titulo">Seu horário,<br />do seu jeito.</h1>
          <p className="hero__status">
            <span className={`ponto ${hoje ? 'ponto--on' : ''}`} />
            {hoje ? `Aberto hoje · ${hoje[0].replace(':00', 'h')} às ${hoje[1].replace(':00', 'h')}` : 'Fechado hoje'}
          </p>
        </div>
      </header>

      <button className="botao botao--principal botao--grande" onClick={() => navegar('agendar')}>
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

      <button className="cartao cartao--botao" onClick={() => navegar('fidelidade')}>
        <div className="linha-entre">
          <div>
            <p className="sobretitulo">Cartão fidelidade</p>
            <h3>{cliente ? `${selos} de ${meta} cortes` : `A cada ${meta} cortes, 1 grátis`}</h3>
          </div>
          {cliente && <span className="badge">faltam {meta - selos}</span>}
        </div>
        {cliente && <div className="barra"><div style={{ width: `${(selos / meta) * 100}%` }} /></div>}
      </button>

      <h2 className="secao">Serviços</h2>
      <div className="lista">
        {barbearia.servicos.filter((s) => s.destaque).map((s) => (
          <button key={s.id} className="item" onClick={() => navegar('agendar', s.id)}>
            <div>
              <strong>{s.nome}</strong>
              <span className="suave">{s.descricao}</span>
            </div>
            <div className="item__preco">
              <strong>{moeda(s.preco)}</strong>
              <span className="suave">{s.duracao} min</span>
            </div>
          </button>
        ))}
        <button className="link" onClick={() => navegar('agendar')}>Ver todos os serviços</button>
      </div>

      <h2 className="secao">Nossa equipe</h2>
      <div className="carrossel">
        {barbearia.profissionais.map((p) => (
          <div key={p.id} className="barbeiro">
            <div className="avatar">{iniciais(p.nome)}</div>
            <strong>{p.nome}</strong>
            <span className="suave">{p.especialidade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export const iniciais = (nome: string) => {
  const partes = nome.trim().split(/\s+/)
  const ultimo = partes[partes.length - 1]
  return /^\d+$/.test(ultimo) ? `${partes[0][0]}${ultimo}` : (partes[0][0] + (partes[1]?.[0] ?? '')).toUpperCase()
}
