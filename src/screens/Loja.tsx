/**
 * Loja: o cliente reserva produtos e retira na barbearia (paga na retirada).
 * Sem pagamento online de propósito: simples para o cliente e para o balcão.
 */
import { useEffect, useMemo, useState } from 'react'
import type { Navegar } from '../App'
import Icone from '../components/Icone'
import Entrar from '../components/Entrar'
import { api, type Produto } from '../api'
import { useApp } from '../contexto'
import { foto, moeda } from '../util'

export default function Loja({ navegar }: { navegar: Navegar }) {
  const { cliente, avisar } = useApp()
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  const [carrinho, setCarrinho] = useState<Record<string, number>>({})
  const [obs, setObs] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<number | null>(null)

  useEffect(() => { api.produtos().then(setProdutos).catch((e) => avisar(e.message, 'erro')) }, [avisar])

  const itens = useMemo(() => (produtos ?? []).filter((p) => carrinho[p.id]).map((p) => ({ ...p, qtd: carrinho[p.id] })), [produtos, carrinho])
  const total = itens.reduce((t, i) => t + i.preco * i.qtd, 0)
  const mudar = (id: string, d: number) => setCarrinho((c) => ({ ...c, [id]: Math.max(0, Math.min(10, (c[id] ?? 0) + d)) }))

  const reservar = async () => {
    setEnviando(true)
    try {
      const r = await api.pedir(itens.map((i) => ({ produtoId: i.id, qtd: i.qtd })), obs.trim())
      setFeito(r.total); setCarrinho({})
    } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(false) }
  }

  if (feito !== null) {
    return (
      <div className="tela tela--centro">
        <div className="sucesso"><Icone nome="check" tam={44} /></div>
        <h1 className="titulo-editorial pequeno-ed">Pedido reservado!</h1>
        <p className="suave centro">Total de {moeda(feito)}, pago na retirada.<br />Avisamos no WhatsApp quando estiver separado.</p>
        <button className="botao botao--principal" onClick={() => navegar('agenda')}>Ver meus pedidos</button>
        <button className="botao botao--fantasma" onClick={() => navegar('inicio')}>Voltar ao início</button>
      </div>
    )
  }

  return (
    <div className="tela">
      <header className="topo">
        <button className="icone-botao" onClick={() => navegar('inicio')} aria-label="Voltar"><Icone nome="voltar" /></button>
        <h1 className="topo__titulo">Loja da Roque</h1>
        <span style={{ width: 40 }} />
      </header>
      <p className="suave">Reserve pelo app e retire na barbearia. O pagamento é na hora da retirada.</p>

      <div className="produtos">
        {!produtos && Array.from({ length: 4 }, (_, i) => <div key={i} className="produto cartao--esqueleto" />)}
        {produtos?.length === 0 && <p className="vazio">Nenhum produto disponível no momento.</p>}
        {produtos?.map((p) => (
          <div key={p.id} className={`produto ${carrinho[p.id] ? 'produto--sel' : ''}`}>
            <div className="produto__foto">{p.foto ? <img src={foto(p.foto)} alt="" loading="lazy" /> : <img className="produto__marca" src={`${import.meta.env.BASE_URL}logo-partes/r-recorte.png`} alt="" />}</div>
            <div className="produto__info">
              <strong>{p.nome}</strong>
              <span className="suave">{p.descricao}</span>
              <span className="produto__preco">{moeda(p.preco)}</span>
            </div>
            <div className="qtd">
              {carrinho[p.id] ? (
                <>
                  <button onClick={() => mudar(p.id, -1)} aria-label={`Tirar um ${p.nome}`}>−</button>
                  <span>{carrinho[p.id]}</span>
                  <button onClick={() => mudar(p.id, 1)} aria-label={`Mais um ${p.nome}`}>+</button>
                </>
              ) : <button className="qtd__add" onClick={() => mudar(p.id, 1)}>Adicionar</button>}
            </div>
          </div>
        ))}
      </div>

      {itens.length > 0 && (
        <section className="cartao resumo">
          {itens.map((i) => <div key={i.id} className="linha-entre"><span className="suave">{i.qtd}× {i.nome}</span><strong>{moeda(i.preco * i.qtd)}</strong></div>)}
          <hr />
          <div className="linha-entre total"><span>Total</span><strong>{moeda(total)}</strong></div>
          <label className="campo"><span>Observação (opcional)</span><input value={obs} onChange={(e) => setObs(e.target.value.slice(0, 200))} placeholder="Ex.: retiro no meu horário de sábado" /></label>
          {cliente
            ? <button className="botao botao--principal" disabled={enviando} onClick={reservar}>{enviando ? 'Reservando…' : 'Reservar para retirar'}</button>
            : <><h3>Quase lá: identifique-se</h3><Entrar textoBotao="Continuar" aoEntrar={() => avisar('Pronto! Agora é só reservar.')} /></>}
        </section>
      )}
    </div>
  )
}
