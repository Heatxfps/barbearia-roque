/** Resultados financeiros (só o dono): dia, mês, barbeiros e serviços. */
import { useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type Resumo } from '../../api'
import { useApp } from '../../contexto'
import { dataIso, lerData, moeda } from '../../util'

const pct = (v: number) => `${Math.round(v * 100)}%`
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

export default function Resultados() {
  const { avisar } = useApp()
  const [data, setData] = useState(dataIso(new Date()))
  const [r, setR] = useState<Resumo | null>(null)
  useEffect(() => { setR(null); api.painel.resumo(data).then(setR).catch((e) => avisar(e.message, 'erro')) }, [data, avisar])

  const mudarMes = (n: number) => { const d = lerData(data); d.setDate(1); d.setMonth(d.getMonth() + n); setData(dataIso(d)) }
  const d = lerData(data)
  const ehHoje = data === dataIso(new Date())

  return (
    <div className="painel__col">
      <div className="seletor-dia">
        <button className="icone-botao" onClick={() => mudarMes(-1)} aria-label="Mês anterior"><Icone nome="voltar" /></button>
        <div className="centro"><strong className="capitalizar">{MESES[d.getMonth()]} de {d.getFullYear()}</strong><span className="suave pequeno">{ehHoje ? 'mês atual' : ''}</span></div>
        <button className="icone-botao" onClick={() => mudarMes(1)} aria-label="Próximo mês"><Icone nome="seta" /></button>
      </div>
      {!r ? <div className="cartao cartao--esqueleto" /> : (
        <>
          {ehHoje && (
            <div className="metricas">
              <div className="metrica"><span className="suave">Hoje · atendimentos</span><strong>{r.hoje.atendimentos}</strong></div>
              <div className="metrica"><span className="suave">Hoje · previsto</span><strong>{moeda(r.hoje.previsto)}</strong></div>
              <div className="metrica"><span className="suave">Hoje · recebido</span><strong>{moeda(r.hoje.recebido)}</strong></div>
            </div>
          )}
          <h2 className="secao">No mês</h2>
          <div className="metricas">
            <div className="metrica metrica--destaque"><span className="suave">Faturado</span><strong>{moeda(r.mes.faturado)}</strong></div>
            <div className="metrica"><span className="suave">Atendimentos concluídos</span><strong>{r.mes.concluidos}</strong></div>
            <div className="metrica"><span className="suave">Ticket médio</span><strong>{moeda(r.mes.concluidos ? r.mes.faturado / r.mes.concluidos : 0)}</strong></div>
            <div className="metrica"><span className="suave">Faltas</span><strong>{r.mes.faltas} <small className="suave">({pct(r.mes.taxaFalta)})</small></strong></div>
            <div className="metrica"><span className="suave">Cancelados</span><strong>{r.mes.cancelados}</strong></div>
            <div className="metrica"><span className="suave">Marcados pelo app</span><strong>{pct(r.mes.percentualApp)}</strong></div>
          </div>

          <div className="painel__grade">
            <section className="painel__col">
              <h2 className="secao">Por barbeiro</h2>
              {r.porProfissional.length === 0 ? <p className="vazio">Sem atendimentos concluídos no mês.</p> : (
                <div className="barras">
                  {r.porProfissional.map((p) => {
                    const max = Math.max(...r.porProfissional.map((x) => x.total))
                    return (
                      <div key={p.nome} className="barra-linha">
                        <span>{p.nome}<small className="suave"> · {p.n}</small></span>
                        <div className="barra"><div style={{ width: `${(p.total / max) * 100}%` }} /></div>
                        <strong>{moeda(p.total)}</strong>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
            <section className="painel__col">
              <h2 className="secao">Serviços mais vendidos</h2>
              <div className="lista">
                {r.porServico.map((s, i) => (
                  <div key={s.nome} className="item item--estatico"><div><strong>{i + 1}. {s.nome}</strong></div><span className="suave">{s.n}×</span></div>
                ))}
              </div>
            </section>
          </div>
          <p className="suave pequeno">Faturado = atendimentos marcados como concluídos (com o desconto de aniversário já descontado).</p>
        </>
      )}
    </div>
  )
}
