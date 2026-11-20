/**
 * Loja no painel: pedidos para separar/entregar (todos) e cadastro de produtos (dono).
 */
import { useCallback, useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type PedidoPainel, type Produto, type StatusPedido, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, foto, formatarTelefone, hora, lerImagem, linkWhats, moeda } from '../../util'

const ROTULO: Record<StatusPedido, string> = { novo: 'Novo', separado: 'Separado', retirado: 'Retirado', cancelado: 'Cancelado' }

export default function LojaPainel({ usuario }: { usuario: UsuarioPainel }) {
  const { avisar, confirmar } = useApp()
  const [todos, setTodos] = useState(false)
  const [pedidos, setPedidos] = useState<PedidoPainel[] | null>(null)
  const carregar = useCallback(() => { api.painel.pedidos(todos).then(setPedidos).catch((e) => avisar(e.message, 'erro')) }, [todos, avisar])
  useEffect(() => { carregar() }, [carregar])

  const mudar = async (o: PedidoPainel, s: StatusPedido) => {
    if (s === 'cancelado' && !(await confirmar(`Cancelar o pedido de ${o.cliente}?`, { botao: 'Cancelar pedido' }))) return
    try { await api.painel.statusPedido(o.id, s); avisar(s === 'separado' ? `${o.cliente} foi avisado no WhatsApp` : `Pedido: ${ROTULO[s].toLowerCase()}`); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }

  return (
    <div className="painel__grade">
      <section className="painel__col">
        <div className="linha-entre">
          <h2 className="secao">Pedidos para retirar</h2>
          <div className="filtros">
            <button className={!todos ? 'ativo' : ''} onClick={() => setTodos(false)}>Em aberto</button>
            <button className={todos ? 'ativo' : ''} onClick={() => setTodos(true)}>Todos</button>
          </div>
        </div>
        {pedidos && !pedidos.length && <p className="vazio">{todos ? 'Nenhum pedido ainda.' : 'Nenhum pedido esperando. 👌'}</p>}
        <div className="lista">
          {pedidos?.map((o) => (
            <div key={o.id} className={`cartao pedido pedido--${o.status}`}>
              <div className="linha-entre">
                <strong>{o.cliente}</strong>
                <span className={`badge ${o.status === 'novo' ? '' : 'badge--off'}`}>{ROTULO[o.status]}</span>
              </div>
              <ul className="pedido__itens">{o.itens.map((i, k) => <li key={k}>{i.qtd}× {i.nome} <span className="suave">{moeda(i.preco * i.qtd)}</span></li>)}</ul>
              {o.observacao && <p className="suave pequeno">Obs.: {o.observacao}</p>}
              <p className="suave pequeno">{dataCurta(o.criadoEm)} às {hora(o.criadoEm)} · {formatarTelefone(o.telefone)} · <strong>{moeda(o.total)}</strong> na retirada</p>
              <div className="evento__acoes">
                {o.status === 'novo' && <button className="chip chip--ok" onClick={() => mudar(o, 'separado')}>✓ Separado (avisa o cliente)</button>}
                {(o.status === 'novo' || o.status === 'separado') && <button className="chip chip--ok" onClick={() => mudar(o, 'retirado')}>Retirado e pago</button>}
                {(o.status === 'novo' || o.status === 'separado') && <button className="chip" onClick={() => mudar(o, 'cancelado')}>Cancelar</button>}
                <a className="chip" href={linkWhats(o.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>
              </div>
            </div>
          ))}
        </div>
      </section>
      <aside className="painel__col">
        {usuario.papel === 'dono' ? <Produtos avisar={avisar} /> : <p className="suave pequeno">Produtos e preços são cadastrados pelo dono.</p>}
      </aside>
    </div>
  )
}

function Produtos({ avisar }: { avisar: (t: string, tipo?: 'ok' | 'erro') => void }) {
  const { confirmar } = useApp()
  const [lista, setLista] = useState<Produto[] | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const carregar = useCallback(() => { api.painel.produtosPainel().then(setLista).catch((e) => avisar(e.message, 'erro')) }, [avisar])
  useEffect(() => { carregar() }, [carregar])
  const salvar = async (id: string | null, p: Omit<Produto, 'id'>) => {
    try { await api.painel.salvarProduto(id, p); avisar('Produto salvo'); setEditando(null); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const remover = async (p: Produto) => {
    if (!(await confirmar(`Apagar ${p.nome}? Para só esconder (ex.: esgotado), desmarque "À venda".`, { botao: 'Apagar' }))) return
    try { await api.painel.removerProduto(p.id); setEditando(null); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <>
      <h2 className="secao">Produtos</h2>
      <div className="lista">
        {lista?.map((p) => editando === p.id
          ? <EditarProduto key={p.id} inicial={p} aoSalvar={(v) => salvar(p.id, v)} cancelar={() => setEditando(null)} remover={() => remover(p)} />
          : (
            <button key={p.id} className={`item ${p.ativo === false ? 'item--inativo' : ''}`} onClick={() => setEditando(p.id)}>
              <div className="item__com-avatar">
                <div className="produto__foto produto__foto--mini">{p.foto ? <img src={foto(p.foto)} alt="" /> : <img className="produto__marca" src={`${import.meta.env.BASE_URL}logo-partes/r-recorte.png`} alt="" />}</div>
                <div><strong>{p.nome} {p.ativo === false && <span className="badge badge--off">esgotado</span>}</strong><span className="suave">{p.descricao}</span></div>
              </div>
              <div className="item__preco"><strong>{moeda(p.preco)}</strong><span className="suave">editar</span></div>
            </button>
          ))}
        {editando === 'novo'
          ? <EditarProduto inicial={{ nome: '', descricao: '', preco: 0, foto: null, ativo: true }} aoSalvar={(v) => salvar(null, v)} cancelar={() => setEditando(null)} />
          : <button className="botao botao--fantasma" onClick={() => setEditando('novo')}><Icone nome="mais" tam={18} /> Novo produto</button>}
      </div>
    </>
  )
}

function EditarProduto({ inicial, aoSalvar, cancelar, remover }: { inicial: Omit<Produto, 'id'>; aoSalvar: (p: Omit<Produto, 'id'>) => void; cancelar: () => void; remover?: () => void }) {
  const { avisar } = useApp()
  const [p, setP] = useState(inicial)
  const [enviando, setEnviando] = useState(false)
  const escolher = async (arq?: File) => {
    if (!arq) return
    setEnviando(true)
    try { setP({ ...p, foto: await api.painel.enviarFoto(await lerImagem(arq, 700)) }) } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(false) }
  }
  return (
    <div className="cartao form">
      <label className="escolher-foto escolher-foto--quadrada">
        {p.foto ? <img src={foto(p.foto)} alt="" /> : <span className="escolher-foto__vazio">{p.nome.trim()[0] ?? '?'}</span>}
        <span className="escolher-foto__acao"><Icone nome="camera" tam={16} /> {enviando ? 'Enviando…' : p.foto ? 'Trocar foto' : 'Pôr foto'}</span>
        <input type="file" accept="image/*" hidden onChange={(e) => escolher(e.target.files?.[0])} />
      </label>
      <label className="campo"><span>Nome</span><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></label>
      <label className="campo"><span>Descrição curta</span><input value={p.descricao} onChange={(e) => setP({ ...p, descricao: e.target.value.slice(0, 120) })} /></label>
      <label className="campo"><span>Preço (R$)</span><input type="number" inputMode="decimal" min={0} step={1} value={p.preco} onChange={(e) => setP({ ...p, preco: Number(e.target.value) })} /></label>
      <label className="check"><input type="checkbox" checked={p.ativo !== false} onChange={(e) => setP({ ...p, ativo: e.target.checked })} /> À venda no app</label>
      <div className="acoes">
        <button className="botao botao--principal pequeno" disabled={p.nome.trim().length < 2} onClick={() => aoSalvar(p)}>Salvar</button>
        <button className="botao botao--fantasma pequeno" onClick={cancelar}>Cancelar</button>
        {remover && <button className="botao botao--perigo pequeno acoes__direita" onClick={remover}><Icone nome="lixo" tam={16} /> Apagar</button>}
      </div>
    </div>
  )
}
