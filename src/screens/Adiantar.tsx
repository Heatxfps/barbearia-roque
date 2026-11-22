/**
 * Convite "pode adiantar". Abre pelo link do WhatsApp (/#adiantar/ID): abriu um espaço na agenda
 * do barbeiro hoje e o cliente pode vir mais cedo. Um toque confirma.
 */
import { useEffect, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import { api, type ConviteAdiantar } from '../api'
import { useApp } from '../contexto'
import { foto, hora, primeiroNome } from '../util'

export default function Adiantar({ id, navegar }: { id: string; navegar: Navegar }) {
  const { avisar, barbearia } = useApp()
  const [info, setInfo] = useState<ConviteAdiantar | null>(null)
  const [erro, setErro] = useState('')
  const [feito, setFeito] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => { api.convite(id).then(setInfo).catch((e) => setErro(e.message)) }, [id])
  const voltar = (destino: 'inicio' | 'agenda' = 'inicio') => { history.replaceState(null, '', location.pathname); navegar(destino) }

  const aceitar = async () => {
    setEnviando(true)
    try { const r = await api.adiantar(id); setFeito(r.inicio) } catch (e) { avisar((e as Error).message, 'erro'); api.convite(id).then(setInfo).catch(() => {}) } finally { setEnviando(false) }
  }

  if (erro) {
    return (
      <div className="tela tela--centro">
        <h1 className="titulo-editorial pequeno-ed">Convite não encontrado</h1>
        <p className="suave centro">{erro}</p>
        <button className="botao botao--principal" onClick={() => voltar()}>Ir para o app</button>
      </div>
    )
  }
  if (!info) return <div className="carregando" aria-label="Carregando" />

  if (feito) {
    return (
      <div className="tela tela--centro avaliar">
        <div className="sucesso"><Icone nome="check" tam={44} /></div>
        <h1 className="titulo-editorial pequeno-ed centro">Fechado, {info.cliente}! Te esperamos às {hora(feito)}.</h1>
        <p className="suave centro">{info.servico} com {primeiroNome(info.profissional)}. O {primeiroNome(info.profissional)} já está sabendo.</p>
        {barbearia?.endereco && <p className="suave pequeno centro">📍 {barbearia.endereco}</p>}
        <button className="botao botao--fantasma" onClick={() => voltar('agenda')}>Ver meus horários</button>
      </div>
    )
  }

  const valendo = !!info.para
  return (
    <div className="tela tela--centro avaliar">
      {info.foto ? <img className="avaliar__foto" src={foto(info.foto, 'avatar')} alt="" /> : null}
      <p className="sobretitulo">Abriu um espaço hoje</p>
      <h1 className="titulo-editorial pequeno-ed centro">{info.servico} com {primeiroNome(info.profissional)}</h1>
      {valendo ? (
        <>
          <div className="adiantar__troca" aria-label={`de ${hora(info.inicio)} para ${hora(info.para!)}`}>
            <span className="adiantar__antes">{hora(info.inicio)}</span>
            <Icone nome="seta" tam={22} />
            <span className="adiantar__depois">{hora(info.para!)}</span>
          </div>
          <p className="suave centro">Quer vir mais cedo, {info.cliente}? Se não der, tudo bem: seu horário das {hora(info.inicio)} continua garantido.</p>
          <button className="botao botao--principal" disabled={enviando} onClick={aceitar}>{enviando ? 'Confirmando…' : `Quero ir às ${hora(info.para!)}`}</button>
          <button className="botao botao--fantasma" onClick={() => voltar()}>Fico com {hora(info.inicio)}</button>
        </>
      ) : (
        <>
          <p className="suave centro">{info.status === 'confirmado' ? `Esse convite já não está valendo, mas seu horário das ${hora(info.inicio)} continua garantido.` : 'Esse horário não está mais ativo.'}</p>
          <button className="botao botao--principal" onClick={() => voltar('agenda')}>Ver meus horários</button>
        </>
      )}
    </div>
  )
}
