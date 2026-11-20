/**
 * Painel da barbearia (dono e barbeiros).
 * A agenda é conjunta: os barbeiros veem e mexem na agenda da casa toda
 * (na Roque não há recepcionista, quem atende o cliente é o próprio barbeiro).
 * Números de faturamento, clientes sumidos e ajustes ficam só com o dono.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { writeFileSync, mkdirSync } from 'node:fs'
import { z } from 'zod'
import { pastaFotos } from '../config.ts'
import { enviarWhatsApp } from '../whatsapp.ts'
import { textos } from '../textos.ts'
import type { DB } from '../db.ts'
import { conferirSenha, hashSenha, lerBarbearia, novoId, transacao } from '../db.ts'
import { exigirAdmin, exigirDono, type Sessao } from '../auth.ts'
import { agora, carimbo, dataIso, dataValida, horaValida, normalizarTelefone } from '../tempo.ts'
import { ErroNegocio, cancelarAgendamento, criarAgendamento } from '../servicos-agendamento.ts'
import { clientesParaRetorno } from '../jobs.ts'

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
  app.post('/login', { config: { rateLimit: { max: 10, timeWindow: '10 minutes' } } }, async (req) => {
    const b = z.object({ email: z.string().email(), senha: z.string().min(1) }).parse(req.body)
    const u = db.prepare('SELECT id, nome, email, senha_hash, papel, profissional_id FROM usuarios WHERE email = ?').get(b.email.toLowerCase()) as
      { id: string; nome: string; email: string; senha_hash: string; papel: 'dono' | 'barbeiro'; profissional_id: string | null } | undefined
    if (!u || !conferirSenha(b.senha, u.senha_hash)) throw new ErroNegocio('E-mail ou senha incorretos', 401)
    const token = app.jwt.sign({ tipo: 'admin', id: u.id, papel: u.papel, profissionalId: u.profissional_id }, { expiresIn: '30d' })
    return { token, usuario: { nome: u.nome, email: u.email, papel: u.papel, profissionalId: u.profissional_id } }
  })

  // tudo abaixo exige login no painel
  app.register(async (r) => {
    r.addHook('onRequest', exigirAdmin)

    r.get('/eu', async (req) => {
      const s = sessao(req)
      return db.prepare('SELECT nome, email, papel, profissional_id AS profissionalId FROM usuarios WHERE id = ?').get(s.id)
    })

    r.get('/resumo', async (req) => {
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
                                       (SELECT COUNT(*) FROM agendamentos x WHERE x.cliente_id = a.cliente_id AND x.status = 'concluido') AS visitas
                                FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id JOIN clientes c ON c.id = a.cliente_id
                                WHERE substr(a.inicio,1,10) = ? ${prof ? 'AND a.profissional_id = ?' : ''} ORDER BY a.inicio`)
        .all(...(prof ? [q.data, prof] : [q.data]))
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
      const a = db.prepare('SELECT profissional_id FROM agendamentos WHERE id = ?').get(id) as { profissional_id: string } | undefined
      if (!a) throw new ErroNegocio('Agendamento não encontrado', 404)
      if (status === 'cancelado') cancelarAgendamento(db, id)
      else db.prepare('UPDATE agendamentos SET status = ? WHERE id = ?').run(status, id)
      return { ok: true }
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
      db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(b.nova), sessao(req).id)
      return { ok: true }
    })

    r.delete('/espera/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      db.prepare('DELETE FROM espera WHERE id = ?').run(id)
      return { ok: true }
    })

    /** Avaliações: média geral, por barbeiro e as mais recentes */
    r.get('/avaliacoes', async () => {
      const geral = db.prepare('SELECT ROUND(AVG(nota), 1) AS media, COUNT(*) AS total FROM avaliacoes').get() as { media: number | null; total: number }
      const porProfissional = db.prepare(`SELECT p.id, p.nome, p.foto, ROUND(AVG(v.nota), 1) AS media, COUNT(*) AS n
                                          FROM avaliacoes v JOIN profissionais p ON p.id = v.profissional_id GROUP BY p.id ORDER BY media DESC`).all()
      const recentes = db.prepare(`SELECT v.id, v.nota, v.comentario, v.criado_em AS criadoEm, c.nome AS cliente, p.nome AS profissional
                                   FROM avaliacoes v JOIN clientes c ON c.id = v.cliente_id JOIN profissionais p ON p.id = v.profissional_id
                                   ORDER BY v.criado_em DESC LIMIT 30`).all()
      return { media: geral.media ?? 0, total: geral.total, porProfissional, recentes }
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
      if (status === 'separado' && o.status === 'novo') void enviarWhatsApp(db, o.telefone, 'pedido_separado', textos.pedidoSeparado(o.nome, lerBarbearia(db).nome))
      return { ok: true }
    })

    r.get('/mensagens', async () => db.prepare('SELECT id, telefone, tipo, texto, status, erro, criado_em AS criadoEm FROM mensagens ORDER BY criado_em DESC, rowid DESC LIMIT 60').all())

    // ---------- só o dono ----------
    r.register(async (d) => {
      d.addHook('onRequest', exigirDono)

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
          db.prepare('INSERT INTO usuarios (id, email, nome, senha_hash, papel, profissional_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(novoId(), b.email.toLowerCase(), b.nome, hashSenha(b.senha), 'barbeiro', b.profissionalId)
        } catch { throw new ErroNegocio('Esse e-mail já tem acesso', 409) }
        return reply.status(201).send({ ok: true })
      })

    })
  })

}
