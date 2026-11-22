/** Monta o servidor (separado do index.ts para os testes usarem). */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import fastifyStatic from '@fastify/static'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { ZodError } from 'zod'
import type { DB } from './db.ts'
import { config, pastaFotos } from './config.ts'
import { ErroNegocio } from './servicos-agendamento.ts'
import { rotasPublicas } from './rotas/publicas.ts'
import { rotasCliente } from './rotas/cliente.ts'
import { rotasAdmin } from './rotas/admin.ts'

import './auth.ts'

export async function criarApp(db: DB, opcoes: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opcoes.logger ?? false, trustProxy: true })

  await app.register(cors, { origin: config.origemApp === '*' ? true : config.origemApp.split(',') })
  await app.register(jwt, { secret: config.jwtSegredo })
  // LIMITE_TENTATIVAS=0 desliga os limites (só nos testes automáticos)
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute', allowList: () => process.env.LIMITE_TENTATIVAS === '0' })

  app.setErrorHandler((erro, _req, reply) => {
    if (erro instanceof ErroNegocio) return reply.status(erro.status).send({ erro: erro.message })
    if (erro instanceof ZodError) return reply.status(400).send({ erro: 'Dados inválidos', detalhes: erro.issues.map((i) => `${i.path.join('.')}: ${i.message}`) })
    if ((erro as { statusCode?: number }).statusCode === 429) return reply.status(429).send({ erro: 'Muitas tentativas. Aguarde um pouco.' })
    app.log.error(erro)
    return reply.status(500).send({ erro: 'Erro interno' })
  })

  app.get('/api/saude', async () => ({ ok: true, whatsapp: config.whatsapp.modo }))

  await app.register(async (r) => rotasPublicas(r, db), { prefix: '/api' })
  await app.register(async (r) => rotasCliente(r, db), { prefix: '/api' })
  await app.register(async (r) => rotasAdmin(r, db), { prefix: '/api/admin' })

  // fotos enviadas pelo painel (barbeiros e produtos)
  const fotos = pastaFotos() ? resolve(pastaFotos()) : ''
  if (fotos) {
    mkdirSync(fotos, { recursive: true })
    await app.register(fastifyStatic, { root: fotos, prefix: '/fotos/', decorateReply: false, maxAge: '30d', immutable: true })
  }

  // em produção, o mesmo servidor entrega o app (PWA)
  const pasta = resolve(config.pastaApp)
  if (existsSync(resolve(pasta, 'index.html'))) {
    await app.register(fastifyStatic, { root: pasta, wildcard: false })
    // painel da equipe: página separada do app do cliente
    app.get('/painel', (_req, reply) => reply.sendFile('painel.html'))
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api')) return reply.status(404).send({ erro: 'Rota não encontrada' })
      return reply.sendFile('index.html')
    })
  }

  return app
}
