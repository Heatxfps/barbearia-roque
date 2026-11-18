import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { barbearia, moeda, profissionais, servicos } from '../data'
import { agoraChave, dataLonga } from '../agenda'
import { useEstado } from '../store'

const B = import.meta.env.BASE_URL

function saudacao() {
  const h = new Date().getHours()
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
}

export default function Inicio({ navegar }: { navegar: Navegar }) {
  const { cliente, agendamentos, selos } = useEstado()
  const agora = agoraChave()
  const proximo = agendamentos
    .filter((a) => a.status === 'confirmado' && `${a.data}T${a.hora}` >= agora)
    .sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))[0]
  const servProx = proximo && servicos.find((s) => s.id === proximo.servicoId)
  const hojeAberto = barbearia.horarios[new Date().getDay()]

  return (
    <div className="tela">
      <header className="hero" style={{ backgroundImage: `url(${B}img/parede-sem-letreiro.jpg)` }}>
        <div className="hero__sombra" />
        <img className="hero__logo" src={`${B}logo-partes/logo-completa.png`} alt="Barbearia Roque" />
        <div className="hero__texto">
          <p className="sobretitulo">{saudacao()}{cliente ? `, ${cliente.nome.split(' ')[0]}` : ''}</p>
          <h1 className="titulo">Seu horário,<br />do seu jeito.</h1>
          <p className="hero__status">
            <span className={`ponto ${hojeAberto ? 'ponto--on' : ''}`} />
            {hojeAberto ? `Aberto hoje · ${hojeAberto[0]}h às ${hojeAberto[1]}h` : 'Fechado hoje'}
          </p>
        </div>
      </header>

      <button className="botao botao--principal botao--grande" onClick={() => navegar('agendar')}>
        <Icone nome="tesoura" /> Agendar horário
      </button>

      {proximo && servProx && (
        <button className="cartao cartao--destaque cartao--botao" onClick={() => navegar('agenda')}>
          <p className="sobretitulo">Seu próximo horário</p>
          <div className="linha-entre">
            <div>
              <h3>{servProx.nome}</h3>
              <p className="suave">{dataLonga(proximo.data)} · {proximo.hora}</p>
            </div>
            <Icone nome="seta" />
          </div>
        </button>
      )}

      <button className="cartao cartao--botao" onClick={() => navegar('fidelidade')}>
        <div className="linha-entre">
          <div>
            <p className="sobretitulo">Cartão fidelidade</p>
            <h3>{selos} de {barbearia.fidelidadeMeta} cortes</h3>
          </div>
          <span className="badge">faltam {barbearia.fidelidadeMeta - selos}</span>
        </div>
        <div className="barra"><div style={{ width: `${(selos / barbearia.fidelidadeMeta) * 100}%` }} /></div>
      </button>

      <h2 className="secao">Serviços</h2>
      <div className="lista">
        {servicos.filter((s) => s.destaque).map((s) => (
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
        {profissionais.filter((p) => p.id !== 'qualquer').map((p) => (
          <div key={p.id} className="barbeiro">
            <div className="avatar">{p.iniciais}</div>
            <strong>{p.nome}</strong>
            <span className="suave">{p.especialidade}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
