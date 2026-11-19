/** Tipos da sessão (token JWT) e guardas de rota. */
import type { FastifyReply, FastifyRequest } from 'fastify'

export type Sessao =
  | { tipo: 'cliente'; id: string }
  | { tipo: 'admin'; id: string; papel: 'dono' | 'barbeiro'; profissionalId: string | null }

declare module '@fastify/jwt' {
  interface FastifyJWT { payload: Sessao; user: Sessao }
}

export async function exigirCliente(req: FastifyRequest, reply: FastifyReply) {
  try { await req.jwtVerify() } catch { return reply.status(401).send({ erro: 'Faça login para continuar' }) }
  if (req.user.tipo !== 'cliente') return reply.status(403).send({ erro: 'Acesso negado' })
}

export async function exigirAdmin(req: FastifyRequest, reply: FastifyReply) {
  try { await req.jwtVerify() } catch { return reply.status(401).send({ erro: 'Faça login no painel' }) }
  if (req.user.tipo !== 'admin') return reply.status(403).send({ erro: 'Acesso negado' })
}

export async function exigirDono(req: FastifyRequest, reply: FastifyReply) {
  await exigirAdmin(req, reply)
  if (reply.sent) return
  if (req.user.tipo === 'admin' && req.user.papel !== 'dono') return reply.status(403).send({ erro: 'Só o dono pode fazer isso' })
}
