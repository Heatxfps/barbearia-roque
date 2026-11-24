/**
 * Painel da barbearia (dono e barbeiros).
 * A agenda é conjunta: os barbeiros veem e mexem na agenda da casa toda
 * (na Roque não há recepcionista, quem atende o cliente é o próprio barbeiro).
 * Números de faturamento, clientes sumidos e ajustes ficam só com o dono.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { createHash, randomInt } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { z } from 'zod'
import { config, pastaFotos } from '../config.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { textos } from '../textos.ts'
import { listarModelos, montar, tempoDe } from '../mensagens.ts'
import { GATILHOS, modeloPadrao } from '../../../shared/modelos.ts'
import type { DB } from '../db.ts'
import { conferirSenha, hashSenha, lerBarbearia, novoId, transacao } from '../db.ts'
import { exigirAdmin, exigirDono, type Sessao } from '../auth.ts'
import { agora, carimbo, dataIso, dataValida, horaValida, lerCarimbo, normalizarTelefone, somarMin } from '../tempo.ts'
import { ErroNegocio, criarAgendamento, lembrarAgora, marcarStatus } from '../servicos-agendamento.ts'
import { aniversariantes, lembretes, retornoComEstado } from '../status-mensagens.ts'
import { clientesParaRetorno } from '../jobs.ts'
import { resumoFunil } from '../funil.ts'

type Admin = Extract<Sessao, { tipo: 'admin' }>
const sessao = (req: FastifyRequest) => req.user as Admin
/** filtro de profissional pedido na tela ("todos" = sem filtro) */
const filtroProf = (_req: FastifyRequest, pedido?: string) => (pedido && pedido !== 'todos' ? pedido : undefined)
/** números do resumo: o barbeiro vê só os dele */
const filtroResumo = (req: FastifyRequest) => {
  const s = sessao(req)
  return s.papel === 'barbeiro' ? s.profissionalId ?? '__nenhum__' : undefined
}

export async function rotasAdmin(app: FastifyInstance, db: DB) {
  type Usuario = { id: string; nome: string; email: string; senha_hash: string; papel: 'dono' | 'barbeiro'; profissional_id: string | null; telefone: string | null; trocar_senha: number }
  const hashCodigo = (chave: string, c: string) => createHash('sha256').update(`${chave}:${c}:${config.jwtSegredo}`).digest('hex')
  const mascarar = (t: string) => `(${t.slice(2, 4)}) •••••-${t.slice(-4)}`

  /** Token do painel: 12 h, ou 30 dias com "manter conectado neste aparelho" */
  const emitir = (u: Usuario, lembrar: boolean) => {
    const trocar = !!u.trocar_senha
    const token = app.jwt.sign({ tipo: 'admin', id: u.id, papel: u.papel, profissionalId: u.profissional_id, ...(trocar ? { trocar: true } : {}) },
      { expiresIn: trocar ? '1h' : lembrar ? '30d' : '12h' })
    return { token, usuario: { nome: u.nome, email: u.email, papel: u.papel, profissionalId: u.profissional_id, trocarSenha: trocar } }
  }

  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const b = z.object({ email: z.string().email(), senha: z.string().min(1), lembrar: z.boolean().default(false) }).parse(req.body)
    const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(b.email.toLowerCase()) as Usuario | undefined
    if (!u || !conferirSenha(b.senha, u.senha_hash)) throw new ErroNegocio('E-mail ou senha incorretos', 401)
    // o dono (que vê faturamento e mexe em tudo) confirma com um código no WhatsApp dele
    if (u.papel === 'dono' && u.telefone) {
      const codigo = String(randomInt(0, 1_000_000)).padStart(6, '0')
      const chave = `painel:${u.id}`
      db.prepare(`INSERT INTO codigos (telefone, codigo_hash, expira_em, enviado_em, tentativas) VALUES (?, ?, ?, ?, 0)
                  ON CONFLICT(telefone) DO UPDATE SET codigo_hash = excluded.codigo_hash, expira_em = excluded.expira_em, enviado_em = excluded.enviado_em, tentativas = 0`)
        .run(chave, hashCodigo(chave, codigo), Date.now() + 10 * 60_000, Date.now())
      await enviarWhatsApp(db, u.telefone, 'codigo_painel', textos.codigoPainel(codigo))
      const desafio = app.jwt.sign({ tipo: 'desafio', id: u.id, lembrar: b.lembrar }, { expiresIn: '10m' })
      return { etapa: 'codigo', desafio, destino: mascarar(u.telefone), ...(config.whatsapp.modo === 'demo' ? { codigoDemo: codigo } : {}) }
    }
    return emitir(u, b.lembrar)
  })

  app.post('/login/codigo', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const b = z.object({ desafio: z.string(), codigo: z.string().regex(/^\d{6}$/) }).parse(req.body)
    let d: { tipo: string; id: string; lembrar: boolean }
    try { d = app.jwt.verify(b.desafio) } catch { throw new ErroNegocio('O tempo acabou. Entre de novo.', 401) }
    if (d.tipo !== 'desafio') throw new ErroNegocio('Acesso negado', 403)
    const chave = `painel:${d.id}`
    const reg = db.prepare('SELECT codigo_hash, expira_em, tentativas FROM codigos WHERE telefone = ?').get(chave) as { codigo_hash: string; expira_em: number; tentativas: number } | undefined
    if (!reg || reg.expira_em < Date.now()) throw new ErroNegocio('Código expirado. Entre de novo.', 401)
    if (reg.tentativas >= 5) throw new ErroNegocio('Muitas tentativas. Entre de novo.', 429)
    if (reg.codigo_hash !== hashCodigo(chave, b.codigo)) {
      db.prepare('UPDATE codigos SET tentativas = tentativas + 1 WHERE telefone = ?').run(chave)
      throw new ErroNegocio('Código incorreto')
    }
    db.prepare('DELETE FROM codigos WHERE telefone = ?').run(chave)
    const u = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(d.id) as Usuario | undefined
    if (!u) throw new ErroNegocio('Acesso removido', 401)
    return emitir(u, d.lembrar)
  })

  // tudo abaixo exige login no painel
  app.register(async (r) => {
    r.addHook('onRequest', exigirAdmin)

    r.get('/eu', async (req) => {
      const s = sessao(req)
      const u = db.prepare('SELECT nome, email, papel, profissional_id AS profissionalId, telefone, trocar_senha FROM usuarios WHERE id = ?').get(s.id) as
        { trocar_senha: number; telefone: string | null } & Record<string, unknown> | undefined
      if (!u) throw new ErroNegocio('Acesso removido', 401)
      const { trocar_senha, telefone, ...resto } = u
      return { ...resto, trocarSenha: !!trocar_senha, verificacaoWhatsApp: !!telefone }
    })

    /** Histórico: enviadas (ou simuladas no modo demo) e as que falharam */
    r.get('/mensagens', async (req) => {
      const { status } = z.object({ status: z.enum(['todas', 'enviadas', 'falharam']).default('todas') }).parse(req.query)
      const f = status === 'falharam' ? "WHERE status = 'erro'" : status === 'enviadas' ? "WHERE status != 'erro'" : ''
      return db.prepare(`SELECT id, telefone, tipo, texto, status, erro, criado_em AS criadoEm FROM mensagens ${f} ORDER BY criado_em DESC, rowid DESC LIMIT 100`).all()
    })

    /** Clientes → Lembretes: próximos horários e a situação de cada lembrete */
    r.get('/lembretes', async () => lembretes(db))
    r.post('/agendamentos/:id/lembrar', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      await lembrarAgora(db, id)
      return { ok: true }
    })

    /** Modelos das mensagens e automações (a equipe vê; só o dono edita) */
    r.get('/modelos', async () => listarModelos(db))
    r.get('/automacoes', async () => (db.prepare('SELECT * FROM automacoes ORDER BY criado_em').all() as { ativo: number }[]).map((a) => ({ ...a, ativo: !!a.ativo })))

    /** Clientes sumidos (para chamar de volta): todos da equipe podem ver */
    r.get('/retorno', async () => retornoComEstado(db))

    /** Aniversariantes (3 dias atrás até 7 dias para a frente), com a situação do parabéns e do cupom */
    r.get('/aniversariantes', async () => aniversariantes(db))

    /** Funil (5 A's): de onde vêm e até onde vão. A equipe toda vê (não é financeiro). */
    r.get('/funil', async (req) => {
      const { dias } = z.object({ dias: z.coerce.number().int().refine((n) => [1, 7, 30].includes(n)).default(7) }).parse(req.query)
      return resumoFunil(db, dias)
    })

    r.get('/resumo', { onRequest: exigirDono }, async (req) => {
      const { data } = z.object({ data: z.string().refine(dataValida).optional() }).parse(req.query)
      const dia = data ?? dataIso(agora())
      const prof = filtroResumo(req)
      const pf = prof ? 'AND profissional_id = ?' : ''
      const args = (...a: unknown[]) => (prof ? [...a, prof] : a) as string[]
      const mes = dia.slice(0, 7)
      const hoje = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(preco),0) AS total FROM agendamentos
                               WHERE substr(inicio,1,10) = ? AND status IN ('confirmado','concluido') ${pf}`).get(...args(dia)) as { n: number; total: number }
      const concluidosHoje = db.prepare(`SELECT COALESCE(SUM(preco),0) AS total FROM agendamentos WHERE substr(inicio,1,10) = ? AND status = 'concluido' ${pf}`).get(...args(dia)) as { total: number }
      const doMes = db.prepare(`SELECT
                                  SUM(status = 'concluido') AS concluidos,
                                  SUM(status = 'faltou') AS faltas,
                                  SUM(status = 'cancelado') AS cancelados,
                                  SUM(origem = 'app' AND status != 'cancelado') AS peloApp,
                                  SUM(status != 'cancelado') AS total,
                                  COALESCE(SUM(CASE WHEN status = 'concluido' THEN preco END),0) AS faturado
                                FROM agendamentos WHERE substr(inicio,1,7) = ? ${pf}`).get(...args(mes)) as Record<string, number | null>
      const porServico = db.prepare(`SELECT s.nome, COUNT(*) AS n FROM agendamentos a JOIN servicos s ON s.id = a.servico_id
                                     WHERE substr(a.inicio,1,7) = ? AND a.status IN ('confirmado','concluido') ${prof ? 'AND a.profissional_id = ?' : ''}
                                     GROUP BY s.id ORDER BY n DESC LIMIT 5`).all(...args(mes))
      const porProfissional = db.prepare(`SELECT p.nome, COUNT(*) AS n, COALESCE(SUM(a.preco),0) AS total FROM agendamentos a JOIN profissionais p ON p.id = a.profissional_id
                                          WHERE substr(a.inicio,1,7) = ? AND a.status = 'concluido' ${prof ? 'AND a.profissional_id = ?' : ''}
                                          GROUP BY p.id ORDER BY total DESC`).all(...args(mes))
      const n = (v: number | null | undefined) => v ?? 0
      return {
        data: dia,
        hoje: { atendimentos: hoje.n, previsto: hoje.total, recebido: concluidosHoje.total },
        mes: {
          concluidos: n(doMes.concluidos), faltas: n(doMes.faltas), cancelados: n(doMes.cancelados), faturado: n(doMes.faturado),
          taxaFalta: n(doMes.total) ? n(doMes.faltas) / n(doMes.total) : 0,
          percentualApp: n(doMes.total) ? n(doMes.peloApp) / n(doMes.total) : 0,
        },
        porServico, porProfissional,
        retorno: sessao(req).papel === 'dono' ? clientesParaRetorno(db).slice(0, 10) : [],
      }
    })

    r.get('/agenda', async (req) => {
      const q = z.object({ data: z.string().refine(dataValida), profissional: z.string().optional() }).parse(req.query)
      const prof = filtroProf(req, q.profissional)
      const lista = db.prepare(`SELECT a.id, a.inicio, a.fim, a.preco, a.desconto, a.status, a.origem, a.servico_id AS servicoId, s.nome AS servico,
                                       a.profissional_id AS profissionalId, p.nome AS profissional, c.nome AS cliente, c.telefone,
                                       CASE WHEN a.adiantar_ate > ? THEN a.adiantar_para END AS adiantarPara,
                                       (SELECT COUNT(*) FROM agendamentos x WHERE x.cliente_id = a.cliente_id AND x.status = 'concluido') AS visitas
                                FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id JOIN clientes c ON c.id = a.cliente_id
                                WHERE substr(a.inicio,1,10) = ? ${prof ? 'AND a.profissional_id = ?' : ''} ORDER BY a.inicio`)
        .all(...(prof ? [carimbo(agora()), q.data, prof] : [carimbo(agora()), q.data]))
      const bloqueios = db.prepare(`SELECT b.id, b.inicio, b.fim, b.motivo, b.profissional_id AS profissionalId, p.nome AS profissional
                                    FROM bloqueios b JOIN profissionais p ON p.id = b.profissional_id
                                    WHERE b.inicio < ? AND b.fim > ? ${prof ? 'AND b.profissional_id = ?' : ''} ORDER BY b.inicio`)
        .all(...(prof ? [`${q.data} 24:00`, `${q.data} 00:00`, prof] : [`${q.data} 24:00`, `${q.data} 00:00`]))
      const espera = db.prepare(`SELECT e.id, c.nome AS cliente, c.telefone, s.nome AS servico, e.profissional_id AS profissionalId,
                                        COALESCE(p.nome, 'Sem preferência') AS profissional, e.criado_em AS criadoEm, e.avisado_em AS avisadoEm
                                 FROM espera e JOIN clientes c ON c.id = e.cliente_id JOIN servicos s ON s.id = e.servico_id
                                 LEFT JOIN profissionais p ON p.id = e.profissional_id
                                 WHERE e.data = ? ORDER BY e.criado_em`).all(q.data)
      return { data: q.data, agendamentos: lista, bloqueios, espera }
    })

    r.patch('/agendamentos/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const { status } = z.object({ status: z.enum(['confirmado', 'concluido', 'faltou', 'cancelado']) }).parse(req.body)
      // concluído antes da hora, falta ou cancelamento no dia: o próximo cliente pode ser convidado a adiantar
      const adiantar = marcarStatus(db, id, status)
      return { ok: true, adiantar }
    })

    /** encaixe / cliente que chegou no balcão */
    r.post('/agendamentos', async (req, reply) => {
      const b = z.object({
        nome: z.string().trim().min(2), telefone: z.string().optional(),
        servicoId: z.string(), profissionalId: z.string(),
        data: z.string().refine(dataValida), hora: z.string().refine(horaValida),
      }).parse(req.body)
      const tel = b.telefone ? normalizarTelefone(b.telefone) : null
      if (b.telefone && !tel) throw new ErroNegocio('WhatsApp inválido')
      const telefoneFinal = tel ?? `balcao-${novoId()}`
      let c = db.prepare('SELECT id FROM clientes WHERE telefone = ?').get(telefoneFinal) as { id: string } | undefined
      if (!c) {
        c = { id: novoId() }
        db.prepare('INSERT INTO clientes (id, nome, telefone, criado_em) VALUES (?, ?, ?, ?)').run(c.id, b.nome, telefoneFinal, carimbo(agora()))
      }
      const r2 = criarAgendamento(db, { clienteId: c.id, servicoId: b.servicoId, profissionalId: b.profissionalId, data: b.data, hora: b.hora, origem: 'balcao' })
      return reply.status(201).send(r2)
    })

    r.get('/bloqueios', async (req) => {
      const q = z.object({ de: z.string().refine(dataValida).optional() }).parse(req.query)
      const de = `${q.de ?? dataIso(agora())} 00:00`
      return db.prepare(`SELECT b.id, b.inicio, b.fim, b.motivo, b.profissional_id AS profissionalId, p.nome AS profissional
                         FROM bloqueios b JOIN profissionais p ON p.id = b.profissional_id WHERE b.fim > ? ORDER BY b.inicio LIMIT 100`).all(de)
    })

    r.post('/bloqueios', async (req, reply) => {
      const b = z.object({
        profissionalId: z.string(), data: z.string().refine(dataValida),
        inicio: z.string().refine(horaValida), fim: z.string().refine(horaValida), motivo: z.string().max(80).default(''),
      }).parse(req.body)
      if (b.fim <= b.inicio) throw new ErroNegocio('O fim precisa ser depois do início')
      const id = novoId()
      const ids = b.profissionalId === 'todos'
        ? (db.prepare('SELECT id FROM profissionais WHERE ativo = 1').all() as { id: string }[]).map((p) => p.id)
        : [b.profissionalId]
      for (const p of ids) db.prepare('INSERT INTO bloqueios (id, profissional_id, inicio, fim, motivo) VALUES (?, ?, ?, ?, ?)')
        .run(ids.length > 1 ? novoId() : id, p, `${b.data} ${b.inicio}`, `${b.data} ${b.fim}`, b.motivo)
      return reply.status(201).send({ ok: true })
    })

    r.delete('/bloqueios/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      db.prepare('DELETE FROM bloqueios WHERE id = ?').run(id)
      return { ok: true }
    })

    r.get('/clientes', async (req) => {
      const { busca } = z.object({ busca: z.string().default('') }).parse(req.query)
      const like = `%${busca}%`
      return db.prepare(`SELECT c.id, c.nome, c.telefone,
                                COUNT(CASE WHEN a.status = 'concluido' THEN 1 END) AS visitas,
                                SUM(a.status = 'faltou') AS faltas,
                                MAX(CASE WHEN a.status = 'concluido' THEN a.inicio END) AS ultimaVisita
                         FROM clientes c LEFT JOIN agendamentos a ON a.cliente_id = c.id
                         WHERE c.telefone NOT LIKE 'balcao-%' AND (c.nome LIKE ? OR c.telefone LIKE ?)
                         GROUP BY c.id ORDER BY ultimaVisita DESC NULLS LAST LIMIT 100`).all(like, like)
    })

    /** cada um troca a própria senha (mínimo 8 caracteres) */
    r.put('/senha', async (req) => {
      const b = z.object({ atual: z.string(), nova: z.string().min(8, 'A nova senha precisa ter pelo menos 8 caracteres') }).parse(req.body)
      const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(sessao(req).id) as { senha_hash: string }
      if (!conferirSenha(b.atual, u.senha_hash)) throw new ErroNegocio('Senha atual incorreta')
      if (b.atual === b.nova) throw new ErroNegocio('A nova senha precisa ser diferente da atual')
      db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?').run(hashSenha(b.nova), sessao(req).id)
      // devolve um token novo, já sem a trava de "trocar senha"
      return emitir(db.prepare('SELECT * FROM usuarios WHERE id = ?').get(sessao(req).id) as Usuario, false)
    })

    r.delete('/espera/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      db.prepare('DELETE FROM espera WHERE id = ?').run(id)
      return { ok: true }
    })

    /** Avaliações: média geral, por barbeiro e as mais recentes */
    r.get('/avaliacoes', async () => {
      // a equipe toda vê as avaliações da casa
      const f = ''
      const args: string[] = []
      const geral = db.prepare(`SELECT ROUND(AVG(nota), 1) AS media, COUNT(*) AS total FROM avaliacoes v ${f}`).get(...args) as { media: number | null; total: number }
      const porProfissional = db.prepare(`SELECT p.id, p.nome, p.foto, ROUND(AVG(v.nota), 1) AS media, COUNT(*) AS n
                                          FROM avaliacoes v JOIN profissionais p ON p.id = v.profissional_id ${f} GROUP BY p.id ORDER BY media DESC`).all(...args)
      const recentes = db.prepare(`SELECT v.id, v.nota, v.comentario, v.criado_em AS criadoEm, c.nome AS cliente, p.nome AS profissional
                                   FROM avaliacoes v JOIN clientes c ON c.id = v.cliente_id JOIN profissionais p ON p.id = v.profissional_id
                                   ${f} ORDER BY v.criado_em DESC LIMIT 60`).all(...args)
      const dist = db.prepare(`SELECT nota, COUNT(*) AS n FROM avaliacoes v ${f} GROUP BY nota`).all(...args) as { nota: number; n: number }[]
      const distribuicao = [5, 4, 3, 2, 1].map((nota) => ({ nota, n: dist.find((d) => d.nota === nota)?.n ?? 0 }))
      return { media: geral.media ?? 0, total: geral.total, porProfissional, recentes, distribuicao }
    })

    // ---------- loja: pedidos (todos atendem o balcão) ----------
    r.get('/pedidos', async (req) => {
      const { status } = z.object({ status: z.enum(['abertos', 'todos']).default('abertos') }).parse(req.query)
      const pedidos = db.prepare(`SELECT o.id, o.status, o.total, o.observacao, o.criado_em AS criadoEm, c.nome AS cliente, c.telefone
                                  FROM pedidos o JOIN clientes c ON c.id = o.cliente_id
                                  ${status === 'abertos' ? "WHERE o.status IN ('novo','separado')" : ''} ORDER BY o.criado_em DESC LIMIT 100`).all() as { id: string }[]
      return pedidos.map((o) => ({ ...o, itens: db.prepare('SELECT nome, preco, qtd FROM pedido_itens WHERE pedido_id = ?').all(o.id) }))
    })

    r.patch('/pedidos/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const { status } = z.object({ status: z.enum(['novo', 'separado', 'retirado', 'cancelado']) }).parse(req.body)
      const o = db.prepare('SELECT o.status, c.nome, c.telefone FROM pedidos o JOIN clientes c ON c.id = o.cliente_id WHERE o.id = ?').get(id) as
        { status: string; nome: string; telefone: string } | undefined
      if (!o) throw new ErroNegocio('Pedido não encontrado', 404)
      db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, id)
      if (status === 'separado' && o.status !== 'separado') db.prepare('UPDATE pedidos SET separado_em = ? WHERE id = ?').run(carimbo(agora()), id)
      const txt = status === 'separado' && o.status === 'novo' ? montar(db, 'pedido_separado', { nome: o.nome.split(' ')[0] }) : null
      if (txt) void enviarWhatsApp(db, o.telefone, 'pedido_separado', txt, id)
      return { ok: true }
    })


    // ---------- só o dono ----------
    r.register(async (d) => {
      d.addHook('onRequest', exigirDono)

      d.put('/modelos/:chave', async (req) => {
        const { chave } = z.object({ chave: z.string() }).parse(req.params)
        const p = modeloPadrao(chave)
        if (!p) throw new ErroNegocio('Mensagem não encontrada', 404)
        const b = z.object({ texto: z.string().trim().min(5).max(1000).nullable().optional(), ativo: z.boolean().optional(), valor: z.number().int().nullable().optional() }).parse(req.body)
        if (b.valor != null && p.tempo && (b.valor < p.tempo.min || b.valor > p.tempo.max)) throw new ErroNegocio(`O tempo precisa ficar entre ${p.tempo.min} e ${p.tempo.max} ${p.tempo.unidade}`)
        const atual = db.prepare('SELECT texto, ativo, valor FROM modelos WHERE chave = ?').get(chave) as { texto: string | null; ativo: number; valor: number | null } | undefined
        const novo = {
          texto: b.texto === undefined ? atual?.texto ?? null : b.texto === p.texto ? null : b.texto,
          ativo: b.ativo === undefined ? atual?.ativo ?? 1 : +b.ativo,
          valor: b.valor === undefined ? atual?.valor ?? null : b.valor,
        }
        db.prepare(`INSERT INTO modelos (chave, texto, ativo, valor) VALUES (?, ?, ?, ?)
                    ON CONFLICT(chave) DO UPDATE SET texto = excluded.texto, ativo = excluded.ativo, valor = excluded.valor`).run(chave, novo.texto, novo.ativo, novo.valor)
        return { ok: true }
      })

      const automacaoSchema = z.object({
        nome: z.string().trim().min(2).max(60),
        gatilho: z.enum(['antes_horario', 'depois_atendimento', 'dias_depois', 'primeira_visita']),
        valor: z.number().int(),
        texto: z.string().trim().min(5).max(1000),
        ativo: z.boolean().default(true),
      }).refine((a) => a.valor >= GATILHOS[a.gatilho].min && a.valor <= GATILHOS[a.gatilho].max, { message: 'Tempo fora do limite' })
      d.post('/automacoes', async (req, reply) => {
        const b = automacaoSchema.parse(req.body)
        const id = 'au-' + novoId().slice(0, 8)
        db.prepare('INSERT INTO automacoes (id, nome, gatilho, valor, texto, ativo, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, b.nome, b.gatilho, b.valor, b.texto, +b.ativo, carimbo(agora()))
        return reply.status(201).send({ id })
      })
      d.put('/automacoes/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const b = automacaoSchema.parse(req.body)
        const r2 = db.prepare('UPDATE automacoes SET nome = ?, gatilho = ?, valor = ?, texto = ?, ativo = ? WHERE id = ?').run(b.nome, b.gatilho, b.valor, b.texto, +b.ativo, id)
        if (!r2.changes) throw new ErroNegocio('Automação não encontrada', 404)
        return { ok: true }
      })
      d.delete('/automacoes/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        db.prepare('DELETE FROM automacao_envios WHERE automacao_id = ?').run(id)
        db.prepare('DELETE FROM automacoes WHERE id = ?').run(id)
        return { ok: true }
      })


      /** WhatsApp do dono para o código de entrada (pede a senha atual para mudar) */
      d.put('/seguranca', async (req) => {
        const b = z.object({ senha: z.string(), telefone: z.string().nullable() }).parse(req.body)
        const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(sessao(req).id) as { senha_hash: string }
        if (!conferirSenha(b.senha, u.senha_hash)) throw new ErroNegocio('Senha incorreta')
        const tel = b.telefone ? normalizarTelefone(b.telefone) : null
        if (b.telefone && !tel) throw new ErroNegocio('WhatsApp inválido. Use DDD + número.')
        db.prepare('UPDATE usuarios SET telefone = ? WHERE id = ?').run(tel, sessao(req).id)
        return { ok: true, verificacaoWhatsApp: !!tel }
      })

      d.get('/servicos', async () => db.prepare('SELECT * FROM servicos ORDER BY ordem').all())
      const servicoSchema = z.object({
        nome: z.string().trim().min(2), descricao: z.string().default(''), preco: z.number().min(0),
        duracao: z.number().int().min(5).max(480), destaque: z.boolean().default(false), ativo: z.boolean().default(true),
      })
      d.post('/servicos', async (req, reply) => {
        const b = servicoSchema.parse(req.body)
        const id = b.nome.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '-' + novoId().slice(0, 4)
        const { m } = db.prepare('SELECT COALESCE(MAX(ordem),0)+1 AS m FROM servicos').get() as { m: number }
        db.prepare('INSERT INTO servicos (id, nome, descricao, preco, duracao, destaque, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, b.nome, b.descricao, b.preco, b.duracao, +b.destaque, +b.ativo, m)
        return reply.status(201).send({ id })
      })
      d.put('/servicos/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const b = servicoSchema.parse(req.body)
        const r2 = db.prepare('UPDATE servicos SET nome = ?, descricao = ?, preco = ?, duracao = ?, destaque = ?, ativo = ? WHERE id = ?')
          .run(b.nome, b.descricao, b.preco, b.duracao, +b.destaque, +b.ativo, id)
        if (!r2.changes) throw new ErroNegocio('Serviço não encontrado', 404)
        return { ok: true }
      })

      d.get('/profissionais', async () => {
        const profs = db.prepare('SELECT * FROM profissionais WHERE removido = 0 ORDER BY ordem').all() as { id: string }[]
        return profs.map((p) => ({ ...p, expediente: db.prepare('SELECT dia, inicio, fim, intervalo_inicio AS intervaloInicio, intervalo_fim AS intervaloFim FROM expediente WHERE profissional_id = ? ORDER BY dia').all(p.id) }))
      })
      const profSchema = z.object({
        nome: z.string().trim().min(2), especialidade: z.string().default(''), ativo: z.boolean().default(true),
        foto: z.string().max(200).nullable().optional(),
        expediente: z.array(z.object({
          dia: z.number().int().min(0).max(6), inicio: z.string().refine(horaValida), fim: z.string().refine(horaValida),
          intervaloInicio: z.string().refine(horaValida).nullable().optional(), intervaloFim: z.string().refine(horaValida).nullable().optional(),
        })).optional(),
      })
      const salvarExpediente = (id: string, exp: z.infer<typeof profSchema>['expediente']) => {
        if (!exp) return
        db.prepare('DELETE FROM expediente WHERE profissional_id = ?').run(id)
        for (const e of exp) db.prepare('INSERT INTO expediente (profissional_id, dia, inicio, fim, intervalo_inicio, intervalo_fim) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, e.dia, e.inicio, e.fim, e.intervaloInicio ?? null, e.intervaloFim ?? null)
      }
      d.post('/profissionais', async (req, reply) => {
        const b = profSchema.parse(req.body)
        const id = 'p-' + novoId().slice(0, 6)
        const { m } = db.prepare('SELECT COALESCE(MAX(ordem),0)+1 AS m FROM profissionais').get() as { m: number }
        db.prepare('INSERT INTO profissionais (id, nome, especialidade, foto, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?)').run(id, b.nome, b.especialidade, b.foto ?? null, +b.ativo, m)
        // sem horário informado, começa com o mesmo expediente do primeiro barbeiro
        if (b.expediente) salvarExpediente(id, b.expediente)
        else db.prepare(`INSERT INTO expediente (profissional_id, dia, inicio, fim, intervalo_inicio, intervalo_fim)
                         SELECT ?, dia, inicio, fim, intervalo_inicio, intervalo_fim FROM expediente
                         WHERE profissional_id = (SELECT id FROM profissionais WHERE removido = 0 AND id != ? ORDER BY ordem LIMIT 1)`).run(id, id)
        return reply.status(201).send({ id })
      })
      d.put('/profissionais/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const b = profSchema.parse(req.body)
        const r2 = db.prepare('UPDATE profissionais SET nome = ?, especialidade = ?, ativo = ? WHERE id = ? AND removido = 0').run(b.nome, b.especialidade, +b.ativo, id)
        if (!r2.changes) throw new ErroNegocio('Profissional não encontrado', 404)
        if (b.foto !== undefined) db.prepare('UPDATE profissionais SET foto = ? WHERE id = ?').run(b.foto, id)
        salvarExpediente(id, b.expediente)
        return { ok: true }
      })

      /** Excluir barbeiro: some do app e do painel; o histórico continua nos relatórios */
      d.delete('/profissionais/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const { n } = db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE profissional_id = ? AND status = 'confirmado' AND inicio > ?")
          .get(id, carimbo(agora())) as { n: number }
        if (n) throw new ErroNegocio(`Ele ainda tem ${n} horário(s) marcado(s). Cancele ou passe para outro barbeiro antes de excluir.`, 409)
        const { h } = db.prepare('SELECT COUNT(*) AS h FROM agendamentos WHERE profissional_id = ?').get(id) as { h: number }
        transacao(db, () => {
          db.prepare("DELETE FROM usuarios WHERE profissional_id = ? AND papel = 'barbeiro'").run(id)
          db.prepare('DELETE FROM bloqueios WHERE profissional_id = ?').run(id)
          db.prepare('DELETE FROM espera WHERE profissional_id = ?').run(id)
          if (h) db.prepare('UPDATE profissionais SET ativo = 0, removido = 1 WHERE id = ?').run(id)
          else {
            db.prepare('DELETE FROM avaliacoes WHERE profissional_id = ?').run(id)
            db.prepare('DELETE FROM profissionais WHERE id = ?').run(id)
          }
        })
        return { ok: true }
      })

      /** Envio de foto (barbeiro ou produto): o app já manda a imagem reduzida, em base64 */
      d.post('/fotos', { bodyLimit: 6 * 1024 * 1024 }, async (req, reply) => {
        const pasta = pastaFotos()
        if (!pasta) throw new ErroNegocio('Envio de fotos indisponível neste servidor')
        const { imagem } = z.object({ imagem: z.string().max(8_000_000) }).parse(req.body)
        const m = /^data:image\/(jpeg|png|webp);base64,(.+)$/.exec(imagem)
        if (!m) throw new ErroNegocio('Envie uma imagem JPG, PNG ou WebP')
        const dados = Buffer.from(m[2], 'base64')
        const assinatura = { jpeg: [0xff, 0xd8, 0xff], png: [0x89, 0x50, 0x4e, 0x47], webp: [0x52, 0x49, 0x46, 0x46] }[m[1] as 'jpeg' | 'png' | 'webp']
        if (!assinatura.every((b, i) => dados[i] === b)) throw new ErroNegocio('Arquivo de imagem inválido')
        if (dados.length > 4 * 1024 * 1024) throw new ErroNegocio('Imagem grande demais (máx. 4 MB)')
        const nome = `${novoId()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`
        mkdirSync(pasta, { recursive: true })
        writeFileSync(`${pasta}/${nome}`, dados)
        return reply.status(201).send({ url: `/fotos/${nome}` })
      })

      // ---------- loja: produtos ----------
      d.get('/produtos', async () => (db.prepare('SELECT * FROM produtos ORDER BY ordem, nome').all() as { ativo: number }[]).map((p) => ({ ...p, ativo: !!p.ativo })))
      const produtoSchema = z.object({
        nome: z.string().trim().min(2).max(60), descricao: z.string().max(120).default(''), preco: z.number().min(0),
        foto: z.string().max(200).nullable().optional(), ativo: z.boolean().default(true),
      })
      d.post('/produtos', async (req, reply) => {
        const b = produtoSchema.parse(req.body)
        const id = 'pr-' + novoId().slice(0, 8)
        const { m } = db.prepare('SELECT COALESCE(MAX(ordem),0)+1 AS m FROM produtos').get() as { m: number }
        db.prepare('INSERT INTO produtos (id, nome, descricao, preco, foto, ativo, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, b.nome, b.descricao, b.preco, b.foto ?? null, +b.ativo, m)
        return reply.status(201).send({ id })
      })
      d.put('/produtos/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const b = produtoSchema.parse(req.body)
        const r2 = db.prepare('UPDATE produtos SET nome = ?, descricao = ?, preco = ?, foto = ?, ativo = ? WHERE id = ?').run(b.nome, b.descricao, b.preco, b.foto ?? null, +b.ativo, id)
        if (!r2.changes) throw new ErroNegocio('Produto não encontrado', 404)
        return { ok: true }
      })
      d.delete('/produtos/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        db.prepare('DELETE FROM produtos WHERE id = ?').run(id)
        return { ok: true }
      })

      d.put('/barbearia', async (req) => {
        const b = z.object({
          nome: z.string().min(2), cidade: z.string(), endereco: z.string(),
          whatsapp: z.string().transform((t) => t.replace(/\D/g, '')).refine((t) => t.length >= 12 && t.length <= 13, 'WhatsApp com DDI e DDD, ex.: 5527999999999'),
          instagram: z.string().transform((t) => t.replace(/^@/, '').trim()), dono: z.string(),
          google_avaliacao: z.string().trim().refine((u) => !u || /^https:\/\//.test(u), 'Cole o link completo, começando com https://'),
          desconto_aniversario: z.number().int().min(0).max(100).transform(String),
          validade_aniversario: z.number().int().min(0).max(60).transform(String),
        }).partial().parse(req.body)
        for (const [k, v] of Object.entries(b)) db.prepare('INSERT INTO barbearia (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(k, String(v))
        return lerBarbearia(db)
      })

      d.get('/usuarios', async () =>
        db.prepare(`SELECT u.id, u.nome, u.email, u.papel, u.profissional_id AS profissionalId FROM usuarios u ORDER BY u.papel DESC, u.nome`).all())

      d.delete('/usuarios/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        if (id === sessao(req).id) throw new ErroNegocio('Você não pode remover o próprio acesso')
        db.prepare("DELETE FROM usuarios WHERE id = ? AND papel = 'barbeiro'").run(id)
        return { ok: true }
      })

      /** cria acesso ao painel para um barbeiro (agenda conjunta, sem faturamento nem ajustes) */
      d.post('/usuarios', async (req, reply) => {
        const b = z.object({ nome: z.string().min(2), email: z.string().email(), senha: z.string().min(6), profissionalId: z.string() }).parse(req.body)
        try {
          db.prepare('INSERT INTO usuarios (id, email, nome, senha_hash, papel, profissional_id, trocar_senha) VALUES (?, ?, ?, ?, ?, ?, 1)')
            .run(novoId(), b.email.toLowerCase(), b.nome, hashSenha(b.senha), 'barbeiro', b.profissionalId)
        } catch { throw new ErroNegocio('Esse e-mail já tem acesso', 409) }
        return reply.status(201).send({ ok: true })
      })

    })
  })

}
