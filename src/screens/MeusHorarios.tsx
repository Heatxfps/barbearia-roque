import { useCallback, useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import Entrar from '../components/Entrar'
import { api, type Agendamento, type Espera, type Pedido } from '../api'
import { useApp } from '../contexto'
import { dataCurta, dataLonga, hora, moeda } from '../util'
import { Ornamento } from './Inicio'

const ROTULO: Record<string, string> = { concluido: 'Realizado', cancelado: 'Cancelado', faltou: 'Não compareceu', confirmado: 'Confirmado' }

export default function MeusHorarios({ navegar }: { navegar: Navegar }) {
  const { cliente, avisar, barbearia, recarregar, confirmar } = useApp()
  const [dados, setDados] = useState<{ agora: string; agendamentos: Agendamento[] } | null>(null)
  const [espera, setEspera] = useState<Espera[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])

  const carregar = useCallback(() => {
    api.meusAgendamentos().then(setDados).catch((e) => avisar(e.message, 'erro'))
    api.minhaEspera().then(setEspera).catch(() => setEspera([]))
    api.meusPedidos().then(setPedidos).catch(() => setPedidos([]))
  }, [avisar])
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
  const pedidosAbertos = pedidos.filter((o) => o.status === 'novo' || o.status === 'separado')

  const cancelar = async (a: Agendamento, remarcar = false) => {
    const pergunta = remarcar ? 'Remarcar? O horário atual será liberado e você escolhe um novo.' : 'Cancelar este horário? Ele fica livre para outro cliente.'
    if (!(await confirmar(pergunta, { botao: remarcar ? 'Remarcar' : 'Cancelar horário', perigo: !remarcar }))) return
    try {
      await api.cancelar(a.id)
      if (remarcar) navegar('agendar', { servicoId: a.servicoId, profissionalId: a.profissionalId })
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

      {espera.length > 0 && <Ornamento texto="Lista de espera" />}
      {espera.map((e) => (
        <div key={e.id} className="item item--estatico">
          <div><strong className="capitalizar">{dataLonga(e.data)}</strong><span className="suave">{e.servico} · {e.profissional}{e.avisadoEm ? ' · vaga aberta, corra!' : ' · aguardando vaga'}</span></div>
          <button className="chip" onClick={async () => { await api.sairEspera(e.id); avisar('Você saiu da lista de espera'); carregar() }}>Sair</button>
        </div>
      ))}

      {pedidosAbertos.length > 0 && <Ornamento texto="Pedidos da loja" />}
      {pedidosAbertos.map((o) => (
        <div key={o.id} className="item item--estatico">
          <div>
            <strong>{o.itens.map((i) => `${i.qtd}× ${i.nome}`).join(', ')}</strong>
            <span className="suave">{moeda(o.total)} · pedido em {dataCurta(o.criadoEm)} · pague na retirada</span>
          </div>
          {o.status === 'separado'
            ? <span className="badge">Pronto para retirar</span>
            : <button className="chip" onClick={async () => { try { await api.cancelarPedido(o.id); avisar('Pedido cancelado'); carregar() } catch (er) { avisar((er as Error).message, 'erro') } }}>Cancelar</button>}
        </div>
      ))}

      {passados.length > 0 && <Ornamento texto="Histórico" />}
      <div className="lista">
        {passados.map((a) => (
          <div key={a.id} className="item item--estatico">
            <div><strong>{a.servico}</strong><span className="suave capitalizar">{dataLonga(a.inicio)} · {hora(a.inicio)} · {a.profissional}</span></div>
            {a.status === 'concluido' && !a.avaliacao
              ? <a className="chip chip--ok" href={`#avaliar/${a.id}`}>★ Avaliar</a>
              : <span className={`badge ${a.status !== 'concluido' ? 'badge--off' : ''}`}>{a.avaliacao ? '★'.repeat(a.avaliacao) : ROTULO[a.status] ?? a.status}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
