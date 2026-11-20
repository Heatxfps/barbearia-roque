import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api } from '../api'
import { useApp } from '../contexto'
import { foto, formatarTelefone, linkWhats } from '../util'
import { Ornamento } from './Inicio'

const B = import.meta.env.BASE_URL
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const h = (s: string) => s.replace(':00', 'h').replace(':', 'h')

export default function Perfil({ navegar }: { navegar: Navegar }) {
  const { barbearia, cliente, definirCliente } = useApp()
  if (!barbearia) return null
  const hoje = new Date().getDay()

  return (
    <div className="tela">
      <header className="sobre" style={{ backgroundImage: `url(${B}img/fundo-parede.jpg)` }}>
        <div className="sobre__sombra" />
        <span className="sobre__legenda">Nosso espaço · {barbearia.cidade.split(' - ')[0]}</span>
      </header>

      <p className="manifesto">
        Mais que um corte: um ritual. Ambiente clássico, atendimento no detalhe e o melhor da barbearia
        tradicional em Nova Venécia.
      </p>

      {barbearia.dono && (
        <>
          <Ornamento texto="O fundador" />
          <section className="fundador">
            {barbearia.dono.foto && <img src={foto(barbearia.dono.foto)} alt={barbearia.dono.nome} loading="lazy" />}
            <div className="fundador__texto">
              <p className="sobretitulo">Fundador</p>
              <h2 className="titulo-editorial pequeno-ed">{barbearia.dono.nome}</h2>
              <p className="suave">
                Clássico na essência, moderno no estilo. À frente da Roque, {barbearia.dono.nome.split(' ')[0]} une a tradição
                da barbearia a um olhar atual, no ambiente, no atendimento e em cada detalhe.
              </p>
            </div>
          </section>
        </>
      )}

      <button className="item" onClick={() => navegar('noivo')}>
        <div className="item__com-avatar"><Icone nome="fidelidade" /><div><strong>Dia do Noivo</strong><span className="suave">Making of e cuidado completo para o grande dia</span></div></div>
        <Icone nome="seta" />
      </button>

      <div className="lista">
        <a className="item" href={linkWhats(barbearia.whatsapp)} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="whats" /><div><strong>WhatsApp</strong><span className="suave">Fale com a gente</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://instagram.com/${barbearia.instagram}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="insta" /><div><strong>Instagram</strong><span className="suave">@{barbearia.instagram}</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${barbearia.nome} ${barbearia.cidade}`)}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="local" /><div><strong>Como chegar</strong><span className="suave">{barbearia.endereco}</span></div></div>
          <Icone nome="seta" />
        </a>
      </div>

      <Ornamento texto="Horários" />
      <section className="cartao horarios">
        {DIAS.map((d, i) => {
          const x = barbearia.horarios[i]
          return (
            <div key={d} className={`linha-entre ${i === hoje ? 'hoje' : ''}`}>
              <span>{d}</span>
              <span>{x ? `${h(x[0])} – ${h(x[1])}` : 'Fechado'}</span>
            </div>
          )
        })}
      </section>

      {cliente && (
        <>
          <Ornamento texto="Sua conta" />
          <section className="cartao">
            <strong>{cliente.nome}</strong>
            <p className="suave">{formatarTelefone(cliente.telefone)}</p>
            <button className="botao botao--fantasma pequeno" onClick={() => { api.sair(); definirCliente(null) }}>Sair</button>
          </section>
        </>
      )}

      <button className="botao botao--fantasma" onClick={() => navegar('painel')}>
        <Icone nome="painel" /> Área da barbearia
      </button>
      <p className="rodape">v1.0 · {api.modo === 'local' ? 'modo demonstração offline' : 'conectado'}</p>
    </div>
  )
}
