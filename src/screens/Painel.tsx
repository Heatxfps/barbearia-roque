/**
 * Painel da barbearia (visão do dono / profissionais).
 * Na apresentação, serve para mostrar ao dono o que ELE ganha com o app.
 * Os números são de demonstração, misturados com os agendamentos feitos no protótipo.
 */
import { useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { moeda, profissionais, servicos } from '../data'
import { iso } from '../agenda'
import { useEstado } from '../store'

const DEMO = [
  { hora: '09:00', cliente: 'João P.', servicoId: 'combo', prof: 'p1' },
  { hora: '09:30', cliente: 'Marcos A.', servicoId: 'barba', prof: 'p2' },
  { hora: '10:00', cliente: 'Felipe R.', servicoId: 'corte', prof: 'p3' },
  { hora: '10:40', cliente: 'Thiago L.', servicoId: 'corte', prof: 'p1' },
  { hora: '11:00', cliente: 'André S.', servicoId: 'combo', prof: 'p2' },
  { hora: '14:00', cliente: 'Bruno M.', servicoId: 'platinado', prof: 'p3' },
  { hora: '15:30', cliente: 'Rafael C.', servicoId: 'corte', prof: 'p1' },
  { hora: '16:00', cliente: 'Diego F.', servicoId: 'sobrancelha', prof: 'p2' },
  { hora: '17:30', cliente: 'Lucas V.', servicoId: 'combo', prof: 'p1' },
]

const RETORNO = [
  { cliente: 'Gustavo H.', dias: 24, servico: 'Corte' },
  { cliente: 'Paulo E.', dias: 31, servico: 'Corte + Barba' },
  { cliente: 'Vinícius T.', dias: 27, servico: 'Corte' },
]

export default function Painel({ navegar }: { navegar: Navegar }) {
  const { agendamentos } = useEstado()
  const [filtro, setFiltro] = useState('todos')
  const hoje = iso(new Date())

  const reais = agendamentos
    .filter((a) => a.status === 'confirmado' && a.data === hoje)
    .map((a) => ({ hora: a.hora, cliente: a.cliente + ' (app)', servicoId: a.servicoId, prof: a.profissionalId }))
  const dia = [...DEMO, ...reais].sort((a, b) => a.hora.localeCompare(b.hora))
  const lista = filtro === 'todos' ? dia : dia.filter((d) => d.prof === filtro)
  const faturamento = dia.reduce((t, d) => t + (servicos.find((s) => s.id === d.servicoId)?.preco ?? 0), 0)

  return (
    <div className="tela">
      <header className="topo">
        <button className="icone-botao" onClick={() => navegar('perfil')} aria-label="Voltar"><Icone nome="voltar" /></button>
        <h1 className="topo__titulo">Painel da barbearia</h1>
        <span style={{ width: 40 }} />
      </header>
      <p className="aviso">Dados de demonstração</p>

      <div className="metricas">
        <div className="metrica"><span className="suave">Atendimentos hoje</span><strong>{dia.length}</strong></div>
        <div className="metrica"><span className="suave">Faturamento previsto</span><strong>{moeda(faturamento)}</strong></div>
        <div className="metrica"><span className="suave">Faltas no mês</span><strong>2 <small className="positivo">−71%</small></strong></div>
        <div className="metrica"><span className="suave">Agendados pelo app</span><strong>68%</strong></div>
      </div>

      <h2 className="secao">Agenda de hoje</h2>
      <div className="filtros">
        <button className={filtro === 'todos' ? 'ativo' : ''} onClick={() => setFiltro('todos')}>Todos</button>
        {profissionais.filter((p) => p.id !== 'qualquer').map((p) => (
          <button key={p.id} className={filtro === p.id ? 'ativo' : ''} onClick={() => setFiltro(p.id)}>{p.nome}</button>
        ))}
      </div>
      <div className="linha-tempo">
        {lista.map((d, i) => {
          const s = servicos.find((x) => x.id === d.servicoId)
          const p = profissionais.find((x) => x.id === d.prof)
          return (
            <div key={i} className="evento">
              <span className="evento__hora">{d.hora}</span>
              <div className="evento__corpo">
                <strong>{d.cliente}</strong>
                <span className="suave">{s?.nome} · {p?.nome}</span>
              </div>
              <span className="evento__valor">{s && moeda(s.preco)}</span>
            </div>
          )
        })}
      </div>

      <h2 className="secao">Clientes para chamar de volta</h2>
      <p className="suave pequeno">Clientes há mais de 20 dias sem cortar. O app manda o lembrete sozinho.</p>
      <div className="lista">
        {RETORNO.map((r) => (
          <div key={r.cliente} className="item item--estatico">
            <div><strong>{r.cliente}</strong><span className="suave">Último: {r.servico} · há {r.dias} dias</span></div>
            <span className="badge">Lembrete enviado</span>
          </div>
        ))}
      </div>
    </div>
  )
}
