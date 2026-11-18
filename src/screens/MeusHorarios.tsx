import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { moeda, profissionais, servicos } from '../data'
import { agoraChave, dataLonga } from '../agenda'
import { atualizar, useEstado } from '../store'

type Ordenavel = { data: string; hora: string }
const ordenar = (a: Ordenavel, b: Ordenavel) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`)

export default function MeusHorarios({ navegar }: { navegar: Navegar }) {
  const { agendamentos } = useEstado()
  const agora = agoraChave()
  const futuros = agendamentos.filter((a) => a.status === 'confirmado' && `${a.data}T${a.hora}` >= agora).sort(ordenar)
  const passados = agendamentos.filter((a) => !futuros.includes(a)).sort(ordenar).reverse()

  const cancelar = (id: string, perguntar = true) => {
    if (perguntar && !window.confirm('Cancelar este horário? Ele fica livre para outro cliente.')) return false
    atualizar((e) => ({ ...e, agendamentos: e.agendamentos.map((a) => (a.id === id ? { ...a, status: 'cancelado' as const } : a)) }))
    return true
  }

  const remarcar = (id: string, servicoId: string) => {
    if (!window.confirm('Remarcar? O horário atual será liberado e você escolhe um novo.')) return
    cancelar(id, false)
    navegar('agendar', servicoId)
  }

  return (
    <div className="tela">
      <h1 className="titulo titulo--pagina">Meus horários</h1>

      {futuros.length === 0 && (
        <div className="cartao vazio-cartao">
          <Icone nome="agenda" tam={36} />
          <p>Você ainda não tem horário marcado.</p>
          <button className="botao botao--principal" onClick={() => navegar('agendar')}>Agendar agora</button>
        </div>
      )}

      {futuros.map((a) => {
        const s = servicos.find((x) => x.id === a.servicoId)
        const p = profissionais.find((x) => x.id === a.profissionalId)
        return (
          <section key={a.id} className="cartao cartao--destaque">
            <p className="sobretitulo capitalizar">{dataLonga(a.data)}</p>
            <h3>{a.hora} · {s?.nome}</h3>
            <p className="suave">com {p?.nome} · {s && moeda(s.preco)}</p>
            <div className="acoes">
              <button className="botao botao--fantasma pequeno" onClick={() => remarcar(a.id, a.servicoId)}>Remarcar</button>
              <button className="botao botao--perigo pequeno" onClick={() => cancelar(a.id)}>Cancelar</button>
            </div>
          </section>
        )
      })}

      {passados.length > 0 && <h2 className="secao">Histórico</h2>}
      <div className="lista">
        {passados.map((a) => {
          const s = servicos.find((x) => x.id === a.servicoId)
          return (
            <div key={a.id} className="item item--estatico">
              <div><strong>{s?.nome}</strong><span className="suave capitalizar">{dataLonga(a.data)} · {a.hora}</span></div>
              <span className={`badge ${a.status === 'cancelado' ? 'badge--off' : ''}`}>{a.status === 'cancelado' ? 'Cancelado' : 'Realizado'}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
