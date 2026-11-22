/**
 * Avaliações dos clientes.
 * Em cima, uma faixa com a média, a distribuição das notas e cada barbeiro;
 * embaixo, os comentários ocupando a largura toda.
 */
import { useEffect, useState } from 'react'
import { api, type ResumoAvaliacoes } from '../../api'
import { dataCurta, foto, primeiroNome } from '../../util'

const virgula = (n: number) => n.toFixed(1).replace('.', ',')
const estrelas = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))
type Filtro = 'todas' | 'comentario' | 'baixas'

export default function Avaliacoes() {
  const [r, setR] = useState<ResumoAvaliacoes | null>(null)
  const [quem, setQuem] = useState('todos')
  const [so, setSo] = useState<Filtro>('todas')
  useEffect(() => { api.painel.avaliacoes().then(setR).catch(() => setR(null)) }, [])

  if (!r) return <div className="cartao cartao--esqueleto" />
  if (r.total === 0) return <p className="vazio">O app pede a nota 1 hora depois de cada atendimento concluído. As primeiras avaliações aparecem aqui.</p>

  const maxDist = Math.max(1, ...(r.distribuicao ?? []).map((d) => d.n))
  const lista = r.recentes
    .filter((v) => quem === 'todos' || v.profissional === quem)
    .filter((v) => so === 'todas' || (so === 'comentario' ? !!v.comentario : v.nota <= 3))

  return (
    <div className="painel__col">
      <section className="cartao av-resumo">
        <div className="av-resumo__media">
          <strong>{virgula(r.media)}</strong>
          <span className="estrelas-txt">{estrelas(r.media)}</span>
          <span className="suave pequeno">{r.total} avaliações</span>
        </div>

        {r.distribuicao && (
          <div className="av-resumo__dist" aria-label="Distribuição das notas">
            {r.distribuicao.map((d) => (
              <div key={d.nota} className="av-dist">
                <span>{d.nota}★</span>
                <div className="barra"><div style={{ width: `${(d.n / maxDist) * 100}%` }} /></div>
                <span className="suave">{d.n}</span>
              </div>
            ))}
          </div>
        )}

        <div className="av-resumo__barbeiros">
          {r.porProfissional.map((p) => (
            <button key={p.id} className={`av-barbeiro ${quem === p.nome ? 'ativo' : ''}`} onClick={() => setQuem(quem === p.nome ? 'todos' : p.nome)}>
              {p.foto ? <img src={foto(p.foto, 'avatar')} alt="" /> : <span className="avatar avatar--p">{p.nome[0]}</span>}
              <span className="av-barbeiro__nome">{primeiroNome(p.nome)}</span>
              <strong>{virgula(p.media)}</strong>
              <span className="suave pequeno">{p.n} notas</span>
            </button>
          ))}
        </div>
      </section>

      <div className="linha-entre av-filtros">
        <div className="filtros">
          <button className={so === 'todas' ? 'ativo' : ''} onClick={() => setSo('todas')}>Todas</button>
          <button className={so === 'comentario' ? 'ativo' : ''} onClick={() => setSo('comentario')}>Com comentário</button>
          <button className={so === 'baixas' ? 'ativo' : ''} onClick={() => setSo('baixas')}>Notas até 3</button>
        </div>
        {quem !== 'todos' && <button className="chip" onClick={() => setQuem('todos')}>{primeiroNome(quem)} ✕</button>}
      </div>

      {!lista.length && <p className="vazio">Nada por aqui.</p>}
      <div className="av-grade">
        {lista.map((v) => (
          <article key={v.id} className={`av-cartao ${v.nota <= 3 ? 'av-cartao--baixa' : ''}`}>
            <span className="estrelas-txt">{'★'.repeat(v.nota)}<span className="av-apagada">{'★'.repeat(5 - v.nota)}</span></span>
            {v.comentario ? <p className="avaliacao__texto">“{v.comentario}”</p> : <p className="suave pequeno">Sem comentário</p>}
            <span className="suave pequeno">{primeiroNome(v.cliente)} sobre {primeiroNome(v.profissional)} · {dataCurta(v.criadoEm)}</span>
          </article>
        ))}
      </div>
    </div>
  )
}
