/**
 * Clientes: busca, quem sumiu (chamar de volta) e aniversariantes da semana.
 */
import { useEffect, useState } from 'react'
import { api, type Aniversariante, type ClientePainel, type Retorno } from '../../api'
import { useApp } from '../../contexto'
import { aniversarioTxt, dataCurta, formatarTelefone, linkWhats, primeiroNome } from '../../util'

type Vista = 'todos' | 'retorno' | 'aniversario'

export default function Clientes() {
  const { barbearia } = useApp()
  const [vista, setVista] = useState<Vista>('todos')
  const [busca, setBusca] = useState('')
  const [lista, setLista] = useState<ClientePainel[] | null>(null)
  const [retorno, setRetorno] = useState<Retorno[] | null>(null)
  const [aniv, setAniv] = useState<Aniversariante[] | null>(null)

  useEffect(() => { const t = setTimeout(() => api.painel.clientes(busca).then(setLista).catch(() => setLista([])), 250); return () => clearTimeout(t) }, [busca])
  useEffect(() => {
    api.painel.retorno().then(setRetorno).catch(() => setRetorno([]))
    api.painel.aniversariantes().then(setAniv).catch(() => setAniv([]))
  }, [])

  const casa = barbearia?.nome ?? 'Roque'
  const vistas: [Vista, string, number | undefined][] = [
    ['todos', 'Todos', lista?.length],
    ['retorno', 'Chamar de volta', retorno?.length],
    ['aniversario', 'Aniversariantes', aniv?.length],
  ]

  return (
    <div className="painel__col">
      <div className="filtros">
        {vistas.map(([id, rot, n]) => (
          <button key={id} className={vista === id ? 'ativo' : ''} onClick={() => setVista(id)}>{rot}{n ? ` (${n})` : ''}</button>
        ))}
      </div>

      {vista === 'todos' && (
        <>
          <label className="campo"><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome ou telefone" /></label>
          <div className="lista">
            {lista?.map((c) => (
              <a key={c.id} className="item" href={linkWhats(c.telefone)} target="_blank" rel="noreferrer">
                <div>
                  <strong>{c.nome}</strong>
                  <span className="suave">{formatarTelefone(c.telefone)} · {c.visitas} visitas{c.faltas ? ` · ${c.faltas} falta(s)` : ''}</span>
                </div>
                <span className="suave pequeno">{c.ultimaVisita ? `última ${dataCurta(c.ultimaVisita)}` : 'novo'}</span>
              </a>
            ))}
          </div>
        </>
      )}

      {vista === 'retorno' && (
        <>
          <p className="suave pequeno">Há 20 dias ou mais sem cortar e sem horário marcado. O app já manda um lembrete sozinho; toque para chamar no WhatsApp com uma mensagem pronta.</p>
          <div className="lista">
            {retorno?.length === 0 && <p className="vazio">Ninguém sumido. 👏</p>}
            {retorno?.map((r) => (
              <a key={r.id} className="item" href={linkWhats(r.telefone, `Fala, ${primeiroNome(r.nome)}! Bora marcar aquele corte na ${casa}?`)} target="_blank" rel="noreferrer">
                <div><strong>{r.nome}</strong><span className="suave">há {r.dias} dias · última visita {dataCurta(r.ultimaVisita)}</span></div>
                <span className={`badge ${r.avisado ? '' : 'badge--off'}`}>{r.avisado ? 'Lembrete enviado' : 'Na fila'}</span>
              </a>
            ))}
          </div>
        </>
      )}

      {vista === 'aniversario' && (
        <>
          <p className="suave pequeno">Próximos 7 dias. No dia, o cliente recebe o desconto de aniversário automaticamente no WhatsApp.</p>
          <div className="lista">
            {aniv?.length === 0 && <p className="vazio">Nenhum aniversário nesta semana.</p>}
            {aniv?.map((c) => (
              <a key={c.id} className="item" href={linkWhats(c.telefone, `Feliz aniversário, ${primeiroNome(c.nome)}! 🎂 Um abraço de toda a equipe da ${casa}.`)} target="_blank" rel="noreferrer">
                <div><strong>🎂 {c.nome}</strong><span className="suave">{aniversarioTxt(c.aniversario)}</span></div>
                <span className="badge">{c.emDias === 0 ? 'Hoje' : c.emDias === 1 ? 'Amanhã' : `em ${c.emDias} dias`}</span>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
