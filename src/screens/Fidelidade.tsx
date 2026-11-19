import type { Navegar } from '../App'
import Entrar from '../components/Entrar'
import { useApp } from '../contexto'

const B = import.meta.env.BASE_URL

export default function Fidelidade({ navegar }: { navegar: Navegar }) {
  const { barbearia, cliente } = useApp()
  const meta = barbearia?.fidelidadeMeta ?? 10
  const selos = cliente?.fidelidade.selos ?? 0
  const premios = cliente?.fidelidade.premiosConquistados ?? 0

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
        {cliente ? (
          <p className="suave centro">
            {selos === meta - 1 ? <>Seu próximo corte é <strong>grátis</strong>! 🎉</> : <>Faltam <strong>{meta - 1 - selos}</strong> atendimentos para o seu corte grátis.</>}
            {premios > 0 && <><br />Você já ganhou {premios} {premios > 1 ? 'cortes' : 'corte'} grátis.</>}
          </p>
        ) : <p className="suave centro">Entre para ver seus selos.</p>}
      </section>

      {!cliente && (
        <section className="cartao">
          <Entrar aoEntrar={() => {}} />
        </section>
      )}

      <h2 className="secao">Como funciona</h2>
      <ol className="passos">
        <li>Agende pelo app e venha no horário.</li>
        <li>O selo entra sozinho quando o barbeiro finaliza o atendimento.</li>
        <li>No {meta}º atendimento, é por nossa conta.</li>
      </ol>

      <section className="cartao">
        <p className="sobretitulo">Indique um amigo</p>
        <h3>Chame a galera para a Roque</h3>
        <p className="suave">Mande o link do app para um amigo agendar em 20 segundos.</p>
        <button
          className="botao botao--fantasma"
          onClick={() => {
            const texto = 'Bora cortar na Barbearia Roque? Agenda pelo app: ' + location.origin + location.pathname
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
