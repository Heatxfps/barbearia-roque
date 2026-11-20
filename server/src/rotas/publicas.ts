/** Rotas abertas: dados da barbearia, horários livres e login por código no WhatsApp. */
import type { FastifyInstance } from 'fastify'
import { createHash, randomInt } from 'node:crypto'
import { z } from 'zod'
import type { DB } from '../db.ts'
import { lerBarbearia, novoId } from '../db.ts'
import { config } from '../config.ts'
import { horariosLivres } from '../agenda.ts'
import { agora, carimbo, dataIso, dataValida, normalizarTelefone } from '../tempo.ts'
import { ErroNegocio, buscarServico } from '../servicos-agendamento.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { aniversarioValido } from './cliente.ts'
import { textos } from '../textos.ts'

const hashCodigo = (tel: string, c: string) => createHash('sha256').update(`${tel}:${c}:${config.jwtSegredo}`).digest('hex')

export function horariosDaCasa(db: DB) {
  // abre/fecha de cada dia = menor início e maior fim entre os profissionais
  const linhas = db.prepare(`SELECT e.dia, MIN(e.inicio) AS abre, MAX(e.fim) AS fecha FROM expediente e
                             JOIN profissionais p ON p.id = e.profissional_id AND p.ativo = 1 GROUP BY e.dia`).all() as { dia: number; abre: string; fecha: string }[]
  const out: Record<number, [string, string] | null> = { 0: null, 1: null, 2: null, 3: null, 4: null, 5: null, 6: null }
  for (const l of linhas) out[l.dia] = [l.abre, l.fecha]
  return out
}

export async function rotasPublicas(app: FastifyInstance, db: DB) {
  app.get('/barbearia', async () => {
    const info = lerBarbearia(db)
    const servicos = (db.prepare('SELECT id, nome, descricao, preco, duracao, destaque FROM servicos WHERE ativo = 1 ORDER BY ordem').all() as { destaque: number }[])
      .map((s) => ({ ...s, destaque: !!s.destaque }))
    const profissionais = db.prepare('SELECT id, nome, especialidade, foto FROM profissionais WHERE ativo = 1 ORDER BY ordem').all()
    const { dono, dono_foto, google_avaliacao, desconto_aniversario, produtos_semeados: _, ...resto } = info
    return {
      ...resto,
      dono: dono ? { nome: dono, foto: dono_foto ?? null } : null,
      googleAvaliacao: google_avaliacao ?? '',
      descontoAniversario: Number(desconto_aniversario ?? 15),
      horarios: horariosDaCasa(db),
      fidelidadeMeta: config.regras.fidelidadeMeta,
      diasAgenda: config.regras.diasAgenda,
      antecedenciaCancelarMin: config.regras.antecedenciaCancelarMin,
      whatsappModo: config.whatsapp.modo,
      servicos,
      profissionais,
    }
  })

  /** Loja: produtos à venda (reserva e retirada na barbearia) */
  app.get('/produtos', async () => db.prepare('SELECT id, nome, descricao, preco, foto FROM produtos WHERE ativo = 1 ORDER BY ordem, nome').all())

  /** Avaliação pós-atendimento: o link do WhatsApp leva o id do atendimento (aleatório, difícil de adivinhar) */
  const dadosAvaliacao = (id: string) => db.prepare(`SELECT a.id, a.inicio, a.status, s.nome AS servico, p.nome AS profissional, p.foto, c.nome AS cliente, v.nota, v.comentario
                                                   FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                                                   JOIN clientes c ON c.id = a.cliente_id LEFT JOIN avaliacoes v ON v.agendamento_id = a.id
                                                   WHERE a.id = ?`).get(id) as
    { id: string; inicio: string; status: string; servico: string; profissional: string; foto: string | null; cliente: string; nota: number | null; comentario: string | null } | undefined

  app.get('/avaliacao/:id', async (req) => {
    const { id } = z.object({ id: z.string().max(40) }).parse(req.params)
    const a = dadosAvaliacao(id)
    if (!a || a.status !== 'concluido') throw new ErroNegocio('Atendimento não encontrado', 404)
    return { ...a, cliente: a.cliente.split(' ')[0], googleAvaliacao: lerBarbearia(db).google_avaliacao ?? '' }
  })

  app.post('/avaliacao/:id', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req, reply) => {
    const { id } = z.object({ id: z.string().max(40) }).parse(req.params)
    const b = z.object({ nota: z.number().int().min(1).max(5), comentario: z.string().trim().max(500).default('') }).parse(req.body)
    const a = db.prepare("SELECT cliente_id, profissional_id FROM agendamentos WHERE id = ? AND status = 'concluido'").get(id) as { cliente_id: string; profissional_id: string } | undefined
    if (!a) throw new ErroNegocio('Atendimento não encontrado', 404)
    if (db.prepare('SELECT 1 FROM avaliacoes WHERE agendamento_id = ?').get(id)) throw new ErroNegocio('Esse atendimento já foi avaliado. Obrigado!', 409)
    db.prepare('INSERT INTO avaliacoes (id, agendamento_id, cliente_id, profissional_id, nota, comentario, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(novoId(), id, a.cliente_id, a.profissional_id, b.nota, b.comentario, carimbo(agora()))
    return reply.status(201).send({ ok: true })
  })

  /** Próximos dias com expediente e se ainda há vaga */
  app.get('/dias', async (req) => {
    const q = z.object({ servico: z.string(), profissional: z.string().default('qualquer') }).parse(req.query)
    const servico = buscarServico(db, q.servico)
    const dias: { data: string; livres: number }[] = []
    const d = agora(); d.setHours(0, 0, 0, 0)
    for (let i = 0; i < config.regras.diasAgenda; i++) {
      const data = dataIso(d)
      const livres = horariosLivres(db, q.profissional, data, servico.duracao).length
      const temExpediente = db.prepare('SELECT 1 FROM expediente WHERE dia = ?').get(d.getDay())
      if (temExpediente) dias.push({ data, livres })
      d.setDate(d.getDate() + 1)
    }
    return dias
  })

  app.get('/horarios', async (req) => {
    const q = z.object({ data: z.string().refine(dataValida), servico: z.string(), profissional: z.string().default('qualquer') }).parse(req.query)
    const servico = buscarServico(db, q.servico)
    return { data: q.data, horarios: horariosLivres(db, q.profissional, q.data, servico.duracao) }
  })

  /** 1º passo do login: manda um código de 6 dígitos no WhatsApp */
  app.post('/auth/codigo', { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } }, async (req) => {
    const body = z.object({ telefone: z.string() }).parse(req.body)
    const tel = normalizarTelefone(body.telefone)
    if (!tel) throw new ErroNegocio('WhatsApp inválido. Use DDD + número.')
    const anterior = db.prepare('SELECT enviado_em FROM codigos WHERE telefone = ?').get(tel) as { enviado_em: number } | undefined
    if (anterior && Date.now() - anterior.enviado_em < 45_000) throw new ErroNegocio('Aguarde alguns segundos para pedir outro código.', 429)

    const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
    db.prepare(`INSERT INTO codigos (telefone, codigo_hash, expira_em, enviado_em, tentativas) VALUES (?, ?, ?, ?, 0)
                ON CONFLICT(telefone) DO UPDATE SET codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, enviado_em = excluded.enviado_em, tentativas = 0`)
      .run(tel, hashCodigo(tel, codigo), Date.now() + 10 * 60_000, Date.now())
    await enviarWhatsApp(db, tel, 'codigo', textos.codigo(codigo, lerBarbearia(db).nome))

    const jaCliente = !!db.prepare('SELECT 1 FROM clientes WHERE telefone = ?').get(tel)
    // no modo demonstração o código volta na resposta (não há WhatsApp conectado)
    return { enviado: true, jaCliente, ...(config.whatsapp.modo === 'demo' ? { codigoDemo: codigo } : {}) }
  })

  /** 2º passo: confere o código e devolve o token de acesso */
  app.post('/auth/verificar', async (req) => {
    const body = z.object({
      telefone: z.string(), codigo: z.string().regex(/^\d{6}$/), nome: z.string().trim().min(2).max(60).optional(),
      aniversario: z.string().refine(aniversarioValido).optional(),
    }).parse(req.body)
    const tel = normalizarTelefone(body.telefone)
    if (!tel) throw new ErroNegocio('WhatsApp inválido')
    const reg = db.prepare('SELECT codigo_hash, expira_em, tentativas FROM codigos WHERE telefone = ?').get(tel) as
      { codigo_hash: string; expira_em: number; tentativas: number } | undefined
    if (!reg || reg.expira_em < Date.now()) throw new ErroNegocio('Código expirado. Peça um novo.')
    if (reg.tentativas >= 5) throw new ErroNegocio('Muitas tentativas. Peça um novo código.', 429)
    if (reg.codigo_hash !== hashCodigo(tel, body.codigo)) {
      db.prepare('UPDATE codigos SET tentativas = tentativas + 1 WHERE telefone = ?').run(tel)
      throw new ErroNegocio('Código incorreto')
    }
    db.prepare('DELETE FROM codigos WHERE telefone = ?').run(tel)

    let cliente = db.prepare('SELECT id, nome, telefone FROM clientes WHERE telefone = ?').get(tel) as { id: string; nome: string; telefone: string } | undefined
    if (!cliente) {
      if (!body.nome) throw new ErroNegocio('Informe seu nome')
      cliente = { id: novoId(), nome: body.nome, telefone: tel }
      db.prepare('INSERT INTO clientes (id, nome, telefone, criado_em, aniversario) VALUES (?, ?, ?, ?, ?)').run(cliente.id, cliente.nome, tel, carimbo(agora()), body.aniversario ?? null)
    } else if (body.nome && body.nome !== cliente.nome) {
      db.prepare('UPDATE clientes SET nome = ? WHERE id = ?').run(body.nome, cliente.id)
      cliente.nome = body.nome
    }
    const token = app.jwt.sign({ tipo: 'cliente', id: cliente.id }, { expiresIn: '180d' })
    return { token, cliente }
  })
}
