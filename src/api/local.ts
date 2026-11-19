/**
 * Modo OFFLINE (vitrine no GitHub Pages, sem servidor).
 * Imita a API guardando tudo no próprio celular, com dados de demonstração.
 * As regras são as mesmas do servidor (duração, intervalo, conflitos), em versão simplificada.
 */
import type { Agendamento, Api, Barbearia, Bloqueio, Cliente, ItemAgenda, Mensagem, Servico, Status } from './tipos'

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
  { id: 'p1', nome: 'Profissional 1', especialidade: 'Cortes clássicos e degradê' },
  { id: 'p2', nome: 'Profissional 2', especialidade: 'Barba e navalha' },
  { id: 'p3', nome: 'Profissional 3', especialidade: 'Química e platinado' },
]
// [abre, fecha, intervalo início, intervalo fim]
const EXPEDIENTE: Record<number, [string, string, string?, string?] | null> = {
  0: null, 1: ['09:00', '19:00', '12:00', '13:00'], 2: ['09:00', '19:00', '12:00', '13:00'], 3: ['09:00', '19:00', '12:00', '13:00'],
  4: ['09:00', '19:00', '12:00', '13:00'], 5: ['09:00', '20:00', '12:00', '13:00'], 6: ['08:00', '17:00'],
}
const META = 10

type Ag = { id: string; clienteId: string; profissionalId: string; servicoId: string; inicio: string; fim: string; preco: number; status: Status; origem: 'app' | 'balcao' }
type Banco = {
  servicos: Servico[]
  clientes: { id: string; nome: string; telefone: string }[]
  agendamentos: Ag[]
  bloqueios: Omit<Bloqueio, 'profissional'>[]
  mensagens: Mensagem[]
  codigo?: { telefone: string; codigo: string }
  sessao?: string
  painel?: boolean
}

const CHAVE = 'roque-offline-v2'
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
  return b
}

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
  return { ...c, fidelidade: { selos: n % META, meta: META, premiosConquistados: Math.floor(n / META), totalAtendimentos: n } }
}

export const apiLocal: Api = {
  modo: 'local',
  async barbearia(): Promise<Barbearia> {
    await espera()
    const horarios: Barbearia['horarios'] = {}
    for (let d = 0; d < 7; d++) { const e = EXPEDIENTE[d]; horarios[d] = e ? [e[0], e[1]] : null }
    return {
      nome: 'Barbearia Roque', cidade: 'Nova Venécia - ES', endereco: 'Endereço a confirmar · Nova Venécia - ES',
      whatsapp: '5527999999999', instagram: 'barbeariaroque', horarios, fidelidadeMeta: META, diasAgenda: 14,
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
  async verificar(telefone, codigo, nome) {
    await espera()
    const tel = telefone.replace(/\D/g, '')
    if (!banco.codigo || banco.codigo.telefone !== tel || banco.codigo.codigo !== codigo) throw new Error('Código incorreto')
    let c = banco.clientes.find((x) => x.telefone.endsWith(tel))
    if (!c) {
      if (!nome) throw new Error('Informe seu nome')
      c = { id: id(), nome, telefone: '55' + tel }
      banco.clientes.push(c)
    } else if (nome) c.nome = nome
    banco.sessao = c.id
    banco.codigo = undefined
    salvar()
    return eu()!
  },
  async eu() { return eu() },
  sair() { banco.sessao = undefined; salvar() },

  async meusAgendamentos() {
    await espera()
    return { agora: carimbo(new Date()), agendamentos: banco.agendamentos.filter((a) => a.clienteId === banco.sessao).sort((a, b) => b.inicio.localeCompare(a.inicio)).map(paraAgendamento) }
  },
  async agendar(d) {
    await espera()
    const sv = servico(d.servicoId)
    let prof = d.profissionalId
    if (prof === 'qualquer') prof = PROFS.find((p) => horariosDo(p.id, d.data, sv.duracao).includes(d.hora))?.id ?? ''
    if (!prof || !horariosDo(prof, d.data, sv.duracao).includes(d.hora)) throw new Error('Esse horário acabou de ser ocupado. Escolha outro.')
    const inicio = `${d.data} ${d.hora}`
    const a: Ag = { id: id(), clienteId: banco.sessao!, profissionalId: prof, servicoId: sv.id, inicio, fim: carimbo(new Date(ler(inicio).getTime() + sv.duracao * 60000)), preco: sv.preco, status: 'confirmado', origem: 'app' }
    banco.agendamentos.push(a)
    const c = cliente(a.clienteId)!
    msg(c.telefone, 'confirmacao', `Fala, ${c.nome.split(' ')[0]}! ✂️ Seu horário de *${sv.nome}* está confirmado para ${inicio.slice(8, 10)}/${inicio.slice(5, 7)} às ${d.hora}.`)
    salvar()
    return { id: a.id, profissionalId: prof, inicio }
  },
  async cancelar(aid) {
    const a = banco.agendamentos.find((x) => x.id === aid && x.clienteId === banco.sessao)
    if (!a) throw new Error('Agendamento não encontrado')
    if (a.inicio < carimbo(new Date(Date.now() + 120 * 60000))) throw new Error('Cancelamentos pelo app só até 2h antes. Fale com a barbearia pelo WhatsApp.')
    a.status = 'cancelado'
    salvar()
  },

  painel: {
    logado: () => !!banco.painel,
    async entrar(email, senha) {
      await espera()
      if (email.toLowerCase() !== 'dono@roque.local' || senha !== 'roque123') throw new Error('E-mail ou senha incorretos (demo: dono@roque.local / roque123)')
      banco.painel = true; salvar()
      return { nome: 'Dono', email, papel: 'dono', profissionalId: null }
    },
    sair() { banco.painel = false; salvar() },
    async eu() { return { nome: 'Dono', email: 'dono@roque.local', papel: 'dono', profissionalId: null } },
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
      return { agendamentos: ags, bloqueios }
    },
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
  },
}
