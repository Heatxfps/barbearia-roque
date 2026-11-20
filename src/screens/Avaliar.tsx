/**
 * Avaliação pós-atendimento. Abre pelo link do WhatsApp (/#avaliar/ID) ou pelo histórico.
 * A nota fica no painel; o convite para avaliar no Google aparece para todo mundo
 * (o Google não permite convidar só quem deu nota alta).
 */
import { useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api, type AvaliacaoInfo } from '../api'
import { useApp } from '../contexto'
import { dataLonga, foto, hora, primeiroNome } from '../util'

const FRASES = ['', 'Poxa, o que deu errado?', 'O que podemos melhorar?', 'Bom! O que faltou para ser ótimo?', 'Que bom! Quer contar algum detalhe?', 'Que demais! Quer deixar um recado?']

export default function Avaliar({ id, navegar }: { id: string; navegar: Navegar }) {
  const { avisar } = useApp()
  const [info, setInfo] = useState<AvaliacaoInfo | null>(null)
  const [erro, setErro] = useState('')
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState(false)

  useEffect(() => { api.avaliacao(id).then(setInfo).catch((e) => setErro(e.message)) }, [id])

  const enviar = async () => {
    setEnviando(true)
    try { await api.avaliar(id, nota, comentario.trim()); setFeito(true) } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(false) }
  }

  const voltar = () => { history.replaceState(null, '', location.pathname); navegar('inicio') }

  if (erro) {
    return (
      <div className="tela tela--centro">
        <h1 className="titulo-editorial pequeno-ed">Link expirado</h1>
        <p className="suave centro">{erro}</p>
        <button className="botao botao--principal" onClick={voltar}>Ir para o app</button>
      </div>
    )
  }
  if (!info) return <div className="carregando" aria-label="Carregando" />

  const jaAvaliado = info.nota !== null
  const google = info.googleAvaliacao

  if (feito || jaAvaliado) {
    return (
      <div className="tela tela--centro avaliar">
        <div className="sucesso"><Icone nome="check" tam={44} /></div>
        <h1 className="titulo-editorial pequeno-ed">Obrigado, {info.cliente}!</h1>
        <p className="suave centro">{jaAvaliado && !feito ? 'Esse atendimento já foi avaliado.' : `Sua avaliação chegou para o ${primeiroNome(info.profissional)} e para a Roque.`}</p>
        {google && (
          <div className="cartao avaliar__google">
            <p className="suave centro">Pode deixar sua opinião também no Google? Ajuda muito quem procura barbearia em Nova Venécia.</p>
            <a className="botao botao--principal" href={google} target="_blank" rel="noreferrer">★ Avaliar no Google</a>
          </div>
        )}
        <button className="botao botao--fantasma" onClick={voltar}>Voltar ao app</button>
      </div>
    )
  }

  return (
    <div className="tela tela--centro avaliar">
      {info.foto ? <img className="avaliar__foto" src={foto(info.foto, 'avatar')} alt="" /> : null}
      <p className="sobretitulo">Como foi?</p>
      <h1 className="titulo-editorial pequeno-ed centro">{info.servico} com {primeiroNome(info.profissional)}</h1>
      <p className="suave capitalizar">{dataLonga(info.inicio)} · {hora(info.inicio)}</p>

      <div className="estrelas" role="radiogroup" aria-label="Nota">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} role="radio" aria-checked={nota === n} aria-label={`${n} de 5`} className={`estrela ${n <= nota ? 'estrela--on' : ''}`} onClick={() => setNota(n)}>★</button>
        ))}
      </div>

      {nota > 0 && (
        <label className="campo avaliar__comentario">
          <span>{FRASES[nota]}</span>
          <textarea value={comentario} onChange={(e) => setComentario(e.target.value.slice(0, 500))} rows={3} placeholder="Opcional" />
        </label>
      )}
      <button className="botao botao--principal" disabled={!nota || enviando} onClick={enviar}>{enviando ? 'Enviando…' : 'Enviar avaliação'}</button>
    </div>
  )
}
