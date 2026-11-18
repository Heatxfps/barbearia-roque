import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { barbearia } from '../data'
import { atualizar, useEstado } from '../store'

const B = import.meta.env.BASE_URL
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function Perfil({ navegar }: { navegar: Navegar }) {
  const { cliente } = useEstado()
  const hoje = new Date().getDay()

  return (
    <div className="tela">
      <header className="sobre" style={{ backgroundImage: `url(${B}img/fundo-parede.jpg)` }}>
        <div className="sobre__sombra" />
        <span className="sobre__legenda">Nosso espaço · Nova Venécia</span>
      </header>

      <p className="manifesto">
        Mais que um corte: um ritual. Ambiente clássico, atendimento no detalhe e o melhor da barbearia
        tradicional em Nova Venécia.
      </p>

      <div className="lista">
        <a className="item" href={`https://wa.me/${barbearia.whatsapp}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="whats" /><div><strong>WhatsApp</strong><span className="suave">Fale com a gente</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://instagram.com/${barbearia.instagram}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="insta" /><div><strong>Instagram</strong><span className="suave">@{barbearia.instagram}</span></div></div>
          <Icone nome="seta" />
        </a>
        <a className="item" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Barbearia Roque Nova Venécia')}`} target="_blank" rel="noreferrer">
          <div className="item__com-avatar"><Icone nome="local" /><div><strong>Como chegar</strong><span className="suave">{barbearia.endereco}</span></div></div>
          <Icone nome="seta" />
        </a>
      </div>

      <h2 className="secao">Horário de funcionamento</h2>
      <section className="cartao horarios">
        {DIAS.map((d, i) => {
          const h = barbearia.horarios[i]
          return (
            <div key={d} className={`linha-entre ${i === hoje ? 'hoje' : ''}`}>
              <span>{d}</span>
              <span>{h ? `${h[0]}h – ${h[1]}h` : 'Fechado'}</span>
            </div>
          )
        })}
      </section>

      {cliente && (
        <>
          <h2 className="secao">Sua conta</h2>
          <section className="cartao">
            <strong>{cliente.nome}</strong>
            <p className="suave">{cliente.telefone}</p>
            <button
              className="botao botao--fantasma pequeno"
              onClick={() => {
                if (window.confirm('Apagar seus dados deste celular?')) atualizar(() => ({ cliente: null, agendamentos: [], selos: 0 }))
              }}
            >
              Sair e apagar dados
            </button>
          </section>
        </>
      )}

      <button className="botao botao--fantasma" onClick={() => navegar('painel')}>
        <Icone nome="painel" /> Área da barbearia (demonstração)
      </button>
      <p className="rodape">Protótipo · versão 0.1</p>
    </div>
  )
}
