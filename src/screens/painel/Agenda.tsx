/**
 * Agenda do dia: só o trabalho do dia (sem números financeiros).
 * Uma coluna por barbeiro, encaixe, bloqueio e lista de espera.
 */
import { useCallback, useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type Bloqueio, type EsperaPainel, type ItemAgenda, type Profissional, type Status, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, dataIso, dataLonga, foto, hora, lerData, linkWhats, moeda, primeiroNome } from '../../util'

const ROTULO: Record<Status, string> = { confirmado: 'Confirmado', concluido: 'Concluído', faltou: 'Faltou', cancelado: 'Cancelado' }

export default function Agenda({ usuario }: { usuario: UsuarioPainel }) {
  const { barbearia, confirmar, avisar } = useApp()
  const [data, setData] = useState(dataIso(new Date()))
  const [filtro, setFiltro] = useState('todos')
  const [agenda, setAgenda] = useState<{ agendamentos: ItemAgenda[]; bloqueios: Bloqueio[]; espera?: EsperaPainel[] } | null>(null)
  const [form, setForm] = useState<null | 'encaixe' | 'bloqueio'>(null)

  const carregar = useCallback(() => {
    api.painel.agenda(data, filtro).then(setAgenda).catch((e) => avisar(e.message, 'erro'))
  }, [data, filtro, avisar])
  useEffect(() => { carregar() }, [carregar])
  // atualiza sozinho a cada minuto (cliente pode marcar pelo app a qualquer hora)
  useEffect(() => { const t = setInterval(carregar, 60_000); return () => clearInterval(t) }, [carregar])

  const mudarDia = (n: number) => { const d = lerData(data); d.setDate(d.getDate() + n); setData(dataIso(d)) }
  const marcar = async (a: ItemAgenda, s: Status) => {
    if (s === 'cancelado' && !(await confirmar(`Cancelar o horário de ${a.cliente}? Ele recebe um aviso no WhatsApp.`, { botao: 'Cancelar horário' }))) return
    try {
      const r = await api.painel.status(a.id, s)
      // abriu espaço hoje: o app convidou o próximo cliente do barbeiro a vir mais cedo
      if (r?.adiantar) avisar(`${a.cliente}: ${ROTULO[s].toLowerCase()}. Convidamos ${primeiroNome(r.adiantar.cliente)} para adiantar para as ${hora(r.adiantar.para)}.`)
      else avisar(`${a.cliente}: ${ROTULO[s].toLowerCase()}`)
      carregar()
    } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const liberar = async (b: Bloqueio) => { try { await api.painel.desbloquear(b.id); carregar() } catch (e) { avisar((e as Error).message, 'erro') } }

  const ativos = agenda?.agendamentos.filter((a) => a.status !== 'cancelado') ?? []
  const cancelados = agenda?.agendamentos.filter((a) => a.status === 'cancelado') ?? []
  const pendentes = ativos.filter((a) => a.status === 'confirmado').length
  const ehHoje = data === dataIso(new Date())

  return (
    <div className="painel__col agenda">
      <div className="agenda__topo">
        <div className="seletor-dia">
          <button className="icone-botao" onClick={() => mudarDia(-1)} aria-label="Dia anterior"><Icone nome="voltar" /></button>
          <div className="centro">
            <strong className="capitalizar">{ehHoje ? 'Hoje' : dataLonga(data).split(',')[0]}</strong>
            <span className="suave pequeno">{dataLonga(data).split(', ')[1]}</span>
          </div>
          <button className="icone-botao" onClick={() => mudarDia(1)} aria-label="Próximo dia"><Icone nome="seta" /></button>
        </div>
        {!ehHoje && <button className="link" onClick={() => setData(dataIso(new Date()))}>Voltar para hoje</button>}
        {agenda && (
          <p className="agenda__resumo">
            <strong>{ativos.length}</strong> {ativos.length === 1 ? 'horário' : 'horários'}
            {pendentes > 0 && pendentes < ativos.length && <> · <strong>{pendentes}</strong> a atender</>}
            {!!agenda.espera?.length && <> · <strong>{agenda.espera.length}</strong> na lista de espera</>}
          </p>
        )}
      </div>

      <div className="agenda__barra">
        {barbearia && barbearia.profissionais.length > 1 && (
          <div className="filtros">
            <button className={filtro === 'todos' ? 'ativo' : ''} onClick={() => setFiltro('todos')}>Todos</button>
            {barbearia.profissionais.map((p) => (
              <button key={p.id} className={`filtro-foto ${filtro === p.id ? 'ativo' : ''}`} onClick={() => setFiltro(p.id)}>
                {p.foto && <img src={foto(p.foto, 'avatar')} alt="" />}{primeiroNome(p.nome)}
              </button>
            ))}
          </div>
        )}
        <div className="acoes">
          <button className={`botao botao--fantasma pequeno ${form === 'encaixe' ? 'ativo' : ''}`} onClick={() => setForm(form === 'encaixe' ? null : 'encaixe')}><Icone nome="mais" tam={18} /> Encaixe</button>
          <button className={`botao botao--fantasma pequeno ${form === 'bloqueio' ? 'ativo' : ''}`} onClick={() => setForm(form === 'bloqueio' ? null : 'bloqueio')}><Icone nome="relogio" tam={18} /> Bloquear</button>
        </div>
      </div>
      {form === 'encaixe' && <FormEncaixe data={data} usuario={usuario} aoSalvar={() => { setForm(null); carregar() }} />}
      {form === 'bloqueio' && <FormBloqueio data={data} usuario={usuario} aoSalvar={() => { setForm(null); carregar() }} />}

      {!agenda && <div className="cartao cartao--esqueleto" />}
      {agenda && !ativos.length && !agenda.bloqueios.length && (
        <div className="vazio vazio--acao">
          <p>Nenhum horário marcado neste dia.</p>
          {form !== 'encaixe' && <button className="botao botao--fantasma pequeno" onClick={() => setForm('encaixe')}><Icone nome="mais" tam={18} /> Marcar um encaixe</button>}
        </div>
      )}
      {agenda && (ativos.length > 0 || agenda.bloqueios.length > 0) && (
        filtro === 'todos' && barbearia && barbearia.profissionais.length > 1 ? (
          <div className="agenda-colunas">
            {barbearia.profissionais.map((p) => (
              <Coluna key={p.id} prof={p}
                itens={ativos.filter((a) => a.profissionalId === p.id)}
                bloqueios={agenda.bloqueios.filter((b) => b.profissionalId === p.id)}
                marcar={marcar} liberar={liberar} />
            ))}
          </div>
        ) : <LinhaTempo itens={ativos} bloqueios={agenda.bloqueios} marcar={marcar} liberar={liberar} mostrarProf />
      )}
      {cancelados.length > 0 && <p className="suave pequeno">{cancelados.length} cancelado(s) neste dia</p>}

      {!!agenda?.espera?.length && (
        <div className="cartao espera-painel">
          <div className="linha-entre"><h3>Lista de espera do dia</h3><span className="badge">{agenda.espera.length}</span></div>
          <p className="suave pequeno">Se abrir uma vaga, o app avisa o primeiro da lista de espera no WhatsApp; 30 min depois, o próximo. Quem já tem horário hoje é convidado a adiantar quando alguém desmarca ou um atendimento termina antes.</p>
          {agenda.espera.map((e, i) => (
            <div key={e.id} className="linha-entre espera-painel__linha">
              <div><strong>{i + 1}. {e.cliente}</strong><span className="suave pequeno"> · {e.servico} · {e.profissional}{e.avisadoEm ? ` · avisado às ${hora(e.avisadoEm)}` : ''}</span></div>
              <div className="evento__acoes">
                <a className="chip" href={linkWhats(e.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>
                <button className="chip" onClick={async () => { await api.painel.removerEspera(e.id); carregar() }}>Tirar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FormEncaixe({ data, usuario, aoSalvar }: { data: string; usuario: UsuarioPainel; aoSalvar: () => void }) {
  const { barbearia, avisar } = useApp()
  const [f, setF] = useState({ nome: '', telefone: '', servicoId: barbearia?.servicos[0]?.id ?? '', profissionalId: usuario.profissionalId ?? barbearia?.profissionais[0]?.id ?? '', hora: '' })
  const [horas, setHoras] = useState<string[]>([])
  useEffect(() => { if (f.servicoId && f.profissionalId) api.horarios(data, f.servicoId, f.profissionalId).then(setHoras).catch(() => setHoras([])) }, [data, f.servicoId, f.profissionalId])
  const salvar = async () => {
    try { await api.painel.encaixe({ ...f, telefone: f.telefone || undefined, data }); avisar('Encaixe marcado'); aoSalvar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <section className="cartao form">
      <h3>Encaixe · {dataCurta(data)}</h3>
      <label className="campo"><span>Cliente</span><input value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} placeholder="Nome" /></label>
      <label className="campo"><span>WhatsApp (opcional)</span><input value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} inputMode="tel" placeholder="(27) 9 9999-9999" /></label>
      <div className="campos-2">
        <label className="campo"><span>Serviço</span>
          <select value={f.servicoId} onChange={(e) => setF({ ...f, servicoId: e.target.value, hora: '' })}>{barbearia?.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select>
        </label>
        <label className="campo"><span>Barbeiro</span>
          <select value={f.profissionalId} onChange={(e) => setF({ ...f, profissionalId: e.target.value, hora: '' })}>{barbearia?.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
        </label>
      </div>
      <div className="horas">{horas.map((h) => <button key={h} className={`hora ${f.hora === h ? 'hora--sel' : ''}`} onClick={() => setF({ ...f, hora: h })}>{h}</button>)}</div>
      {!horas.length && <p className="suave pequeno">Sem horários livres para esse serviço neste dia.</p>}
      <button className="botao botao--principal" disabled={f.nome.trim().length < 2 || !f.hora} onClick={salvar}>Marcar encaixe</button>
    </section>
  )
}

function FormBloqueio({ data, usuario, aoSalvar }: { data: string; usuario: UsuarioPainel; aoSalvar: () => void }) {
  const { barbearia, avisar } = useApp()
  const [f, setF] = useState({ profissionalId: usuario.profissionalId ?? 'todos', inicio: '12:00', fim: '13:00', motivo: '' })
  const salvar = async () => {
    try { await api.painel.bloquear({ ...f, data }); avisar('Horário bloqueado'); aoSalvar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <section className="cartao form">
      <h3>Bloquear horário · {dataCurta(data)}</h3>
      <label className="campo"><span>Barbeiro</span>
        <select value={f.profissionalId} onChange={(e) => setF({ ...f, profissionalId: e.target.value })}>
          <option value="todos">Todos (barbearia fechada)</option>
          {barbearia?.profissionais.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
        </select>
      </label>
      <div className="campos-2">
        <label className="campo"><span>De</span><input type="time" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></label>
        <label className="campo"><span>Até</span><input type="time" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></label>
      </div>
      <label className="campo"><span>Motivo</span><input value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} placeholder="Folga, médico, curso…" /></label>
      <button className="botao botao--principal" onClick={salvar}>Bloquear</button>
    </section>
  )
}

type Marcar = (a: ItemAgenda, s: Status) => void

/** Uma coluna por barbeiro: a agenda conjunta da casa, lado a lado */
function Coluna({ prof, itens, bloqueios, marcar, liberar }: { prof: Profissional; itens: ItemAgenda[]; bloqueios: Bloqueio[]; marcar: Marcar; liberar: (b: Bloqueio) => void }) {
  const aAtender = itens.filter((a) => a.status === 'confirmado').length
  return (
    <div className="coluna">
      <header className="coluna__topo">
        {prof.foto ? <img src={foto(prof.foto, 'avatar')} alt="" /> : <div className="avatar avatar--p">{prof.nome[0]}</div>}
        <div><strong>{prof.nome}</strong><span className="suave pequeno">{itens.length} {itens.length === 1 ? 'horário' : 'horários'}{aAtender ? ` · ${aAtender} a atender` : ''}</span></div>
      </header>
      {itens.length || bloqueios.length
        ? <LinhaTempo itens={itens} bloqueios={bloqueios} marcar={marcar} liberar={liberar} />
        : <p className="vazio pequeno">Agenda livre</p>}
    </div>
  )
}

function LinhaTempo({ itens, bloqueios, marcar, liberar, mostrarProf }: { itens: ItemAgenda[]; bloqueios: Bloqueio[]; marcar: Marcar; liberar: (b: Bloqueio) => void; mostrarProf?: boolean }) {
  return (
    <div className="linha-tempo">
      {[...itens.map((a) => ({ t: a.inicio, a })), ...bloqueios.map((b) => ({ t: b.inicio, b }))]
        .sort((x, y) => x.t.localeCompare(y.t))
        .map((x) => 'a' in x ? (
          <div key={x.a.id} className={`evento evento--${x.a.status}`}>
            <span className="evento__hora">{hora(x.a.inicio)}<small>{hora(x.a.fim)}</small></span>
            <div className="evento__corpo">
              <strong>{x.a.cliente} {x.a.visitas === 0 && <span className="badge">1ª vez</span>} {x.a.adiantarPara && <span className="badge" title="Convidado a vir mais cedo; aguardando resposta (20 min)">⏩ convidado p/ {hora(x.a.adiantarPara)}</span>}</strong>
              <span className="suave">{x.a.servico}{mostrarProf ? ` · ${primeiroNome(x.a.profissional)}` : ''} · {moeda(x.a.preco)}{x.a.desconto ? ' 🎂' : ''} · {x.a.origem === 'balcao' ? 'balcão' : 'app'}</span>
              <div className="evento__acoes">
                {x.a.status === 'confirmado' ? (
                  <>
                    <button className="chip chip--ok" onClick={() => marcar(x.a, 'concluido')}>✓ Concluído</button>
                    <button className="chip" onClick={() => marcar(x.a, 'faltou')}>Faltou</button>
                    <button className="chip" onClick={() => marcar(x.a, 'cancelado')}>Cancelar</button>
                  </>
                ) : (
                  <>
                    <span className={`badge ${x.a.status === 'concluido' ? '' : 'badge--off'}`}>{ROTULO[x.a.status]}</span>
                    <button className="chip" onClick={() => marcar(x.a, 'confirmado')}>Desfazer</button>
                  </>
                )}
                {!x.a.telefone.startsWith('balcao') && <a className="chip" href={linkWhats(x.a.telefone)} target="_blank" rel="noreferrer">WhatsApp</a>}
              </div>
            </div>
          </div>
        ) : (
          <div key={x.b.id} className="evento evento--bloqueio">
            <span className="evento__hora">{hora(x.b.inicio)}<small>{hora(x.b.fim)}</small></span>
            <div className="evento__corpo">
              <strong>Bloqueado {x.b.motivo && `· ${x.b.motivo}`}</strong>
              {mostrarProf && <span className="suave">{x.b.profissional}</span>}
              <div className="evento__acoes"><button className="chip" onClick={() => liberar(x.b)}>Liberar</button></div>
            </div>
          </div>
        ))}
    </div>
  )
}
