import { useCallback, useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import Entrar from '../components/Entrar'
import { api, type Agendamento } from '../api'
import { useApp } from '../contexto'
import { dataLonga, hora, moeda } from '../util'

const ROTULO: Record<string, string> = { concluido: 'Realizado', cancelado: 'Cancelado', faltou: 'Não compareceu', confirmado: 'Confirmado' }

export default function MeusHorarios({ navegar }: { navegar: Navegar }) {
  const { cliente, avisar, barbearia, recarregar } = useApp()
  const [dados, setDados] = useState<{ agora: string; agendamentos: Agendamento[] } | null>(null)

  const carregar = useCallback(() => { api.meusAgendamentos().then(setDados).catch((e) => avisar(e.message, 'erro')) }, [avisar])
  useEffect(() => { if (cliente) carregar() }, [cliente, carregar])

  if (!cliente) {
    return (
      <div className="tela">
        <h1 className="titulo titulo--pagina">Meus horários</h1>
        <section className="cartao">
          <h3>Entre para ver seus horários</h3>
          <Entrar aoEntrar={() => {}} />
        </section>
      </div>
    )
  }

  const futuros = (dados?.agendamentos ?? []).filter((a) => a.status === 'confirmado' && a.inicio >= dados!.agora).sort((a, b) => a.inicio.localeCompare(b.inicio))
  const passados = (dados?.agendamentos ?? []).filter((a) => !futuros.includes(a))

  const cancelar = async (a: Agendamento, remarcar = false) => {
    const pergunta = remarcar ? 'Remarcar? O horário atual será liberado e você escolhe um novo.' : 'Cancelar este horário? Ele fica livre para outro cliente.'
    if (!window.confirm(pergunta)) return
    try {
      await api.cancelar(a.id)
      if (remarcar) navegar('agendar', a.servicoId)
      else { avisar('Horário cancelado'); carregar(); recarregar() }
    } catch (e) { avisar((e as Error).message, 'erro') }
  }

  return (
    <div className="tela">
      <h1 className="titulo titulo--pagina">Meus horários</h1>

      {!dados && <div className="cartao cartao--esqueleto" />}

      {dados && futuros.length === 0 && (
        <div className="cartao vazio-cartao">
          <Icone nome="agenda" tam={36} />
          <p>Você ainda não tem horário marcado.</p>
          <button className="botao botao--principal" onClick={() => navegar('agendar')}>Agendar agora</button>
        </div>
      )}

      {futuros.map((a) => (
        <section key={a.id} className="cartao cartao--destaque">
          <p className="sobretitulo capitalizar">{dataLonga(a.inicio)}</p>
          <h3>{hora(a.inicio)} · {a.servico}</h3>
          <p className="suave">com {a.profissional} · {moeda(a.preco)}</p>
          <div className="acoes">
            <button className="botao botao--fantasma pequeno" onClick={() => cancelar(a, true)}>Remarcar</button>
            <button className="botao botao--perigo pequeno" onClick={() => cancelar(a)}>Cancelar</button>
          </div>
        </section>
      ))}
      {futuros.length > 0 && barbearia && (
        <p className="suave pequeno">Cancelamentos pelo app até {barbearia.antecedenciaCancelarMin / 60}h antes do horário.</p>
      )}

      {passados.length > 0 && <h2 className="secao">Histórico</h2>}
      <div className="lista">
        {passados.map((a) => (
          <div key={a.id} className="item item--estatico">
            <div><strong>{a.servico}</strong><span className="suave capitalizar">{dataLonga(a.inicio)} · {hora(a.inicio)} · {a.profissional}</span></div>
            <span className={`badge ${a.status !== 'concluido' ? 'badge--off' : ''}`}>{ROTULO[a.status] ?? a.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
