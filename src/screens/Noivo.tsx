import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { useApp } from '../contexto'
import { linkWhats, primeiroNome } from '../util'
import { Ornamento } from './Inicio'

const B = import.meta.env.BASE_URL

/** Dia do Noivo: o making of que a Roque já faz, com pedido de orçamento pelo WhatsApp.
 *  Os itens do pacote são uma proposta para validar com a barbearia. */
const INCLUI = [
  ['Making of', 'Fotos e vídeo da preparação do noivo, prontos para o álbum e o Instagram'],
  ['Corte e barba', 'Feitos no dia ou na véspera, com hora marcada só para vocês'],
  ['Padrinhos', 'Atendimento em grupo para o noivo chegar com a turma alinhada'],
  ['Ritual completo', 'Toalha quente, navalha, hidratação e acabamento sem pressa'],
]

export default function Noivo({ navegar }: { navegar: Navegar }) {
  const { barbearia, cliente } = useApp()
  if (!barbearia) return null
  const texto = `Olá! Quero saber sobre o Dia do Noivo na ${barbearia.nome}.${cliente ? ` Sou o ${primeiroNome(cliente.nome)}.` : ''} Data do casamento: `

  return (
    <div className="tela">
      <header className="noivo-hero" style={{ backgroundImage: `url(${B}img/fundo-parede.jpg)` }}>
        <div className="noivo-hero__sombra" />
        <button className="icone-botao noivo-hero__voltar" onClick={() => navegar('inicio')} aria-label="Voltar"><Icone nome="voltar" /></button>
        <div className="noivo-hero__texto">
          <p className="sobretitulo">Experiência exclusiva</p>
          <h1 className="titulo-editorial">Dia do <em>Noivo</em></h1>
          <p className="suave">O seu grande dia começa na cadeira da Roque.</p>
        </div>
      </header>

      <p className="manifesto">
        Um momento só seu, com tempo, cuidado e registro de cada detalhe, para você chegar ao altar do jeito que sempre imaginou.
      </p>

      <Ornamento texto="O que inclui" />
      <div className="inclui">
        {INCLUI.map(([t, d], i) => (
          <div key={t} className="inclui__item">
            <span className="inclui__num">{String(i + 1).padStart(2, '0')}</span>
            <div><strong>{t}</strong><p className="suave">{d}</p></div>
          </div>
        ))}
      </div>

      <Ornamento texto="Como funciona" />
      <ol className="passos passos--ed">
        <li>Você chama a gente no WhatsApp com a data do casamento.</li>
        <li>Montamos o pacote com você: noivo, padrinhos e horários.</li>
        <li>Reservamos a data na agenda da casa.</li>
      </ol>

      <a className="botao botao--principal botao--grande botao--brilho" href={linkWhats(barbearia.whatsapp, texto)} target="_blank" rel="noreferrer">
        <Icone nome="whats" /> Solicitar orçamento
      </a>
      <p className="suave pequeno centro">Valores sob consulta, de acordo com o pacote.</p>
      {barbearia.instagram && (
        <a className="link centro" href={`https://instagram.com/${barbearia.instagram}`} target="_blank" rel="noreferrer">
          Veja os making of no @{barbearia.instagram}
        </a>
      )}
    </div>
  )
}
