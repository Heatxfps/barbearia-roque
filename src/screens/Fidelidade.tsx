import type { Navegar } from '../App'
import { barbearia } from '../data'
import { useEstado } from '../store'

const B = import.meta.env.BASE_URL

export default function Fidelidade({ navegar }: { navegar: Navegar }) {
  const { selos } = useEstado()
  const meta = barbearia.fidelidadeMeta

  return (
    <div className="tela">
      <h1 className="titulo titulo--pagina">Fidelidade</h1>

      <section className="cartao-fidelidade">
        <div className="cartao-fidelidade__topo">
          <img src={`${B}logo-partes/logo-completa.png`} alt="" />
          <div>
            <p className="sobretitulo">Clube Roque</p>
            <h3>A cada {meta} cortes, 1 é por nossa conta</h3>
          </div>
        </div>
        <div className="selos">
          {Array.from({ length: meta }, (_, i) => (
            <div key={i} className={`selo ${i < selos ? 'selo--ok' : ''} ${i === meta - 1 ? 'selo--premio' : ''}`}>
              {i === meta - 1 ? 'GRÁTIS' : i < selos ? <img src={`${B}logo-partes/r-recorte.png`} alt="" /> : i + 1}
            </div>
          ))}
        </div>
        <p className="suave centro">Faltam <strong>{meta - selos}</strong> cortes para o seu corte grátis.</p>
      </section>

      <h2 className="secao">Como funciona</h2>
      <ol className="passos">
        <li>Agende pelo app e compareça ao horário.</li>
        <li>Seu selo entra automaticamente depois do atendimento.</li>
        <li>No {meta}º corte, é por nossa conta.</li>
      </ol>

      <section className="cartao">
        <p className="sobretitulo">Indique um amigo</p>
        <h3>Ganhe 1 selo extra</h3>
        <p className="suave">Quando ele fizer o primeiro corte, o selo cai no seu cartão.</p>
        <button
          className="botao botao--fantasma"
          onClick={() => {
            const texto = 'Bora cortar na Barbearia Roque? Agenda pelo app: ' + window.location.href
            if (navigator.share) navigator.share({ text: texto }).catch(() => {})
            else window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
          }}
        >
          Compartilhar convite
        </button>
      </section>

      <button className="botao botao--principal" onClick={() => navegar('agendar')}>Agendar e ganhar selo</button>
    </div>
  )
}
