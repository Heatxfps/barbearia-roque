/** Avaliações dos clientes: média da casa, de cada barbeiro e os comentários. */
import { useEffect, useState } from 'react'
import { api, type ResumoAvaliacoes } from '../../api'
import { dataCurta, foto, primeiroNome } from '../../util'

const virgula = (n: number) => n.toFixed(1).replace('.', ',')
const estrelas = (n: number) => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n))

export default function Avaliacoes() {
  const [r, setR] = useState<ResumoAvaliacoes | null>(null)
  const [quem, setQuem] = useState('todos')
  const [so, setSo] = useState<'todas' | 'comentario' | 'baixas'>('todas')
  useEffect(() => { api.painel.avaliacoes().then(setR).catch(() => setR(null)) }, [])

  if (!r) return <div className="cartao cartao--esqueleto" />
  if (r.total === 0) return <p className="vazio">O app pede a nota 1 hora depois de cada atendimento concluído. As primeiras avaliações aparecem aqui.</p>

  const recentes = r.recentes
    .filter((v) => quem === 'todos' || v.profissional === quem)
    .filter((v) => so === 'todas' || (so === 'comentario' ? !!v.comentario : v.nota <= 3))

  return (
    <div className="painel__grade">
      <section className="painel__col">
        <div className="cartao avaliacoes">
          <div className="avaliacoes__media">
            <strong>{virgula(r.media)}</strong>
            <div><span className="estrelas-txt">{estrelas(r.media)}</span><span className="suave pequeno">{r.total} avaliações</span></div>
          </div>
          {r.porProfissional.map((p) => (
            <button key={p.id} className={`linha-entre avaliacoes__prof ${quem === p.nome ? 'ativo' : ''}`} onClick={() => setQuem(quem === p.nome ? 'todos' : p.nome)}>
              <span className="filtro-foto">{p.foto && <img src={foto(p.foto, 'avatar')} alt="" />}{p.nome}</span>
              <span><strong>{virgula(p.media)}</strong> <span className="suave">({p.n})</span></span>
            </button>
          ))}
          <p className="suave pequeno">Toque num barbeiro para ver só as avaliações dele.</p>
        </div>
      </section>
      <section className="painel__col">
        <div className="filtros">
          <button className={so === 'todas' ? 'ativo' : ''} onClick={() => setSo('todas')}>Todas</button>
          <button className={so === 'comentario' ? 'ativo' : ''} onClick={() => setSo('comentario')}>Com comentário</button>
          <button className={so === 'baixas' ? 'ativo' : ''} onClick={() => setSo('baixas')}>Notas até 3</button>
        </div>
        {quem !== 'todos' && <p className="suave pequeno">Mostrando: {quem} · <button className="link" onClick={() => setQuem('todos')}>ver todos</button></p>}
        {!recentes.length && <p className="vazio">Nada por aqui.</p>}
        <div className="lista">
          {recentes.map((v) => (
            <div key={v.id} className="item item--estatico avaliacao">
              <div>
                <span className="estrelas-txt">{'★'.repeat(v.nota)}<span className="suave">{'★'.repeat(5 - v.nota)}</span></span>
                {v.comentario && <p className="avaliacao__texto">“{v.comentario}”</p>}
                <span className="suave pequeno">{primeiroNome(v.cliente)} sobre {primeiroNome(v.profissional)} · {dataCurta(v.criadoEm)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
