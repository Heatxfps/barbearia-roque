/** Rotas do cliente logado: perfil, fidelidade, agendar, cancelar. */
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import type { DB } from '../db.ts'
import { exigirCliente } from '../auth.ts'
import { agora, carimbo, dataValida, horaValida } from '../tempo.ts'
import { ErroNegocio, cancelarAgendamento, criarAgendamento, fidelidade } from '../servicos-agendamento.ts'

export async function rotasCliente(app: FastifyInstance, db: DB) {
  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/me')) await exigirCliente(req, reply)
  })

  const idCliente = (u: unknown) => (u as { id: string }).id

  app.get('/me', async (req) => {
    const c = db.prepare('SELECT id, nome, telefone FROM clientes WHERE id = ?').get(idCliente(req.user))
    if (!c) throw new ErroNegocio('Cliente não encontrado', 401)
    return { ...c, fidelidade: fidelidade(db, idCliente(req.user)) }
  })

  app.get('/me/agendamentos', async (req) => {
    const lista = db.prepare(`SELECT a.id, a.servico_id AS servicoId, a.profissional_id AS profissionalId, a.inicio, a.fim, a.preco, a.status,
                                     s.nome AS servico, p.nome AS profissional
                              FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                              WHERE a.cliente_id = ? ORDER BY a.inicio DESC LIMIT 100`).all(idCliente(req.user))
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
    cancelarAgendamento(db, id, idCliente(req.user))
    return { ok: true }
  })
}
