/**
 * Painel da barbearia (dono e barbeiros).
 * Dono: vê e edita tudo. Barbeiro: vê e atualiza só a própria agenda.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import type { DB } from '../db.ts'
import { conferirSenha, hashSenha, lerBarbearia, novoId } from '../db.ts'
import { exigirAdmin, exigirDono, type Sessao } from '../auth.ts'
import { agora, carimbo, dataIso, dataValida, horaValida, normalizarTelefone } from '../tempo.ts'
import { ErroNegocio, cancelarAgendamento, criarAgendamento } from '../servicos-agendamento.ts'
import { clientesParaRetorno } from '../jobs.ts'

type Admin = Extract<Sessao, { tipo: 'admin' }>
const sessao = (req: FastifyRequest) => req.user as Admin
/** barbeiro só enxerga o próprio profissional */
const filtroProf = (req: FastifyRequest, pedido?: string) => {
  const s = sessao(req)
  return s.papel === 'barbeiro' ? s.profissionalId ?? '__nenhum__' : pedido && pedido !== 'todos' ? pedido : undefined
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
      const prof = filtroProf(req)
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
      const lista = db.prepare(`SELECT a.id, a.inicio, a.fim, a.preco, a.status, a.origem, a.servico_id AS servicoId, s.nome AS servico,
                                       a.profissional_id AS profissionalId, p.nome AS profissional, c.nome AS cliente, c.telefone,
                                       (SELECT COUNT(*) FROM agendamentos x WHERE x.cliente_id = a.cliente_id AND x.status = 'concluido') AS visitas
                                FROM agendamentos a JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id JOIN clientes c ON c.id = a.cliente_id
                                WHERE substr(a.inicio,1,10) = ? ${prof ? 'AND a.profissional_id = ?' : ''} ORDER BY a.inicio`)
        .all(...(prof ? [q.data, prof] : [q.data]))
      const bloqueios = db.prepare(`SELECT b.id, b.inicio, b.fim, b.motivo, b.profissional_id AS profissionalId, p.nome AS profissional
                                    FROM bloqueios b JOIN profissionais p ON p.id = b.profissional_id
                                    WHERE b.inicio < ? AND b.fim > ? ${prof ? 'AND b.profissional_id = ?' : ''} ORDER BY b.inicio`)
        .all(...(prof ? [`${q.data} 24:00`, `${q.data} 00:00`, prof] : [`${q.data} 24:00`, `${q.data} 00:00`]))
      return { data: q.data, agendamentos: lista, bloqueios }
    })

    r.patch('/agendamentos/:id', async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params)
      const { status } = z.object({ status: z.enum(['confirmado', 'concluido', 'faltou', 'cancelado']) }).parse(req.body)
      const a = db.prepare('SELECT profissional_id FROM agendamentos WHERE id = ?').get(id) as { profissional_id: string } | undefined
      if (!a) throw new ErroNegocio('Agendamento não encontrado', 404)
      const s = sessao(req)
      if (s.papel === 'barbeiro' && a.profissional_id !== s.profissionalId) throw new ErroNegocio('Acesso negado', 403)
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
      const s = sessao(req)
      if (s.papel === 'barbeiro' && b.profissionalId !== s.profissionalId) throw new ErroNegocio('Acesso negado', 403)
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
      const prof = filtroProf(req)
      const de = `${q.de ?? dataIso(agora())} 00:00`
      return db.prepare(`SELECT b.id, b.inicio, b.fim, b.motivo, b.profissional_id AS profissionalId, p.nome AS profissional
                         FROM bloqueios b JOIN profissionais p ON p.id = b.profissional_id WHERE b.fim > ? ${prof ? 'AND b.profissional_id = ?' : ''} ORDER BY b.inicio LIMIT 100`)
        .all(...(prof ? [de, prof] : [de]))
    })

    r.post('/bloqueios', async (req, reply) => {
      const b = z.object({
        profissionalId: z.string(), data: z.string().refine(dataValida),
        inicio: z.string().refine(horaValida), fim: z.string().refine(horaValida), motivo: z.string().max(80).default(''),
      }).parse(req.body)
      const s = sessao(req)
      if (s.papel === 'barbeiro' && b.profissionalId !== s.profissionalId) throw new ErroNegocio('Acesso negado', 403)
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
      const prof = filtroProf(req)
      db.prepare(`DELETE FROM bloqueios WHERE id = ? ${prof ? 'AND profissional_id = ?' : ''}`).run(...(prof ? [id, prof] : [id]))
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
        const profs = db.prepare('SELECT * FROM profissionais ORDER BY ordem').all() as { id: string }[]
        return profs.map((p) => ({ ...p, expediente: db.prepare('SELECT dia, inicio, fim, intervalo_inicio AS intervaloInicio, intervalo_fim AS intervaloFim FROM expediente WHERE profissional_id = ? ORDER BY dia').all(p.id) }))
      })
      const profSchema = z.object({
        nome: z.string().trim().min(2), especialidade: z.string().default(''), ativo: z.boolean().default(true),
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
        db.prepare('INSERT INTO profissionais (id, nome, especialidade, ativo, ordem) VALUES (?, ?, ?, ?, ?)').run(id, b.nome, b.especialidade, +b.ativo, m)
        salvarExpediente(id, b.expediente)
        return reply.status(201).send({ id })
      })
      d.put('/profissionais/:id', async (req) => {
        const { id } = z.object({ id: z.string() }).parse(req.params)
        const b = profSchema.parse(req.body)
        const r2 = db.prepare('UPDATE profissionais SET nome = ?, especialidade = ?, ativo = ? WHERE id = ?').run(b.nome, b.especialidade, +b.ativo, id)
        if (!r2.changes) throw new ErroNegocio('Profissional não encontrado', 404)
        salvarExpediente(id, b.expediente)
        return { ok: true }
      })

      d.put('/barbearia', async (req) => {
        const b = z.object({
          nome: z.string().min(2), cidade: z.string(), endereco: z.string(),
          whatsapp: z.string(), instagram: z.string(),
        }).partial().parse(req.body)
        for (const [k, v] of Object.entries(b)) db.prepare('INSERT INTO barbearia (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run(k, String(v))
        return lerBarbearia(db)
      })

      /** cria acesso ao painel para um barbeiro (vê só a própria agenda) */
      d.post('/usuarios', async (req, reply) => {
        const b = z.object({ nome: z.string().min(2), email: z.string().email(), senha: z.string().min(6), profissionalId: z.string() }).parse(req.body)
        try {
          db.prepare('INSERT INTO usuarios (id, email, nome, senha_hash, papel, profissional_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(novoId(), b.email.toLowerCase(), b.nome, hashSenha(b.senha), 'barbeiro', b.profissionalId)
        } catch { throw new ErroNegocio('Esse e-mail já tem acesso', 409) }
        return reply.status(201).send({ ok: true })
      })

      d.put('/senha', async (req) => {
        const b = z.object({ atual: z.string(), nova: z.string().min(8) }).parse(req.body)
        const u = db.prepare('SELECT senha_hash FROM usuarios WHERE id = ?').get(sessao(req).id) as { senha_hash: string }
        if (!conferirSenha(b.atual, u.senha_hash)) throw new ErroNegocio('Senha atual incorreta')
        db.prepare('UPDATE usuarios SET senha_hash = ? WHERE id = ?').run(hashSenha(b.nova), sessao(req).id)
        return { ok: true }
      })
    })
  })

}
