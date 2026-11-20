/**
 * Modo OFFLINE (vitrine no GitHub Pages, sem servidor).
 * Imita a API guardando tudo no próprio celular, com dados de demonstração.
 * As regras são as mesmas do servidor (duração, intervalo, conflitos), em versão simplificada.
 */
import type { Agendamento, Api, Barbearia, Bloqueio, Cliente, DadosBarbearia, ItemAgenda, Mensagem, Pedido, Produto, Servico, Status, UsuarioLista } from './tipos'

const p2 = (n: number) => String(n).padStart(2, '0')
const dataIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
const carimbo = (d: Date) => `${dataIso(d)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
const ler = (c: string) => { const [a, b = '00:00'] = c.split(' '); const [y, m, d] = a.split('-').map(Number); const [h, mi] = b.split(':').map(Number); return new Date(y, m - 1, d, h, mi) }
const min = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b }
const hm = (m: number) => `${p2(Math.floor(m / 60))}:${p2(m % 60)}`
const id = () => Math.random().toString(36).slice(2, 10)
const espera = () => new Promise((r) => setTimeout(r, 120))

const SERVICOS: Servico[] = [
  { id: 'corte', nome: 'Corte', descricao: 'Corte na tesoura ou máquina, lavagem e finalização', preco: 45, duracao: 40, destaque: true, ativo: true },
  { id: 'barba', nome: 'Barba', descricao: 'Toalha quente, navalha e balm', preco: 35, duracao: 30, destaque: true, ativo: true },
  { id: 'combo', nome: 'Corte + Barba', descricao: 'O ritual completo da casa', preco: 75, duracao: 70, destaque: true, ativo: true },
  { id: 'sobrancelha', nome: 'Sobrancelha', descricao: 'Acabamento na navalha', preco: 15, duracao: 10, destaque: false, ativo: true },
  { id: 'pigmentacao', nome: 'Pigmentação', descricao: 'Barba ou cabelo', preco: 30, duracao: 20, destaque: false, ativo: true },
  { id: 'hidratacao', nome: 'Hidratação', descricao: 'Tratamento para cabelo e barba', preco: 30, duracao: 20, destaque: false, ativo: true },
  { id: 'platinado', nome: 'Platinado / Luzes', descricao: 'Consulte o profissional', preco: 150, duracao: 120, destaque: false, ativo: true },
]
const PROFS = [
  { id: 'p1', nome: 'Daniel Andrade', especialidade: 'Barbeiro', foto: 'daniel-andrade' },
  { id: 'p2', nome: 'Guilherme Moreira', especialidade: 'Barbeiro', foto: 'guilherme-moreira' },
]
// [abre, fecha, intervalo início, intervalo fim]
const EXPEDIENTE: Record<number, [string, string, string?, string?] | null> = {
  0: null, 1: ['09:00', '19:00', '12:00', '13:00'], 2: ['09:00', '19:00', '12:00', '13:00'], 3: ['09:00', '19:00', '12:00', '13:00'],
  4: ['09:00', '19:00', '12:00', '13:00'], 5: ['09:00', '20:00', '12:00', '13:00'], 6: ['08:00', '17:00'],
}
const META = 10

type Ag = { id: string; clienteId: string; profissionalId: string; servicoId: string; inicio: string; fim: string; preco: number; desconto?: number; status: Status; origem: 'app' | 'balcao' }
type Banco = {
  servicos: Servico[]
  clientes: { id: string; nome: string; telefone: string; aniversario?: string | null; cupomAno?: number }[]
  produtos?: Produto[]
  pedidos?: (Pedido & { clienteId: string; observacao: string })[]
  espera?: { id: string; clienteId: string; servicoId: string; profissionalId: string; data: string; criadoEm: string }[]
  avaliacoes?: { agendamentoId: string; nota: number; comentario: string; criadoEm: string }[]
  agendamentos: Ag[]
  bloqueios: Omit<Bloqueio, 'profissional'>[]
  mensagens: Mensagem[]
  codigo?: { telefone: string; codigo: string }
  info?: Partial<DadosBarbearia>
  usuarios?: UsuarioLista[]
  sessao?: string
  painel?: boolean
}

const CHAVE = 'roque-offline-v4'
let banco: Banco = carregar()

function carregar(): Banco {
  try { const s = localStorage.getItem(CHAVE); if (s) return JSON.parse(s) } catch { /* */ }
  return semear()
}
const salvar = () => { try { localStorage.setItem(CHAVE, JSON.stringify(banco)) } catch { /* */ } }

/** histórico fictício para o painel ter números na demonstração */
function semear(): Banco {
  const b: Banco = { servicos: SERVICOS, clientes: [], agendamentos: [], bloqueios: [], mensagens: [] }
  let s = 7
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const nomes = ['João Pedro', 'Marcos Antônio', 'Felipe Rocha', 'Thiago Lima', 'André Souza', 'Bruno Martins', 'Rafael Costa', 'Diego Ferreira', 'Lucas Vieira', 'Gustavo Henrique', 'Paulo Eduardo', 'Vinícius Teixeira', 'Matheus Alves', 'Gabriel Santos', 'Leonardo Dias', 'Caio Ribeiro']
  b.clientes = nomes.map((nome, i) => ({ id: 'c' + i, nome, telefone: `55279${88000000 + i * 1371}` }))
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const agoraTxt = carimbo(new Date())
  for (let d = -30; d <= 4; d++) {
    const dia = new Date(hoje); dia.setDate(dia.getDate() + d)
    const e = EXPEDIENTE[dia.getDay()]
    if (!e) continue
    for (const p of PROFS) for (let m = min(e[0]); m + 40 <= min(e[1]); m += 60) {
      if (e[2] && m >= min(e[2]) && m < min(e[3]!)) continue
      if (rnd() > (d < 0 ? 0.55 : d === 0 ? 0.6 : 0.3)) continue
      const sv = SERVICOS[Math.floor(rnd() * 3)]
      const ini = `${dataIso(dia)} ${hm(m)}`
      const cli = d > -22 ? b.clientes[Math.floor(rnd() * 12)] : b.clientes[Math.floor(rnd() * 16)]
      b.agendamentos.push({
        id: id(), clienteId: cli.id, profissionalId: p.id, servicoId: sv.id, inicio: ini, fim: carimbo(new Date(ler(ini).getTime() + sv.duracao * 60000)),
        preco: sv.preco, status: ini < agoraTxt ? (rnd() < 0.06 ? 'faltou' : 'concluido') : 'confirmado', origem: rnd() < 0.68 ? 'app' : 'balcao',
      })
    }
  }
  // avaliações fictícias de parte dos atendimentos concluídos
  const elogios = ['Atendimento impecável!', 'Melhor degradê da cidade', 'Ambiente top, voltarei', '', '', 'Pontual e caprichoso', '']
  b.avaliacoes = b.agendamentos.filter((a) => a.status === 'concluido' && rnd() < 0.35)
    .map((a) => ({ agendamentoId: a.id, nota: rnd() < 0.85 ? 5 : 4, comentario: elogios[Math.floor(rnd() * elogios.length)], criadoEm: a.fim }))
  return b
}

const PRODUTOS: Produto[] = [
  { id: 'pomada', nome: 'Pomada modeladora', descricao: 'Fixação forte, efeito seco', preco: 45, ativo: true },
  { id: 'oleo', nome: 'Óleo para barba', descricao: 'Hidrata e perfuma, 30 ml', preco: 40, ativo: true },
  { id: 'balm', nome: 'Balm pós-barba', descricao: 'Acalma a pele depois da navalha', preco: 35, ativo: true },
  { id: 'shampoo', nome: 'Shampoo para barba', descricao: 'Limpeza suave, 150 ml', preco: 38, ativo: true },
]
const moedaTxt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
/** offline não roda tarefas: no dia do aniversário o cupom aparece direto */
const cupomDe = (c: Banco['clientes'][number]) =>
  c.aniversario && c.aniversario === dataIso(new Date()).slice(5) && c.cupomAno !== new Date().getFullYear() ? { motivo: 'aniversario', desconto: 15, validoAte: dataIso(new Date(Date.now() + 30 * 864e5)) } : null

function horariosDo(prof: string, data: string, duracao: number, agoraD = new Date()): string[] {
  const e = EXPEDIENTE[ler(data).getDay()]
  if (!e) return []
  const oc = banco.agendamentos.filter((a) => a.profissionalId === prof && a.inicio.startsWith(data) && (a.status === 'confirmado' || a.status === 'concluido'))
    .map((a) => [a.inicio, a.fim])
  banco.bloqueios.filter((x) => x.profissionalId === prof && x.inicio.startsWith(data)).forEach((x) => oc.push([x.inicio, x.fim]))
  if (e[2]) oc.push([`${data} ${e[2]}`, `${data} ${e[3]}`])
  const limite = carimbo(new Date(agoraD.getTime() + 30 * 60000))
  const out: string[] = []
  for (let m = min(e[0]); m + duracao <= min(e[1]); m += 30) {
    const i = `${data} ${hm(m)}`, f = `${data} ${hm(m + duracao)}`
    if (i < limite || oc.some(([a, b]) => i < b && a < f)) continue
    out.push(hm(m))
  }
  return out
}
const livres = (prof: string, data: string, dur: number) =>
  [...new Set((prof === 'qualquer' ? PROFS.map((p) => p.id) : [prof]).flatMap((p) => horariosDo(p, data, dur)))].sort()

const OFFLINE = 'Na demonstração offline isso fica travado. Funciona na versão com servidor.'
const dados = (): DadosBarbearia => ({
  nome: 'Barbearia Roque', cidade: 'Nova Venécia - ES', endereco: 'Endereço a confirmar · Nova Venécia - ES',
  whatsapp: '5527999999999', instagram: 'barbearia_roque', dono: 'Luciano Roque', google_avaliacao: '', desconto_aniversario: 15, ...banco.info,
})
const DONO: UsuarioLista = { id: 'dono', nome: 'Luciano Roque', email: 'dono@roque.local', papel: 'dono', profissionalId: null }
const servico = (sid: string) => banco.servicos.find((s) => s.id === sid)!
const nomeProf = (pid: string) => PROFS.find((p) => p.id === pid)?.nome ?? ''
const cliente = (cid: string) => banco.clientes.find((c) => c.id === cid)
const paraAgendamento = (a: Ag): Agendamento => ({ ...a, servico: servico(a.servicoId)?.nome ?? '', profissional: nomeProf(a.profissionalId) })
const msg = (telefone: string, tipo: string, texto: string) =>
  banco.mensagens.unshift({ id: id(), telefone, tipo, texto, status: 'demo', criadoEm: carimbo(new Date()) })

function eu(): Cliente | null {
  const c = banco.sessao ? cliente(banco.sessao) : undefined
  if (!c) return null
  const n = banco.agendamentos.filter((a) => a.clienteId === c.id && a.status === 'concluido').length
  return { ...c, fidelidade: { selos: n % META, meta: META, premiosConquistados: Math.floor(n / META), totalAtendimentos: n }, cupom: cupomDe(c) }
}

export const apiLocal: Api = {
  modo: 'local',
  async barbearia(): Promise<Barbearia> {
    await espera()
    const horarios: Barbearia['horarios'] = {}
    for (let d = 0; d < 7; d++) { const e = EXPEDIENTE[d]; horarios[d] = e ? [e[0], e[1]] : null }
    const { dono, google_avaliacao, desconto_aniversario, ...info } = dados()
    return {
      ...info, dono: { nome: dono, foto: 'luciano-roque' }, googleAvaliacao: google_avaliacao, descontoAniversario: desconto_aniversario, horarios, fidelidadeMeta: META, diasAgenda: 14,
      antecedenciaCancelarMin: 120, whatsappModo: 'offline', servicos: banco.servicos.filter((s) => s.ativo !== false), profissionais: PROFS,
    }
  },
  async dias(sid, prof) {
    const out = []
    const d = new Date(); d.setHours(0, 0, 0, 0)
    for (let i = 0; i < 14; i++) {
      if (EXPEDIENTE[d.getDay()]) out.push({ data: dataIso(d), livres: livres(prof, dataIso(d), servico(sid).duracao).length })
      d.setDate(d.getDate() + 1)
    }
    return out
  },
  async horarios(data, sid, prof) { await espera(); return livres(prof, data, servico(sid).duracao) },

  async pedirCodigo(telefone) {
    await espera()
    const codigo = String(Math.floor(100000 + Math.random() * 900000))
    const tel = telefone.replace(/\D/g, '')
    banco.codigo = { telefone: tel, codigo }
    msg(tel, 'codigo', `*Barbearia Roque*\nSeu código de acesso é *${codigo}*.`)
    salvar()
    return { jaCliente: banco.clientes.some((c) => c.telefone.endsWith(tel)), codigoDemo: codigo }
  },
  async verificar(telefone, codigo, nome, aniversario) {
    await espera()
    const tel = telefone.replace(/\D/g, '')
    if (!banco.codigo || banco.codigo.telefone !== tel || banco.codigo.codigo !== codigo) throw new Error('Código incorreto')
    let c = banco.clientes.find((x) => x.telefone.endsWith(tel))
    if (!c) {
      if (!nome) throw new Error('Informe seu nome')
      c = { id: id(), nome, telefone: '55' + tel, aniversario: aniversario ?? null }
      banco.clientes.push(c)
    } else if (nome) c.nome = nome
    banco.sessao = c.id
    banco.codigo = undefined
    salvar()
    return eu()!
  },
  async eu() { return eu() },
  sair() { banco.sessao = undefined; salvar() },
  async atualizarPerfil(d) {
    const c = banco.sessao ? cliente(banco.sessao) : undefined
    if (!c) throw new Error('Entre de novo')
    if (d.nome) c.nome = d.nome
    if (d.aniversario !== undefined) c.aniversario = d.aniversario
    salvar()
  },

  async meusAgendamentos() {
    await espera()
    return {
      agora: carimbo(new Date()),
      agendamentos: banco.agendamentos.filter((a) => a.clienteId === banco.sessao).sort((a, b) => b.inicio.localeCompare(a.inicio))
        .map((a) => ({ ...paraAgendamento(a), avaliacao: banco.avaliacoes?.find((v) => v.agendamentoId === a.id)?.nota ?? null })),
    }
  },
  async agendar(d) {
    await espera()
    const sv = servico(d.servicoId)
    let prof = d.profissionalId
    if (prof === 'qualquer') prof = PROFS.find((p) => horariosDo(p.id, d.data, sv.duracao).includes(d.hora))?.id ?? ''
    if (!prof || !horariosDo(prof, d.data, sv.duracao).includes(d.hora)) throw new Error('Esse horário acabou de ser ocupado. Escolha outro.')
    const inicio = `${d.data} ${d.hora}`
    const c = cliente(banco.sessao!)!
    const cupom = cupomDe(c)
    const desconto = cupom ? Math.round(sv.preco * cupom.desconto) / 100 : 0
    if (cupom) c.cupomAno = new Date().getFullYear()
    const a: Ag = { id: id(), clienteId: c.id, profissionalId: prof, servicoId: sv.id, inicio, fim: carimbo(new Date(ler(inicio).getTime() + sv.duracao * 60000)), preco: sv.preco - desconto, desconto, status: 'confirmado', origem: 'app' }
    banco.agendamentos.push(a)
    banco.espera = (banco.espera ?? []).filter((e) => !(e.clienteId === c.id && e.data === d.data))
    msg(c.telefone, 'confirmacao', `Fala, ${c.nome.split(' ')[0]}! ✂️ Seu horário de *${sv.nome}* está confirmado para ${inicio.slice(8, 10)}/${inicio.slice(5, 7)} às ${d.hora}.`)
    msg(dados().whatsapp, 'aviso_novo', `📲 *Novo horário pelo app*
${c.nome} · ${sv.nome}
👤 ${nomeProf(prof)}
📅 ${inicio.slice(8, 10)}/${inicio.slice(5, 7)} às ${d.hora}`)
    salvar()
    return { id: a.id, profissionalId: prof, inicio, desconto }
  },
  async cancelar(aid) {
    const a = banco.agendamentos.find((x) => x.id === aid && x.clienteId === banco.sessao)
    if (!a) throw new Error('Agendamento não encontrado')
    if (a.inicio < carimbo(new Date(Date.now() + 120 * 60000))) throw new Error('Cancelamentos pelo app só até 2h antes. Fale com a barbearia pelo WhatsApp.')
    a.status = 'cancelado'
    salvar()
  },

  async minhaEspera() {
    const hoje = dataIso(new Date())
    return (banco.espera ?? []).filter((e) => e.clienteId === banco.sessao && e.data >= hoje)
      .map((e) => ({ id: e.id, data: e.data, servicoId: e.servicoId, servico: servico(e.servicoId).nome, profissionalId: e.profissionalId, profissional: e.profissionalId === 'qualquer' ? 'Sem preferência' : nomeProf(e.profissionalId), avisadoEm: null }))
  },
  async entrarEspera(d) {
    if (livres(d.profissionalId, d.data, servico(d.servicoId).duracao).length) throw new Error('Ainda tem horário livre nesse dia. É só escolher!')
    banco.espera = [...(banco.espera ?? []).filter((e) => !(e.clienteId === banco.sessao && e.data === d.data)), { id: id(), clienteId: banco.sessao!, ...d, criadoEm: carimbo(new Date()) }]
    salvar()
    return { posicao: banco.espera.filter((e) => e.data === d.data).length }
  },
  async sairEspera(eid) { banco.espera = (banco.espera ?? []).filter((e) => e.id !== eid); salvar() },

  async produtos() { await espera(); return (banco.produtos ?? PRODUTOS).filter((p) => p.ativo !== false) },
  async pedir(itens, observacao = '') {
    const c = cliente(banco.sessao!)!
    const lista = itens.map((i) => { const p = (banco.produtos ?? PRODUTOS).find((x) => x.id === i.produtoId); if (!p) throw new Error('Produto indisponível'); return { nome: p.nome, preco: p.preco, qtd: i.qtd } })
    const total = lista.reduce((t, i) => t + i.preco * i.qtd, 0)
    const ped = { id: id(), clienteId: c.id, status: 'novo' as const, total, criadoEm: carimbo(new Date()), itens: lista, observacao }
    banco.pedidos = [ped, ...(banco.pedidos ?? [])]
    const resumo = lista.map((i) => `• ${i.qtd}× ${i.nome}`).join('\n')
    msg(c.telefone, 'pedido', `${c.nome.split(' ')[0]}, seu pedido foi recebido! 🛍️\n${resumo}\nTotal: *${moedaTxt(total)}*, pago na retirada.`)
    msg(dados().whatsapp, 'aviso_pedido', `🛍️ *Novo pedido para retirar*\n${c.nome}\n${resumo}\nTotal: ${moedaTxt(total)}`)
    salvar()
    return { id: ped.id, total }
  },
  async meusPedidos() { return (banco.pedidos ?? []).filter((o) => o.clienteId === banco.sessao) },
  async cancelarPedido(pid) {
    const o = (banco.pedidos ?? []).find((x) => x.id === pid && x.clienteId === banco.sessao)
    if (!o || o.status !== 'novo') throw new Error('Esse pedido já foi separado. Fale com a barbearia.')
    o.status = 'cancelado'; salvar()
  },

  async avaliacao(aid) {
    const a = banco.agendamentos.find((x) => x.id === aid && x.status === 'concluido')
    if (!a) throw new Error('Atendimento não encontrado')
    const v = banco.avaliacoes?.find((x) => x.agendamentoId === aid)
    const p = PROFS.find((x) => x.id === a.profissionalId)
    return { id: a.id, inicio: a.inicio, servico: servico(a.servicoId).nome, profissional: p?.nome ?? '', foto: p?.foto ?? null, cliente: cliente(a.clienteId)!.nome.split(' ')[0], nota: v?.nota ?? null, comentario: v?.comentario ?? null, googleAvaliacao: dados().google_avaliacao }
  },
  async avaliar(aid, nota, comentario) {
    if (banco.avaliacoes?.some((v) => v.agendamentoId === aid)) throw new Error('Esse atendimento já foi avaliado. Obrigado!')
    banco.avaliacoes = [...(banco.avaliacoes ?? []), { agendamentoId: aid, nota, comentario, criadoEm: carimbo(new Date()) }]
    salvar()
  },

  painel: {
    logado: () => !!banco.painel,
    async entrar(email, senha) {
      await espera()
      if (email.toLowerCase() !== 'dono@roque.local' || senha !== 'roque123') throw new Error('E-mail ou senha incorretos (demo: dono@roque.local / roque123)')
      banco.painel = true; salvar()
      return { nome: 'Luciano Roque', email, papel: 'dono', profissionalId: null }
    },
    sair() { banco.painel = false; salvar() },
    async eu() { return { nome: 'Luciano Roque', email: 'dono@roque.local', papel: 'dono', profissionalId: null } },
    async resumo(data) {
      await espera()
      const doDia = banco.agendamentos.filter((a) => a.inicio.startsWith(data) && (a.status === 'confirmado' || a.status === 'concluido'))
      const mes = banco.agendamentos.filter((a) => a.inicio.startsWith(data.slice(0, 7)))
      const validos = mes.filter((a) => a.status !== 'cancelado')
      const cont = (f: (a: Ag) => boolean) => mes.filter(f).length
      const porS: Record<string, number> = {}
      validos.forEach((a) => { const n = servico(a.servicoId).nome; porS[n] = (porS[n] ?? 0) + 1 })
      const porP: Record<string, { n: number; total: number }> = {}
      mes.filter((a) => a.status === 'concluido').forEach((a) => { const n = nomeProf(a.profissionalId); porP[n] = { n: (porP[n]?.n ?? 0) + 1, total: (porP[n]?.total ?? 0) + a.preco } })
      const ultima: Record<string, string> = {}
      banco.agendamentos.filter((a) => a.status === 'concluido').forEach((a) => { if (!ultima[a.clienteId] || a.inicio > ultima[a.clienteId]) ultima[a.clienteId] = a.inicio })
      const futuros = new Set(banco.agendamentos.filter((a) => a.status === 'confirmado').map((a) => a.clienteId))
      const retorno = Object.entries(ultima).map(([cid, u]) => ({ cid, u, dias: Math.floor((Date.now() - ler(u).getTime()) / 864e5) }))
        .filter((x) => x.dias >= 20 && !futuros.has(x.cid)).map((x) => ({ id: x.cid, nome: cliente(x.cid)!.nome, telefone: cliente(x.cid)!.telefone, dias: x.dias, avisado: true, ultimaVisita: x.u }))
      return {
        data,
        hoje: { atendimentos: doDia.length, previsto: doDia.reduce((t, a) => t + a.preco, 0), recebido: doDia.filter((a) => a.status === 'concluido').reduce((t, a) => t + a.preco, 0) },
        mes: {
          concluidos: cont((a) => a.status === 'concluido'), faltas: cont((a) => a.status === 'faltou'), cancelados: cont((a) => a.status === 'cancelado'),
          faturado: mes.filter((a) => a.status === 'concluido').reduce((t, a) => t + a.preco, 0),
          taxaFalta: validos.length ? cont((a) => a.status === 'faltou') / validos.length : 0,
          percentualApp: validos.length ? validos.filter((a) => a.origem === 'app').length / validos.length : 0,
        },
        porServico: Object.entries(porS).map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n).slice(0, 5),
        porProfissional: Object.entries(porP).map(([nome, v]) => ({ nome, ...v })).sort((a, b) => b.total - a.total),
        retorno,
      }
    },
    async agenda(data, prof) {
      await espera()
      const ok = (p: string) => !prof || prof === 'todos' || p === prof
      const ags: ItemAgenda[] = banco.agendamentos.filter((a) => a.inicio.startsWith(data) && ok(a.profissionalId)).sort((a, b) => a.inicio.localeCompare(b.inicio))
        .map((a) => { const c = cliente(a.clienteId)!; return { ...paraAgendamento(a), origem: a.origem, cliente: c.nome, telefone: c.telefone, visitas: banco.agendamentos.filter((x) => x.clienteId === c.id && x.status === 'concluido').length } })
      const bloqueios = banco.bloqueios.filter((b) => b.inicio.startsWith(data) && ok(b.profissionalId)).map((b) => ({ ...b, profissional: nomeProf(b.profissionalId) }))
      const esp = (banco.espera ?? []).filter((e) => e.data === data).map((e) => {
        const c = cliente(e.clienteId)!
        return { id: e.id, cliente: c.nome, telefone: c.telefone, servico: servico(e.servicoId).nome, profissionalId: e.profissionalId, profissional: e.profissionalId === 'qualquer' ? 'Sem preferência' : nomeProf(e.profissionalId), criadoEm: e.criadoEm, avisadoEm: null }
      })
      return { agendamentos: ags, bloqueios, espera: esp }
    },
    async removerEspera(eid) { banco.espera = (banco.espera ?? []).filter((e) => e.id !== eid); salvar() },
    async avaliacoes() {
      const lista = (banco.avaliacoes ?? []).map((v) => ({ v, a: banco.agendamentos.find((x) => x.id === v.agendamentoId)! })).filter((x) => x.a)
      const media = (ns: number[]) => (ns.length ? Math.round((ns.reduce((t, n) => t + n, 0) / ns.length) * 10) / 10 : 0)
      return {
        media: media(lista.map((x) => x.v.nota)), total: lista.length,
        porProfissional: PROFS.map((p) => { const ns = lista.filter((x) => x.a.profissionalId === p.id).map((x) => x.v.nota); return { id: p.id, nome: p.nome, foto: p.foto, media: media(ns), n: ns.length } }).filter((p) => p.n),
        recentes: lista.sort((x, y) => y.v.criadoEm.localeCompare(x.v.criadoEm)).slice(0, 30)
          .map((x) => ({ id: x.v.agendamentoId, nota: x.v.nota, comentario: x.v.comentario, criadoEm: x.v.criadoEm, cliente: cliente(x.a.clienteId)!.nome, profissional: nomeProf(x.a.profissionalId) })),
      }
    },
    async pedidos(todos) {
      return (banco.pedidos ?? []).filter((o) => todos || o.status === 'novo' || o.status === 'separado')
        .map((o) => { const c = cliente(o.clienteId)!; return { ...o, cliente: c.nome, telefone: c.telefone } })
    },
    async statusPedido(pid, st) { const o = (banco.pedidos ?? []).find((x) => x.id === pid); if (o) o.status = st; salvar() },
    async status(aid, status) { const a = banco.agendamentos.find((x) => x.id === aid); if (a) a.status = status; salvar() },
    async encaixe(d) {
      const sv = servico(d.servicoId)
      if (!horariosDo(d.profissionalId, d.data, sv.duracao, new Date(0)).includes(d.hora)) throw new Error('Horário ocupado para esse profissional')
      const c = { id: id(), nome: d.nome, telefone: d.telefone ? '55' + d.telefone.replace(/\D/g, '') : 'balcao-' + id() }
      banco.clientes.push(c)
      const inicio = `${d.data} ${d.hora}`
      banco.agendamentos.push({ id: id(), clienteId: c.id, profissionalId: d.profissionalId, servicoId: sv.id, inicio, fim: carimbo(new Date(ler(inicio).getTime() + sv.duracao * 60000)), preco: sv.preco, status: 'confirmado', origem: 'balcao' })
      salvar()
    },
    async bloquear(d) {
      const ids = d.profissionalId === 'todos' ? PROFS.map((p) => p.id) : [d.profissionalId]
      ids.forEach((p) => banco.bloqueios.push({ id: id(), profissionalId: p, inicio: `${d.data} ${d.inicio}`, fim: `${d.data} ${d.fim}`, motivo: d.motivo }))
      salvar()
    },
    async desbloquear(bid) { banco.bloqueios = banco.bloqueios.filter((b) => b.id !== bid); salvar() },
    async clientes(busca) {
      const q = busca.toLowerCase()
      return banco.clientes.filter((c) => !c.telefone.startsWith('balcao') && (c.nome.toLowerCase().includes(q) || c.telefone.includes(q))).map((c) => {
        const ags = banco.agendamentos.filter((a) => a.clienteId === c.id)
        const conc = ags.filter((a) => a.status === 'concluido')
        return { ...c, visitas: conc.length, faltas: ags.filter((a) => a.status === 'faltou').length, ultimaVisita: conc.map((a) => a.inicio).sort().pop() ?? null }
      }).sort((a, b) => (b.ultimaVisita ?? '').localeCompare(a.ultimaVisita ?? ''))
    },
    async mensagens() { return banco.mensagens.slice(0, 60) },
    async servicos() { return banco.servicos },
    async salvarServico(sid, s) {
      if (sid) banco.servicos = banco.servicos.map((x) => (x.id === sid ? { ...x, ...s } : x))
      else banco.servicos.push({ ...s, id: id() })
      salvar()
    },
    async salvarBarbearia(d) { banco.info = { ...banco.info, ...d }; salvar() },
    async profissionais() {
      const exp = Object.entries(EXPEDIENTE).filter(([, e]) => e).map(([dia, e]) => ({ dia: Number(dia), inicio: e![0], fim: e![1], intervaloInicio: e![2] ?? null, intervaloFim: e![3] ?? null }))
      return PROFS.map((p) => ({ ...p, ativo: true, expediente: exp }))
    },
    async salvarProfissional() { throw new Error(OFFLINE) },
    async criarProfissional() { throw new Error(OFFLINE) },
    async removerProfissional() { throw new Error(OFFLINE) },
    async enviarFoto() { throw new Error(OFFLINE) },
    async produtosPainel() { return banco.produtos ?? PRODUTOS },
    async salvarProduto(pid, d) {
      const lista = banco.produtos ?? PRODUTOS
      banco.produtos = pid ? lista.map((x) => (x.id === pid ? { ...x, ...d } : x)) : [...lista, { ...d, id: id() }]
      salvar()
    },
    async removerProduto(pid) { banco.produtos = (banco.produtos ?? PRODUTOS).filter((x) => x.id !== pid); salvar() },
    async usuarios() { return [DONO, ...(banco.usuarios ?? [])] },
    async criarUsuario(d) {
      if ([DONO, ...(banco.usuarios ?? [])].some((u) => u.email === d.email.toLowerCase())) throw new Error('Esse e-mail já tem acesso')
      banco.usuarios = [...(banco.usuarios ?? []), { id: id(), nome: d.nome, email: d.email.toLowerCase(), papel: 'barbeiro', profissionalId: d.profissionalId }]
      salvar()
    },
    async removerUsuario(uid) { banco.usuarios = (banco.usuarios ?? []).filter((u) => u.id !== uid); salvar() },
    async trocarSenha() { throw new Error(OFFLINE) },
  },
}
