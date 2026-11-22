/**
 * Ajustes do painel.
 * Dono: dados da barbearia, serviços e preços, equipe e horários, acessos dos barbeiros.
 * Todos: trocar a própria senha.
 */
import { useCallback, useEffect, useState } from 'react'
import Icone from '../../components/Icone'
import { api, type DadosBarbearia, type Expediente, type NovoProfissional, type ProfissionalPainel, type Servico, type UsuarioLista, type UsuarioPainel } from '../../api'
import { useApp } from '../../contexto'
import { foto, lerImagem, moeda } from '../../util'
import { Produtos } from './LojaPainel'

type Avisar = (t: string, tipo?: 'ok' | 'erro') => void
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

export default function Ajustes({ usuario }: { usuario: UsuarioPainel }) {
  const { avisar } = useApp()
  const dono = usuario.papel === 'dono'
  return (
    <div className="painel__grade">
      {dono ? (
        <>
          <section className="painel__col">
            <Servicos avisar={avisar} />
            <Equipe avisar={avisar} />
            <Produtos avisar={avisar} />
          </section>
          <aside className="painel__col">
            <Barbearia avisar={avisar} />
            <Acessos avisar={avisar} />
            <Seguranca usuario={usuario} avisar={avisar} />
            <Senha avisar={avisar} />
          </aside>
        </>
      ) : (
        <section className="painel__col">
          <p className="suave">Preços, equipe, produtos e acessos são configurados pelo dono. Aqui você troca a sua senha.</p>
          <Senha avisar={avisar} />
        </section>
      )}
    </div>
  )
}

/* ---------------- dados da barbearia ---------------- */
function Barbearia({ avisar }: { avisar: Avisar }) {
  const { barbearia, recarregar } = useApp()
  const [d, setD] = useState<DadosBarbearia | null>(null)
  useEffect(() => {
    if (barbearia && !d) setD({
      nome: barbearia.nome, cidade: barbearia.cidade, endereco: barbearia.endereco, whatsapp: barbearia.whatsapp, instagram: barbearia.instagram,
      dono: barbearia.dono?.nome ?? '', google_avaliacao: barbearia.googleAvaliacao ?? '', desconto_aniversario: barbearia.descontoAniversario ?? 15,
    })
  }, [barbearia, d])
  if (!d) return null
  const campo = (k: Exclude<keyof DadosBarbearia, 'desconto_aniversario'>, rotulo: string, extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="campo"><span>{rotulo}</span><input value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} {...extra} /></label>
  )
  const salvar = async () => {
    try { await api.painel.salvarBarbearia(d); avisar('Dados salvos. O app já mostra as mudanças.'); recarregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <>
      <h2 className="secao">A barbearia</h2>
      <div className="cartao form">
        {campo('nome', 'Nome')}
        {campo('dono', 'Fundador')}
        {campo('endereco', 'Endereço (aparece no lembrete de 1h e no "Como chegar")')}
        {campo('cidade', 'Cidade')}
        {campo('whatsapp', 'WhatsApp da barbearia (com 55 e DDD)', { inputMode: 'tel', placeholder: '5527999999999' })}
        <p className="suave pequeno">É para esse número que vai o aviso de cada horário marcado pelo app.</p>
        {campo('instagram', 'Instagram (sem @)')}
        {campo('google_avaliacao', 'Link de avaliação no Google', { placeholder: 'https://g.page/r/…/review', inputMode: 'url' })}
        <p className="suave pequeno">No Perfil da Empresa no Google: "Pedir avaliações" → copiar link. Ele aparece para o cliente depois que ele avalia o atendimento.</p>
        <label className="campo"><span>Desconto de aniversário (%)</span>
          <input type="number" inputMode="numeric" min={0} max={100} value={d.desconto_aniversario} onChange={(e) => setD({ ...d, desconto_aniversario: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} />
        </label>
        <p className="suave pequeno">O cliente recebe no WhatsApp no dia do aniversário e o desconto entra sozinho no próximo horário (vale 30 dias). Use 0 para desligar.</p>
        <button className="botao botao--principal pequeno" onClick={salvar}>Salvar dados</button>
      </div>
    </>
  )
}

/* ---------------- serviços ---------------- */
function Servicos({ avisar }: { avisar: Avisar }) {
  const { recarregar } = useApp()
  const [servicos, setServicos] = useState<Servico[] | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const carregar = useCallback(() => { api.painel.servicos().then(setServicos).catch((e) => avisar(e.message, 'erro')) }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  const salvar = async (id: string | null, s: Omit<Servico, 'id'>) => {
    try { await api.painel.salvarServico(id, s); avisar('Serviço salvo. O app já mostra o novo valor.'); setEditando(null); carregar(); recarregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }

  return (
    <>
      <h2 className="secao">Serviços e preços</h2>
      <div className="lista">
        {servicos?.map((s) => editando === s.id
          ? <EditarServico key={s.id} inicial={s} aoSalvar={(v) => salvar(s.id, v)} cancelar={() => setEditando(null)} />
          : (
            <button key={s.id} className={`item ${s.ativo === false ? 'item--inativo' : ''}`} onClick={() => setEditando(s.id)}>
              <div><strong>{s.nome} {s.ativo === false && <span className="badge badge--off">oculto</span>}</strong><span className="suave">{s.duracao} min{s.destaque ? ' · destaque' : ''}</span></div>
              <div className="item__preco"><strong>{moeda(s.preco)}</strong><span className="suave">editar</span></div>
            </button>
          ))}
        {editando === 'novo'
          ? <EditarServico inicial={{ nome: '', descricao: '', preco: 0, duracao: 30, destaque: false, ativo: true }} aoSalvar={(v) => salvar(null, v)} cancelar={() => setEditando(null)} />
          : <button className="botao botao--fantasma" onClick={() => setEditando('novo')}><Icone nome="mais" tam={18} /> Novo serviço</button>}
      </div>
    </>
  )
}

function EditarServico({ inicial, aoSalvar, cancelar }: { inicial: Omit<Servico, 'id'>; aoSalvar: (s: Omit<Servico, 'id'>) => void; cancelar: () => void }) {
  const [s, setS] = useState(inicial)
  return (
    <div className="cartao form">
      <label className="campo"><span>Nome</span><input value={s.nome} onChange={(e) => setS({ ...s, nome: e.target.value })} /></label>
      <label className="campo"><span>Descrição</span><input value={s.descricao} onChange={(e) => setS({ ...s, descricao: e.target.value })} /></label>
      <div className="campos-2">
        <label className="campo"><span>Preço (R$)</span><input type="number" inputMode="decimal" min={0} step={1} value={s.preco} onChange={(e) => setS({ ...s, preco: Number(e.target.value) })} /></label>
        <label className="campo"><span>Duração (min)</span><input type="number" inputMode="numeric" min={5} step={5} value={s.duracao} onChange={(e) => setS({ ...s, duracao: Number(e.target.value) })} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={s.destaque} onChange={(e) => setS({ ...s, destaque: e.target.checked })} /> Destaque na tela inicial</label>
      <label className="check"><input type="checkbox" checked={s.ativo !== false} onChange={(e) => setS({ ...s, ativo: e.target.checked })} /> Visível no app</label>
      <div className="acoes">
        <button className="botao botao--principal pequeno" disabled={s.nome.trim().length < 2 || s.duracao < 5} onClick={() => aoSalvar(s)}>Salvar</button>
        <button className="botao botao--fantasma pequeno" onClick={cancelar}>Cancelar</button>
      </div>
    </div>
  )
}

/* ---------------- equipe e horários ---------------- */
function Equipe({ avisar }: { avisar: Avisar }) {
  const { recarregar, confirmar } = useApp()
  const [profs, setProfs] = useState<ProfissionalPainel[] | null>(null)
  const [aberto, setAberto] = useState<string | null>(null)
  const [novo, setNovo] = useState(false)
  const carregar = useCallback(() => { api.painel.profissionais().then(setProfs).catch((e) => avisar(e.message, 'erro')) }, [avisar])
  useEffect(() => { carregar() }, [carregar])

  return (
    <>
      <h2 className="secao">Equipe e horários</h2>
      <p className="suave pequeno">O horário de cada barbeiro define o que aparece livre no app. Folgas pontuais ficam no "Bloquear horário" da agenda.</p>
      <div className="lista">
        {profs?.map((p) => aberto === p.id
          ? <EditarProfissional key={p.id} inicial={p} cancelar={() => setAberto(null)} aoSalvar={async (v) => {
              try { await api.painel.salvarProfissional(p.id, v); avisar(`${v.nome}: salvo`); setAberto(null); carregar(); recarregar() } catch (e) { avisar((e as Error).message, 'erro') }
            }} excluir={async () => {
              if (!(await confirmar(`Excluir ${p.nome}? Ele sai do app e do painel, e o acesso dele ao painel é apagado. O histórico de atendimentos continua nos relatórios.`, { botao: 'Excluir barbeiro' }))) return
              try { await api.painel.removerProfissional(p.id); avisar(`${p.nome} foi excluído`); setAberto(null); carregar(); recarregar() } catch (e) { avisar((e as Error).message, 'erro') }
            }} />
          : (
            <button key={p.id} className="item" onClick={() => setAberto(p.id)}>
              <div className="item__com-avatar">
                {p.foto ? <img className="avatar avatar--p avatar--foto" src={foto(p.foto, 'avatar')} alt="" /> : <div className="avatar avatar--p">{p.nome[0]}</div>}
                <div><strong>{p.nome} {!p.ativo && <span className="badge badge--off">fora do app</span>}</strong><span className="suave">{resumoExpediente(p.expediente)}</span></div>
              </div>
              <span className="suave pequeno">editar</span>
            </button>
          ))}
      </div>
      {novo
        ? <NovoBarbeiro cancelar={() => setNovo(false)} aoSalvar={async (v) => {
            try { await api.painel.criarProfissional(v); avisar(`${v.nome} entrou na equipe. Confira os horários dele.`); setNovo(false); carregar(); recarregar() } catch (e) { avisar((e as Error).message, 'erro') }
          }} />
        : <button className="botao botao--fantasma" onClick={() => setNovo(true)}><Icone nome="mais" tam={18} /> Adicionar barbeiro</button>}
    </>
  )
}

/** Foto redonda com botão para trocar (reduz no celular antes de enviar) */
function EscolherFoto({ valor, mudar, nome }: { valor: string | null | undefined; mudar: (url: string) => void; nome: string }) {
  const { avisar } = useApp()
  const [enviando, setEnviando] = useState(false)
  const escolher = async (arq?: File) => {
    if (!arq) return
    setEnviando(true)
    try { mudar(await api.painel.enviarFoto(await lerImagem(arq))) } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(false) }
  }
  return (
    <label className="escolher-foto">
      {valor ? <img src={foto(valor, 'avatar')} alt="" /> : <span className="escolher-foto__vazio">{nome.trim()[0] ?? '?'}</span>}
      <span className="escolher-foto__acao"><Icone nome="camera" tam={16} /> {enviando ? 'Enviando…' : valor ? 'Trocar foto' : 'Pôr foto'}</span>
      <input type="file" accept="image/*" hidden onChange={(e) => escolher(e.target.files?.[0])} />
    </label>
  )
}

function NovoBarbeiro({ aoSalvar, cancelar }: { aoSalvar: (p: NovoProfissional) => void; cancelar: () => void }) {
  const [p, setP] = useState<NovoProfissional>({ nome: '', especialidade: '', ativo: true, foto: null })
  return (
    <div className="cartao form">
      <h3>Novo barbeiro</h3>
      <EscolherFoto valor={p.foto} mudar={(foto) => setP({ ...p, foto })} nome={p.nome} />
      <div className="campos-2">
        <label className="campo"><span>Nome</span><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} placeholder="Nome e sobrenome" /></label>
        <label className="campo"><span>Especialidade</span><input value={p.especialidade} onChange={(e) => setP({ ...p, especialidade: e.target.value })} placeholder="Degradê, barba…" /></label>
      </div>
      <p className="suave pequeno">Ele começa com o mesmo horário do primeiro barbeiro da lista. Depois é só ajustar em "editar".</p>
      <div className="acoes">
        <button className="botao botao--principal pequeno" disabled={p.nome.trim().length < 2} onClick={() => aoSalvar({ ...p, nome: p.nome.trim() })}>Adicionar</button>
        <button className="botao botao--fantasma pequeno" onClick={cancelar}>Cancelar</button>
      </div>
    </div>
  )
}

function resumoExpediente(exp: Expediente[]) {
  const dias = exp.map((e) => DIAS[e.dia].slice(0, 3).toLowerCase())
  return dias.length ? `Atende ${dias.join(', ')}` : 'Sem horário definido'
}

function EditarProfissional({ inicial, aoSalvar, cancelar, excluir }: {
  inicial: ProfissionalPainel; cancelar: () => void; excluir: () => void
  aoSalvar: (p: NovoProfissional & { expediente: Expediente[] }) => void
}) {
  const [p, setP] = useState({ nome: inicial.nome, especialidade: inicial.especialidade, ativo: inicial.ativo, foto: inicial.foto ?? null })
  const [dias, setDias] = useState<(Expediente | null)[]>(() => DIAS.map((_, i) => inicial.expediente.find((e) => e.dia === i) ?? null))
  const mudar = (i: number, e: Expediente | null) => setDias(dias.map((x, j) => (j === i ? e : x)))
  const valido = p.nome.trim().length >= 2 && dias.every((e) => !e || (e.inicio < e.fim && (!e.intervaloInicio || (e.intervaloFim && e.intervaloInicio < e.intervaloFim))))

  return (
    <div className="cartao form">
      <EscolherFoto valor={p.foto} mudar={(foto) => setP({ ...p, foto })} nome={p.nome} />
      <div className="campos-2">
        <label className="campo"><span>Nome</span><input value={p.nome} onChange={(e) => setP({ ...p, nome: e.target.value })} /></label>
        <label className="campo"><span>Especialidade</span><input value={p.especialidade} onChange={(e) => setP({ ...p, especialidade: e.target.value })} placeholder="Degradê, barba…" /></label>
      </div>
      <label className="check"><input type="checkbox" checked={p.ativo} onChange={(e) => setP({ ...p, ativo: e.target.checked })} /> Aparece no app para agendar</label>
      <div className="expediente">
        {DIAS.map((nome, i) => {
          const e = dias[i]
          return (
            <div key={nome} className={`expediente__dia ${e ? '' : 'expediente__dia--off'}`}>
              <label className="check"><input type="checkbox" checked={!!e} onChange={(ev) => mudar(i, ev.target.checked ? { dia: i, inicio: '09:00', fim: '19:00', intervaloInicio: '12:00', intervaloFim: '13:00' } : null)} /> {nome}</label>
              {e ? (
                <div className="expediente__horas">
                  <input type="time" value={e.inicio} onChange={(ev) => mudar(i, { ...e, inicio: ev.target.value })} aria-label={`${nome}: abre`} />
                  <span>às</span>
                  <input type="time" value={e.fim} onChange={(ev) => mudar(i, { ...e, fim: ev.target.value })} aria-label={`${nome}: fecha`} />
                  <span className="expediente__almoco">almoço</span>
                  <input type="time" value={e.intervaloInicio ?? ''} onChange={(ev) => mudar(i, { ...e, intervaloInicio: ev.target.value || null })} aria-label={`${nome}: almoço de`} />
                  <span>às</span>
                  <input type="time" value={e.intervaloFim ?? ''} onChange={(ev) => mudar(i, { ...e, intervaloFim: ev.target.value || null })} aria-label={`${nome}: almoço até`} />
                </div>
              ) : <span className="suave pequeno">Folga</span>}
            </div>
          )
        })}
      </div>
      <p className="suave pequeno">Deixe o almoço em branco se não houver pausa. Horários já marcados não mudam.</p>
      <div className="acoes">
        <button className="botao botao--principal pequeno" disabled={!valido} onClick={() => aoSalvar({ ...p, expediente: dias.filter((d): d is Expediente => !!d) })}>Salvar</button>
        <button className="botao botao--fantasma pequeno" onClick={cancelar}>Cancelar</button>
        <button className="botao botao--perigo pequeno acoes__direita" onClick={excluir}><Icone nome="lixo" tam={16} /> Excluir</button>
      </div>
    </div>
  )
}

/* ---------------- acessos ---------------- */
function Acessos({ avisar }: { avisar: Avisar }) {
  const { barbearia, confirmar } = useApp()
  const [lista, setLista] = useState<UsuarioLista[] | null>(null)
  const [novo, setNovo] = useState<null | { nome: string; email: string; senha: string; profissionalId: string }>(null)
  const carregar = useCallback(() => { api.painel.usuarios().then(setLista).catch((e) => avisar(e.message, 'erro')) }, [avisar])
  useEffect(() => { carregar() }, [carregar])
  const profs = barbearia?.profissionais ?? []

  const criar = async () => {
    if (!novo) return
    try { await api.painel.criarUsuario(novo); avisar(`Acesso criado para ${novo.nome}`); setNovo(null); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  const remover = async (u: UsuarioLista) => {
    if (!(await confirmar(`Remover o acesso de ${u.nome} ao painel?`, { botao: 'Remover acesso' }))) return
    try { await api.painel.removerUsuario(u.id); avisar('Acesso removido'); carregar() } catch (e) { avisar((e as Error).message, 'erro') }
  }

  return (
    <>
      <h2 className="secao">Acessos ao painel</h2>
      <p className="suave pequeno">Cada barbeiro entra com o próprio e-mail. Eles veem e mexem na agenda da casa toda, mas não veem o faturamento da barbearia nem os ajustes.</p>
      <div className="lista">
        {lista?.map((u) => (
          <div key={u.id} className="item item--estatico">
            <div><strong>{u.nome}</strong><span className="suave">{u.email} · {u.papel === 'dono' ? 'dono' : `barbeiro${u.profissionalId ? ` (${profs.find((p) => p.id === u.profissionalId)?.nome.split(' ')[0] ?? ''})` : ''}`}</span></div>
            {u.papel === 'barbeiro' && <button className="chip" onClick={() => remover(u)}>Remover</button>}
          </div>
        ))}
      </div>
      {novo ? (
        <div className="cartao form">
          <label className="campo"><span>Barbeiro</span>
            <select value={novo.profissionalId} onChange={(e) => {
              const p = profs.find((x) => x.id === e.target.value)
              setNovo({ ...novo, profissionalId: e.target.value, nome: p?.nome ?? novo.nome })
            }}>{profs.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</select>
          </label>
          <label className="campo"><span>E-mail</span><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} autoComplete="off" /></label>
          <label className="campo"><span>Senha inicial (mín. 6)</span><input value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} autoComplete="new-password" /></label>
          <p className="suave pequeno">Passe a senha para ele pessoalmente. Depois ele troca em Ajustes → Minha senha.</p>
          <div className="acoes">
            <button className="botao botao--principal pequeno" disabled={!/^\S+@\S+\.\S+$/.test(novo.email) || novo.senha.length < 6} onClick={criar}>Criar acesso</button>
            <button className="botao botao--fantasma pequeno" onClick={() => setNovo(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="botao botao--fantasma" disabled={!profs.length} onClick={() => setNovo({ nome: profs[0]?.nome ?? '', email: '', senha: '', profissionalId: profs[0]?.id ?? '' })}>
          <Icone nome="mais" tam={18} /> Dar acesso a um barbeiro
        </button>
      )}
    </>
  )
}

/* ---------------- minha senha ---------------- */
function Senha({ avisar }: { avisar: Avisar }) {
  const [s, setS] = useState({ atual: '', nova: '', repetir: '' })
  const ok = s.atual && s.nova.length >= 8 && s.nova === s.repetir
  const salvar = async () => {
    try { await api.painel.trocarSenha(s.atual, s.nova); avisar('Senha alterada'); setS({ atual: '', nova: '', repetir: '' }) } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <>
      <h2 className="secao">Minha senha</h2>
      <div className="cartao form">
        <label className="campo"><span>Senha atual</span><input type="password" value={s.atual} onChange={(e) => setS({ ...s, atual: e.target.value })} autoComplete="current-password" /></label>
        <label className="campo"><span>Nova senha (mín. 8)</span><input type="password" value={s.nova} onChange={(e) => setS({ ...s, nova: e.target.value })} autoComplete="new-password" /></label>
        <label className="campo"><span>Repita a nova senha</span><input type="password" value={s.repetir} onChange={(e) => setS({ ...s, repetir: e.target.value })} autoComplete="new-password" /></label>
        {s.repetir && s.nova !== s.repetir && <p className="pequeno erro">As senhas não conferem.</p>}
        <button className="botao botao--principal pequeno" disabled={!ok} onClick={salvar}>Trocar senha</button>
      </div>
    </>
  )
}

/* ---------------- segurança do dono ---------------- */
function Seguranca({ usuario, avisar }: { usuario: UsuarioPainel; avisar: Avisar }) {
  const [ativo, setAtivo] = useState(!!usuario.verificacaoWhatsApp)
  const [tel, setTel] = useState('')
  const [senha, setSenha] = useState('')
  const [editando, setEditando] = useState(false)
  const salvar = async (telefone: string | null) => {
    try {
      await api.painel.salvarSeguranca(senha, telefone)
      setAtivo(!!telefone); setEditando(false); setSenha(''); setTel('')
      avisar(telefone ? 'Pronto: ao entrar como dono, o painel vai pedir o código do WhatsApp.' : 'Verificação pelo WhatsApp desligada.')
    } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <>
      <h2 className="secao">Segurança</h2>
      <div className="cartao form">
        <div className="linha-entre"><strong>Código no WhatsApp ao entrar</strong><span className={`badge ${ativo ? '' : 'badge--off'}`}>{ativo ? 'Ligado' : 'Desligado'}</span></div>
        <p className="suave pequeno">A conta do dono vê o faturamento e mexe em tudo. Com isso ligado, além da senha, o painel pede um código que chega no seu WhatsApp.</p>
        {editando ? (
          <>
            {!ativo && <label className="campo"><span>Seu WhatsApp (com DDD)</span><input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="(27) 9 9999-9999" /></label>}
            <label className="campo"><span>Sua senha (para confirmar)</span><input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" /></label>
            <div className="acoes">
              {ativo
                ? <button className="botao botao--perigo pequeno" disabled={!senha} onClick={() => salvar(null)}>Desligar</button>
                : <button className="botao botao--principal pequeno" disabled={!senha || tel.replace(/\D/g, '').length < 10} onClick={() => salvar(tel)}>Ligar</button>}
              <button className="botao botao--fantasma pequeno" onClick={() => setEditando(false)}>Cancelar</button>
            </div>
          </>
        ) : <button className="botao botao--fantasma pequeno" onClick={() => setEditando(true)}>{ativo ? 'Desligar' : 'Ligar agora'}</button>}
      </div>
    </>
  )
}
