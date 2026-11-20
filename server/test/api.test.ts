/**
 * Testes da API (rodar: npm test). Usam banco em memória e um relógio fixo:
 * segunda-feira, 2030-03-04, 08:00.
 */
import './env.ts'
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance } from 'fastify'
import { abrirBanco, type DB } from '../src/db.ts'
import { criarApp } from '../src/app.ts'
import { definirRelogio } from '../src/tempo.ts'
import { rodarTarefas } from '../src/jobs.ts'

let app: FastifyInstance
let db: DB
let relogio = new Date(2030, 2, 4, 8, 0)
definirRelogio(() => relogio)

const SEG = '2030-03-04'
const TER = '2030-03-05'

before(async () => {
  db = abrirBanco(':memory:')
  app = await criarApp(db)
})

async function req(method: string, url: string, body?: unknown, token?: string) {
  const r = await app.inject({ method: method as 'GET', url, payload: body as object, headers: token ? { authorization: `Bearer ${token}` } : {} })
  return { status: r.statusCode, json: r.json() }
}

async function loginCliente(telefone: string, nome: string) {
  const c = await req('POST', '/api/auth/codigo', { telefone })
  assert.equal(c.status, 200)
  assert.match(c.json.codigoDemo, /^\d{6}$/)
  const v = await req('POST', '/api/auth/verificar', { telefone, codigo: c.json.codigoDemo, nome })
  assert.equal(v.status, 200)
  return v.json.token as string
}

const loginDono = async () => (await req('POST', '/api/admin/login', { email: 'dono@roque.local', senha: 'senha-teste' })).json.token as string

test('dados públicos da barbearia', async () => {
  const r = await req('GET', '/api/barbearia')
  assert.equal(r.status, 200)
  assert.equal(r.json.nome, 'Barbearia Roque')
  assert.ok(r.json.servicos.length >= 5)
  assert.deepEqual(r.json.horarios[0], null) // domingo fechado
})

test('horários respeitam duração e intervalo de almoço', async () => {
  const r = await req('GET', `/api/horarios?data=${SEG}&servico=combo&profissional=p1`)
  const h: string[] = r.json.horarios
  assert.ok(h.includes('10:30'))     // 10:30–11:40
  assert.ok(!h.includes('11:00'))    // terminaria 12:10, dentro do almoço
  assert.ok(!h.includes('12:00'))
  assert.ok(h.includes('13:00'))
  assert.ok(!h.includes('18:00'))    // terminaria 19:10, depois de fechar
  assert.ok(!h.includes('08:00'))
})

test('não mostra horários que já passaram', async () => {
  relogio = new Date(2030, 2, 4, 14, 10)
  const h: string[] = (await req('GET', `/api/horarios?data=${SEG}&servico=corte&profissional=p1`)).json.horarios
  assert.ok(!h.includes('14:00'))
  assert.ok(!h.includes('14:30')) // antecedência mínima de 30 min
  assert.ok(h.includes('15:00'))
  relogio = new Date(2030, 2, 4, 8, 0)
})

test('login com código errado é recusado e bloqueia após 5 tentativas', async () => {
  const tel = '27 99111-0000'
  await req('POST', '/api/auth/codigo', { telefone: tel })
  for (let i = 0; i < 5; i++) assert.equal((await req('POST', '/api/auth/verificar', { telefone: tel, codigo: '000000', nome: 'X Y' })).status, 400)
  assert.equal((await req('POST', '/api/auth/verificar', { telefone: tel, codigo: '000000', nome: 'X Y' })).status, 429)
})

test('rotas do cliente exigem login', async () => {
  assert.equal((await req('GET', '/api/me')).status, 401)
  assert.equal((await req('GET', '/api/admin/resumo')).status, 401)
})

test('fluxo completo: agendar, conflito, cancelar, lembretes, concluir, fidelidade', async () => {
  const joao = await loginCliente('(27) 99222-3333', 'João Teste')
  const maria = await loginCliente('27993334444', 'Maria Teste')

  // agenda corte com p1 às 15:00 na terça
  const a = await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: 'p1', data: TER, hora: '15:00' }, joao)
  assert.equal(a.status, 201)

  // mesmo horário com o mesmo profissional → conflito
  const b = await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: 'p1', data: TER, hora: '15:00' }, maria)
  assert.equal(b.status, 409)

  // 15:00 some da lista do p1, e o corte de 40 min também bloqueia 14:30 (terminaria 15:10)
  const h: string[] = (await req('GET', `/api/horarios?data=${TER}&servico=corte&profissional=p1`)).json.horarios
  assert.ok(!h.includes('15:00') && !h.includes('14:30') && h.includes('16:00'))

  // "sem preferência" escolhe outro profissional livre
  const c = await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: 'qualquer', data: TER, hora: '15:00' }, maria)
  assert.equal(c.status, 201)
  assert.notEqual(c.json.profissionalId, 'p1')

  // confirmação foi para o WhatsApp
  const dono = await loginDono()
  const msgs = (await req('GET', '/api/admin/mensagens', undefined, dono)).json as { tipo: string }[]
  assert.ok(msgs.filter((m) => m.tipo === 'confirmacao').length >= 2)

  // lembrete 24h: segunda 15:00 (24h antes de terça 15:00)
  relogio = new Date(2030, 2, 4, 15, 0)
  await rodarTarefas(db)
  // lembrete 1h: terça 14:05
  relogio = new Date(2030, 2, 5, 14, 5)
  await rodarTarefas(db)
  const tipos = ((await req('GET', '/api/admin/mensagens', undefined, dono)).json as { tipo: string }[]).map((m) => m.tipo)
  assert.equal(tipos.filter((t) => t === 'lembrete_24h').length, 2)
  assert.equal(tipos.filter((t) => t === 'lembrete_1h').length, 2)

  // cliente não cancela com menos de 2h
  const cancTarde = await req('POST', `/api/me/agendamentos/${a.json.id}/cancelar`, {}, joao)
  assert.equal(cancTarde.status, 400)

  // dono marca como concluído → selo no cartão
  assert.equal((await req('PATCH', `/api/admin/agendamentos/${a.json.id}`, { status: 'concluido' }, dono)).status, 200)
  const me = (await req('GET', '/api/me', undefined, joao)).json
  assert.equal(me.fidelidade.selos, 1)

  // resumo do dia no painel
  const resumo = (await req('GET', `/api/admin/resumo?data=${TER}`, undefined, dono)).json
  assert.equal(resumo.hoje.atendimentos, 2)
  assert.equal(resumo.hoje.recebido, 45)

  relogio = new Date(2030, 2, 4, 8, 0)
})

test('cliente cancela com antecedência e o horário volta a ficar livre', async () => {
  const t = await loginCliente('27994445555', 'Pedro Teste')
  const a = await req('POST', '/api/me/agendamentos', { servicoId: 'barba', profissionalId: 'p2', data: TER, hora: '10:00' }, t)
  assert.equal(a.status, 201)
  assert.equal((await req('POST', `/api/me/agendamentos/${a.json.id}/cancelar`, {}, t)).status, 200)
  const h: string[] = (await req('GET', `/api/horarios?data=${TER}&servico=barba&profissional=p2`)).json.horarios
  assert.ok(h.includes('10:00'))
})

test('bloqueio do dono tira os horários da agenda', async () => {
  const dono = await loginDono()
  assert.equal((await req('POST', '/api/admin/bloqueios', { profissionalId: 'p1', data: TER, inicio: '09:00', fim: '12:00', motivo: 'Médico' }, dono)).status, 201)
  const h: string[] = (await req('GET', `/api/horarios?data=${TER}&servico=corte&profissional=p1`)).json.horarios
  assert.ok(!h.includes('09:00') && !h.includes('11:00') && h.includes('13:00'))
})

test('dono altera preço e o app já mostra o novo valor', async () => {
  const dono = await loginDono()
  const r = await req('PUT', '/api/admin/servicos/corte', { nome: 'Corte', descricao: 'Novo', preco: 50, duracao: 40, destaque: true, ativo: true }, dono)
  assert.equal(r.status, 200)
  const s = (await req('GET', '/api/barbearia')).json.servicos.find((x: { id: string }) => x.id === 'corte')
  assert.equal(s.preco, 50)
})

test('agenda conjunta: barbeiro vê a casa toda, mas não vê faturamento nem ajustes', async () => {
  const dono = await loginDono()
  assert.equal((await req('POST', '/api/admin/usuarios', { nome: 'Barbeiro 1', email: 'b1@roque.local', senha: 'segredo1', profissionalId: 'p1' }, dono)).status, 201)
  const b1 = (await req('POST', '/api/admin/login', { email: 'b1@roque.local', senha: 'segredo1' })).json.token
  const agenda = (await req('GET', `/api/admin/agenda?data=${TER}`, undefined, b1)).json
  const profs = new Set(agenda.agendamentos.map((a: { profissionalId: string }) => a.profissionalId))
  assert.ok(profs.has('p1') && profs.has('p2'))
  // encaixe na agenda do outro barbeiro
  const enc = await req('POST', '/api/admin/agendamentos', { nome: 'Cliente Balcão', servicoId: 'barba', profissionalId: 'p2', data: TER, hora: '16:00' }, b1)
  assert.equal(enc.status, 201)
  assert.equal((await req('PUT', '/api/admin/servicos/corte', { nome: 'Corte', preco: 1, duracao: 40 }, b1)).status, 403)
  assert.equal((await req('GET', '/api/admin/usuarios', undefined, b1)).status, 403)
  const resumo = (await req('GET', `/api/admin/resumo?data=${TER}`, undefined, b1)).json
  assert.deepEqual(resumo.retorno, [])
  const usuarios = (await req('GET', '/api/admin/usuarios', undefined, dono)).json as { email: string }[]
  assert.ok(usuarios.some((u) => u.email === 'b1@roque.local'))
})

test('agendamento pelo app avisa o WhatsApp da barbearia', async () => {
  const dono = await loginDono()
  assert.equal((await req('PUT', '/api/admin/barbearia', { whatsapp: '+55 (27) 98888-7777' }, dono)).status, 200)
  const t = await loginCliente('27995556666', 'Carlos Teste')
  assert.equal((await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: 'p2', data: TER, hora: '17:00' }, t)).status, 201)
  const msgs = (await req('GET', '/api/admin/mensagens', undefined, dono)).json as { tipo: string; telefone: string; texto: string }[]
  const aviso = msgs.find((m) => m.tipo === 'aviso_novo')
  assert.ok(aviso && aviso.telefone === '5527988887777' && aviso.texto.includes('Carlos Teste'))
})

// ---------------------------------------------------------------------------
// v1.2: avaliação, aniversário, lista de espera, loja e equipe
// ---------------------------------------------------------------------------
const QUA = '2030-03-06'
const msgsDo = async (tipo: string) =>
  ((await req('GET', '/api/admin/mensagens', undefined, await loginDono())).json as { tipo: string; telefone: string; texto: string }[]).filter((m) => m.tipo === tipo)

test('avaliação: convite 1h depois do atendimento, nota única e média no painel', async () => {
  relogio = new Date(2030, 2, 4, 8, 0)
  const dono = await loginDono()
  const t = await loginCliente('27996660001', 'Ana Avaliadora')
  const a = await req('POST', '/api/me/agendamentos', { servicoId: 'barba', profissionalId: 'p2', data: SEG, hora: '10:00' }, t)
  assert.equal(a.status, 201)
  assert.equal((await req('PATCH', `/api/admin/agendamentos/${a.json.id}`, { status: 'concluido' }, dono)).status, 200)
  relogio = new Date(2030, 2, 4, 11, 31) // fim 10:30 + 1h
  await rodarTarefas(db)
  const convite = (await msgsDo('avaliacao')).find((m) => m.telefone === '5527996660001')
  assert.ok(convite?.texto.includes(`#avaliar/${a.json.id}`))
  const pagina = await req('GET', `/api/avaliacao/${a.json.id}`)
  assert.equal(pagina.status, 200)
  assert.equal(pagina.json.nota, null)
  assert.equal((await req('POST', `/api/avaliacao/${a.json.id}`, { nota: 5, comentario: 'Top' })).status, 201)
  assert.equal((await req('POST', `/api/avaliacao/${a.json.id}`, { nota: 1 })).status, 409)
  const av = (await req('GET', '/api/admin/avaliacoes', undefined, dono)).json
  assert.equal(av.total, 1)
  assert.equal(av.media, 5)
  relogio = new Date(2030, 2, 4, 8, 0)
})

test('aniversário: cupom no dia, uma vez por ano, aplicado sozinho no agendamento', async () => {
  const t = await loginCliente('27996660002', 'Bruno Aniversariante')
  assert.equal((await req('PUT', '/api/me', { aniversario: '03-04' }, t)).status, 200)
  relogio = new Date(2030, 2, 4, 9, 30)
  await rodarTarefas(db)
  await rodarTarefas(db)
  assert.equal((await msgsDo('aniversario')).filter((m) => m.telefone === '5527996660002').length, 1)
  const me = (await req('GET', '/api/me', undefined, t)).json
  assert.equal(me.cupom.desconto, 15)
  const preco = (await req('GET', '/api/barbearia')).json.servicos.find((s: { id: string }) => s.id === 'corte').preco
  const a = await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: 'p1', data: QUA, hora: '16:00' }, t)
  assert.equal(a.status, 201)
  assert.equal(a.json.desconto, Math.round(preco * 15) / 100)
  assert.equal((await req('GET', '/api/me', undefined, t)).json.cupom, null) // já usado
  relogio = new Date(2030, 2, 4, 8, 0)
})

test('lista de espera: avisa um por vez, na ordem, quando abre vaga', async () => {
  const dono = await loginDono()
  const D = '2030-03-07'
  assert.equal((await req('POST', '/api/admin/bloqueios', { profissionalId: 'todos', data: D, inicio: '08:00', fim: '21:00', motivo: 'Evento' }, dono)).status, 201)
  const c1 = await loginCliente('27996660003', 'Caio Primeiro')
  const c2 = await loginCliente('27996660004', 'Davi Segundo')
  assert.equal((await req('POST', '/api/me/espera', { servicoId: 'corte', profissionalId: 'qualquer', data: D }, c1)).status, 201)
  assert.equal((await req('POST', '/api/me/espera', { servicoId: 'corte', profissionalId: 'qualquer', data: D }, c2)).status, 201)
  // dia com vaga não entra na lista
  assert.equal((await req('POST', '/api/me/espera', { servicoId: 'corte', profissionalId: 'p1', data: QUA }, c1)).status, 400)
  const ag = (await req('GET', `/api/admin/agenda?data=${D}`, undefined, dono)).json
  assert.equal(ag.espera.length, 2)
  for (const b of ag.bloqueios) await req('DELETE', `/api/admin/bloqueios/${b.id}`, undefined, dono)
  relogio = new Date(2030, 2, 6, 10, 0)
  await rodarTarefas(db)
  relogio = new Date(2030, 2, 6, 10, 15)
  await rodarTarefas(db)
  let avisos = (await msgsDo('espera')).map((m) => m.telefone)
  assert.deepEqual(avisos, ['5527996660003'])
  relogio = new Date(2030, 2, 6, 10, 31)
  await rodarTarefas(db)
  avisos = (await msgsDo('espera')).map((m) => m.telefone)
  assert.ok(avisos.includes('5527996660004'))
  relogio = new Date(2030, 2, 4, 8, 0)
})

test('loja: reservar produtos, avisar a barbearia e marcar como separado', async () => {
  const dono = await loginDono()
  const produtos = (await req('GET', '/api/produtos')).json as { id: string; preco: number }[]
  assert.ok(produtos.length >= 4)
  const t = await loginCliente('27996660005', 'Edu Comprador')
  const p = await req('POST', '/api/me/pedidos', { itens: [{ produtoId: produtos[0].id, qtd: 2 }] }, t)
  assert.equal(p.status, 201)
  assert.equal(p.json.total, produtos[0].preco * 2)
  assert.ok((await msgsDo('aviso_pedido')).some((m) => m.texto.includes('Edu Comprador')))
  const abertos = (await req('GET', '/api/admin/pedidos', undefined, dono)).json as { id: string }[]
  assert.ok(abertos.some((o) => o.id === p.json.id))
  assert.equal((await req('PATCH', `/api/admin/pedidos/${p.json.id}`, { status: 'separado' }, dono)).status, 200)
  assert.equal((await msgsDo('pedido_separado')).length, 1)
  assert.equal((await req('POST', `/api/me/pedidos/${p.json.id}/cancelar`, {}, t)).status, 400) // já separado
})

test('equipe: adicionar barbeiro (já com horário) e excluir', async () => {
  const dono = await loginDono()
  const novo = await req('POST', '/api/admin/profissionais', { nome: 'Barbeiro Novo', especialidade: 'Degradê' }, dono)
  assert.equal(novo.status, 201)
  const pub = (await req('GET', '/api/barbearia')).json
  assert.ok(pub.profissionais.some((p: { id: string }) => p.id === novo.json.id))
  const h = (await req('GET', `/api/horarios?data=${QUA}&servico=corte&profissional=${novo.json.id}`)).json.horarios as string[]
  assert.ok(h.length > 0) // copiou o expediente
  const t = await loginCliente('27996660006', 'Fabio Cliente')
  const a = await req('POST', '/api/me/agendamentos', { servicoId: 'corte', profissionalId: novo.json.id, data: QUA, hora: h[0] }, t)
  assert.equal(a.status, 201)
  assert.equal((await req('DELETE', `/api/admin/profissionais/${novo.json.id}`, undefined, dono)).status, 409)
  await req('PATCH', `/api/admin/agendamentos/${a.json.id}`, { status: 'cancelado' }, dono)
  assert.equal((await req('DELETE', `/api/admin/profissionais/${novo.json.id}`, undefined, dono)).status, 200)
  const depois = (await req('GET', '/api/barbearia')).json
  assert.ok(!depois.profissionais.some((p: { id: string }) => p.id === novo.json.id))
  const equipe = (await req('GET', '/api/admin/profissionais', undefined, dono)).json as { id: string }[]
  assert.ok(!equipe.some((p) => p.id === novo.json.id))
})
