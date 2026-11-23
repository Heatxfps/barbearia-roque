/** Rotas do cliente logado: perfil, fidelidade, agendar, cancelar, lista de espera e pedidos da loja. */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DB } from '../db.ts'
import { lerBarbearia, novoId, transacao } from '../db.ts'
import { exigirCliente } from '../auth.ts'
import { agora, carimbo, dataIso, dataValida, horaValida } from '../tempo.ts'
import { ErroNegocio, avisarBarbeariaTexto, cancelarAgendamento, criarAgendamento, cupomAtivo, fidelidade } from '../servicos-agendamento.ts'
import { aceitarAdiantar } from '../fila.ts'
import { horariosLivres } from '../agenda.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { montar } from '../mensagens.ts'

/** "MM-DD" válido (aceita 29/02) */
export const aniversarioValido = (s: string) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(s) && !Number.isNaN(new Date(`2000-${s}T12:00`).getTime())
const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export async function rotasCliente(app: FastifyInstance, db: DB) {
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/me')) return
    await exigirCliente(req, reply)
    if (reply.sent) return
    // conta apagada: o login antigo deixa de valer
    const id = (req.user as { id?: string } | undefined)?.id
    if (id && db.prepare("SELECT 1 FROM clientes WHERE id = ? AND telefone LIKE 'balcao-removido-%'").get(id))
      return reply.status(401).send({ erro: 'Conta removida' })
  })

  const idCliente = (u: unknown) => (u as { id: string }).id

  app.get('/me', async (req) => {
    const c = db.prepare('SELECT id, nome, telefone, aniversario FROM clientes WHERE id = ?').get(idCliente(req.user))
    if (!c) throw new ErroNegocio('Cliente não encontrado', 401)
    const cupom = cupomAtivo(db, idCliente(req.user))
    return {
      ...c, fidelidade: fidelidade(db, idCliente(req.user)),
      cupom: cupom ? { motivo: cupom.motivo, desconto: cupom.desconto_pct, validoAte: cupom.valido_ate } : null,
    }
  })

  app.put('/me', async (req) => {
    const b = z.object({
      nome: z.string().trim().min(2).max(60).optional(),
      aniversario: z.string().refine(aniversarioValido, 'Data inválida').nullable().optional(),
    }).parse(req.body)
    const id = idCliente(req.user)
    if (b.nome) db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(b.nome, id)
    if (b.aniversario !== undefined) db.prepare('UPDATE clientes SET aniversario = ? WHERE id = ?').run(b.aniversario, id)
    return { ok: true }
  })

  app.get('/me/agendamentos', async (req) => {
    const lista = db.prepare(`SELECT a.id, a.servico_id AS servicoId, a.profissional_id AS profissionalId, a.inicio, a.fim, a.preco, a.desconto, a.status,
                                     s.nome AS servico, p.nome AS profissional, v.nota AS avaliacao,
                                     CASE WHEN a.status = 'confirmado' AND a.adiantar_ate > ? THEN a.adiantar_para END AS adiantarPara
                              FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                              LEFT JOIN avaliacoes v ON v.agendamento_id = a.id
                              WHERE a.cliente_id = ? ORDER BY a.inicio DESC LIMIT 100`).all(carimbo(agora()), idCliente(req.user))
    return { agora: carimbo(agora()), agendamentos: lista }
  })

  app.post('/me/agendamentos', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const b = z.object({
      servicoId: z.string(), profissionalId: z.string(),
      data: z.string().refine(dataValida, 'data inválida'), hora: z.string().refine(horaValida, 'hora inválida'),
    }).parse(req.body)
    // no máximo 3 horários futuros por cliente (evita abuso)
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE cliente_id = ? AND status = 'confirmado' AND inicio > ?")
      .get(idCliente(req.user), carimbo(agora())) as { n: number }
    if (n >= 3) throw new ErroNegocio('Você já tem 3 horários marcados. Cancele um para marcar outro.')
    const r = criarAgendamento(db, { ...b, clienteId: idCliente(req.user), origem: 'app' })
    return reply.status(201).send(r)
  })

  app.post('/me/agendamentos/:id/cancelar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const { remarcar } = z.object({ remarcar: z.boolean().default(false) }).parse(req.body ?? {})
    cancelarAgendamento(db, id, idCliente(req.user), remarcar)
    return { ok: true }
  })

  /** aceitar o convite "pode adiantar" pelo app (Meus horários) */
  app.post('/me/agendamentos/:id/adiantar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    return aceitarAdiantar(db, id, idCliente(req.user))
  })

  // ---------- lista de espera ----------
  const listarEspera = (clienteId: string) => db.prepare(`SELECT e.id, e.data, e.servico_id AS servicoId, s.nome AS servico, e.profissional_id AS profissionalId,
                                                                 COALESCE(p.nome, 'Sem preferência') AS profissional, e.avisado_em AS avisadoEm
                                                          FROM espera e JOIN servicos s ON s.id = e.servico_id LEFT JOIN profissionais p ON p.id = e.profissional_id
                                                          WHERE e.cliente_id = ? AND e.data >= ? ORDER BY e.data`).all(clienteId, dataIso(agora()))

  app.get('/me/espera', async (req) => listarEspera(idCliente(req.user)))

  app.post('/me/espera', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const b = z.object({ servicoId: z.string(), profissionalId: z.string(), data: z.string().refine(dataValida) }).parse(req.body)
    const id = idCliente(req.user)
    if (b.data < dataIso(agora())) throw new ErroNegocio('Essa data já passou')
    const s = db.prepare('SELECT duracao FROM servicos WHERE id = ? AND ativo = 1').get(b.servicoId) as { duracao: number } | undefined
    if (!s) throw new ErroNegocio('Serviço não encontrado', 404)
    if (b.profissionalId !== 'qualquer' && !db.prepare('SELECT 1 FROM profissionais WHERE id = ? AND ativo = 1').get(b.profissionalId)) throw new ErroNegocio('Barbeiro não encontrado', 404)
    if (horariosLivres(db, b.profissionalId, b.data, s.duracao).length) throw new ErroNegocio('Ainda tem horário livre nesse dia. É só escolher!')
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM espera WHERE cliente_id = ? AND data >= ?').get(id, dataIso(agora())) as { n: number }
    if (n >= 3) throw new ErroNegocio('Você já está em 3 listas de espera.')
    db.prepare('DELETE FROM espera WHERE cliente_id = ? AND data = ?').run(id, b.data)
    db.prepare('INSERT INTO espera (id, cliente_id, servico_id, profissional_id, data, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(novoId(), id, b.servicoId, b.profissionalId, b.data, carimbo(agora()))
    const { pos } = db.prepare('SELECT COUNT(*) AS pos FROM espera WHERE data = ? AND avisado_em IS NULL').get(b.data) as { pos: number }
    return reply.status(201).send({ posicao: pos })
  })

  app.delete('/me/espera/:id', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    db.prepare('DELETE FROM espera WHERE id = ? AND cliente_id = ?').run(id, idCliente(req.user))
    return { ok: true }
  })

  // ---------- loja: reservar para retirar ----------
  app.get('/me/pedidos', async (req) => {
    const pedidos = db.prepare('SELECT id, status, total, criado_em AS criadoEm FROM pedidos WHERE cliente_id = ? ORDER BY criado_em DESC LIMIT 20')
      .all(idCliente(req.user)) as { id: string }[]
    return pedidos.map((p) => ({ ...p, itens: db.prepare('SELECT nome, preco, qtd FROM pedido_itens WHERE pedido_id = ?').all(p.id) }))
  })

  app.post('/me/pedidos', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const b = z.object({
      itens: z.array(z.object({ produtoId: z.string(), qtd: z.number().int().min(1).max(10) })).min(1).max(20),
      observacao: z.string().trim().max(200).default(''),
    }).parse(req.body)
    const clienteId = idCliente(req.user)
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM pedidos WHERE cliente_id = ? AND status IN ('novo','separado')").get(clienteId) as { n: number }
    if (n >= 3) throw new ErroNegocio('Você já tem 3 pedidos aguardando retirada.')
    const pedidoId = novoId()
    const itens = transacao(db, () => {
      const lista = b.itens.map((i) => {
        const p = db.prepare('SELECT id, nome, preco FROM produtos WHERE id = ? AND ativo = 1').get(i.produtoId) as { id: string; nome: string; preco: number } | undefined
        if (!p) throw new ErroNegocio('Um dos produtos não está mais disponível. Atualize a loja.', 409)
        return { ...p, qtd: i.qtd }
      })
      const total = lista.reduce((t, i) => t + i.preco * i.qtd, 0)
      db.prepare('INSERT INTO pedidos (id, cliente_id, total, observacao, criado_em) VALUES (?, ?, ?, ?, ?)').run(pedidoId, clienteId, total, b.observacao, carimbo(agora()))
      for (const i of lista) db.prepare('INSERT INTO pedido_itens (pedido_id, produto_id, nome, preco, qtd) VALUES (?, ?, ?, ?, ?)').run(pedidoId, i.id, i.nome, i.preco, i.qtd)
      return lista
    })
    const c = db.prepare('SELECT nome, telefone FROM clientes WHERE id = ?').get(clienteId) as { nome: string; telefone: string }
    const total = itens.reduce((t, i) => t + i.preco * i.qtd, 0)
    const resumo = itens.map((i) => `• ${i.qtd}× ${i.nome}`).join('\n')
    const txtCliente = montar(db, 'pedido', { nome: c.nome.split(' ')[0], itens: resumo, total: moeda(total) })
    if (txtCliente) void enviarWhatsApp(db, c.telefone, 'pedido', txtCliente, pedidoId)
    const txtCasa = montar(db, 'aviso_pedido', { nome: c.nome, telefone: c.telefone, itens: resumo + (b.observacao ? `\nObs.: ${b.observacao}` : ''), total: moeda(total) })
    if (txtCasa) void avisarBarbeariaTexto(db, 'aviso_pedido', txtCasa)
    return reply.status(201).send({ id: pedidoId, total })
  })

  /** Privacidade: tudo o que a barbearia guarda sobre o cliente (para baixar) */
  app.get('/me/dados', async (req) => {
    const id = idCliente(req.user)
    const c = db.prepare('SELECT nome, telefone, aniversario, criado_em AS criadoEm FROM clientes WHERE id = ?').get(id)
    if (!c) throw new ErroNegocio('Cliente não encontrado', 401)
    const tel = (c as { telefone: string }).telefone
    return {
      geradoEm: carimbo(agora()),
      cadastro: c,
      horarios: db.prepare(`SELECT a.inicio, s.nome AS servico, p.nome AS barbeiro, a.preco, a.status FROM agendamentos a
                            JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id WHERE a.cliente_id = ? ORDER BY a.inicio`).all(id),
      avaliacoes: db.prepare('SELECT nota, comentario, criado_em AS criadoEm FROM avaliacoes WHERE cliente_id = ?').all(id),
      cupons: db.prepare('SELECT motivo, desconto_pct AS desconto, valido_ate AS validoAte FROM cupons WHERE cliente_id = ?').all(id),
      pedidos: db.prepare('SELECT status, total, criado_em AS criadoEm FROM pedidos WHERE cliente_id = ?').all(id),
      listaDeEspera: db.prepare('SELECT data FROM espera WHERE cliente_id = ?').all(id),
      mensagensWhatsApp: db.prepare('SELECT tipo, texto, criado_em AS criadoEm FROM mensagens WHERE telefone = ? ORDER BY criado_em').all(tel),
    }
  })

  /** Privacidade: apagar a conta. Nome, WhatsApp, aniversário, mensagens e avaliações somem;
   *  os horários passados ficam só como número no caixa da barbearia, sem dizer de quem eram. */
  app.delete('/me', async (req) => {
    const id = idCliente(req.user)
    const c = db.prepare('SELECT telefone FROM clientes WHERE id = ?').get(id) as { telefone: string } | undefined
    if (!c) throw new ErroNegocio('Cliente não encontrado', 401)
    const futuros = db.prepare("SELECT id FROM agendamentos WHERE cliente_id = ? AND status = 'confirmado' AND inicio > ?").all(id, carimbo(agora())) as { id: string }[]
    for (const a of futuros) cancelarAgendamento(db, a.id, undefined, true)
    transacao(db, () => {
      db.prepare('DELETE FROM mensagens WHERE telefone = ?').run(c.telefone)
      db.prepare('DELETE FROM codigos WHERE telefone = ?').run(c.telefone)
      db.prepare('DELETE FROM espera WHERE cliente_id = ?').run(id)
      db.prepare('DELETE FROM cupons WHERE cliente_id = ?').run(id)
      db.prepare("UPDATE avaliacoes SET comentario = '' WHERE cliente_id = ?").run(id)
      db.prepare("UPDATE pedidos SET status = 'cancelado', observacao = '' WHERE cliente_id = ? AND status IN ('novo','separado')").run(id)
      db.prepare("UPDATE clientes SET nome = 'Cliente removido', telefone = ?, aniversario = NULL, aniversario_ano = NULL, aviso_retorno_em = NULL WHERE id = ?")
        .run(`balcao-removido-${id}`, id) // "balcao-" = sem WhatsApp: nenhuma mensagem automática vai para ele
    })
    return { ok: true }
  })

  app.post('/me/pedidos/:id/cancelar', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params)
    const r = db.prepare("UPDATE pedidos SET status = 'cancelado' WHERE id = ? AND cliente_id = ? AND status = 'novo'").run(id, idCliente(req.user))
    if (!r.changes) throw new ErroNegocio('Esse pedido já foi separado. Fale com a barbearia.')
    return { ok: true }
  })
}
