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
  // log sem dados pessoais: grava só método e caminho (sem ?busca=telefone, sem IP, sem cabeçalhos)
  const app = Fastify({
    trustProxy: true,
    logger: opcoes.logger ? { serializers: { req: (r) => ({ method: r.method, url: r.url.split('?')[0] }), res: (r) => ({ statusCode: r.statusCode }) } } : false,
  })

  await app.register(cors, { origin: config.origemApp === '*' ? true : config.origemApp.split(',') })
  await app.register(jwt, { secret: config.jwtSegredo })
  // LIMITE_TENTATIVAS=0 desliga os limites (só nos testes automáticos)
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute', allowList: () => process.env.LIMITE_TENTATIVAS === '0' })

  // cabeçalhos de segurança em todas as respostas
  //  - CSP: só carrega script, estilo, fonte e imagem do próprio app (sem terceiros)
  //  - frame-ancestors/X-Frame-Options: ninguém embute o app ou o painel em outro site
  //  - Permissions-Policy: o app não usa câmera, microfone nem localização
  const CSP = ["default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "font-src 'self'", "media-src 'self'", "connect-src 'self'", "manifest-src 'self'", "worker-src 'self'",
    "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'"].join('; ')
  app.addHook('onSend', async (req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()')
    reply.header('Cross-Origin-Opener-Policy', 'same-origin')
    if (req.url.startsWith('/api')) reply.header('Cache-Control', 'no-store')
    else reply.header('Content-Security-Policy', CSP)
  })

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
