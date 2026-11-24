/**
 * Funil de clientes (os 5 A's do Kotler), só para a equipe olhar. Ninguém precisa configurar nada.
 *
 * Cada visita ao app é uma linha em `visitas`: de onde veio (origem) e até onde chegou (etapa).
 *   0 abriu o app · 1 escolheu o serviço · 2 escolheu o barbeiro · 3 escolheu o horário · 4 chegou em "confirmar"
 * O agendamento feito na visita fica em `agendamento_id`.
 *
 * As 5 etapas no painel:
 *   Assimilação (chegou)  → toda visita
 *   Atração (se interessou) → escolheu um serviço
 *   Arguição (considerou)   → escolheu um horário
 *   Ação (agendou)          → virou agendamento
 *   Apologia (voltou/recomendou) → foi atendido e deu nota 4–5 ou marcou de novo
 *
 * Retomada: quem já está identificado (tem WhatsApp) e parou no meio recebe UMA mensagem,
 * com um link que reabre o agendamento no ponto em que parou. No máximo uma por semana para o mesmo número.
 */
import type { DB } from './db.ts'
import { config } from './config.ts'
import { agora, carimbo, dataExtenso, lerCarimbo, somarMin } from './tempo.ts'
import { horariosLivres } from './agenda.ts'
import { montar, tempoDe } from './mensagens.ts'
import { enviarWhatsApp } from './whatsapp.ts'

export const ETAPA = { abriu: 0, servico: 1, barbeiro: 2, horario: 3, confirmar: 4 } as const

/** Origem vinda do link (?o=instagram) ou do site anterior; só letras, números e hífen */
export const limparOrigem = (o?: string | null) => (o ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'direto'

export type Passo = {
  visita: string; origem?: string; etapa: number; clienteId?: string | null
  servicoId?: string; profissionalId?: string; data?: string; hora?: string
}

/** Registra o passo da visita. A etapa só avança; a escolha (serviço, barbeiro, horário) sempre atualiza. */
export function registrarPasso(db: DB, p: Passo) {
  const agoraTxt = carimbo(agora())
  const v = db.prepare('SELECT etapa, agendamento_id FROM visitas WHERE id = ?').get(p.visita) as { etapa: number; agendamento_id: string | null } | undefined
  if (!v) {
    db.prepare(`INSERT INTO visitas (id, origem, etapa, cliente_id, servico_id, profissional_id, data, hora, criado_em, atualizado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(p.visita, limparOrigem(p.origem), p.etapa, p.clienteId ?? null, p.servicoId ?? null, p.profissionalId ?? null, p.data ?? null, p.hora ?? null, agoraTxt, agoraTxt)
    return
  }
  if (v.agendamento_id) return // visita já virou agendamento
  db.prepare(`UPDATE visitas SET etapa = MAX(etapa, ?), cliente_id = COALESCE(?, cliente_id),
                servico_id = COALESCE(?, servico_id), profissional_id = COALESCE(?, profissional_id),
                data = COALESCE(?, data), hora = COALESCE(?, hora), atualizado_em = ? WHERE id = ?`)
    .run(p.etapa, p.clienteId ?? null, p.servicoId ?? null, p.profissionalId ?? null, p.data ?? null, p.hora ?? null, agoraTxt, p.visita)
}

/** Agendou: fecha a visita e as outras visitas abertas do mesmo cliente nos últimos 3 dias (não contam como "parou"). */
export function fecharVisita(db: DB, visita: string | undefined, clienteId: string, agendamentoId: string) {
  const agoraTxt = carimbo(agora())
  if (visita) {
    const existe = db.prepare('SELECT agendamento_id FROM visitas WHERE id = ?').get(visita) as { agendamento_id: string | null } | undefined
    if (!existe) registrarPasso(db, { visita, etapa: ETAPA.confirmar, clienteId })
    db.prepare(`UPDATE visitas SET agendamento_id = ?, cliente_id = ?, etapa = MAX(etapa, ?), atualizado_em = ?
                WHERE id = ? AND agendamento_id IS NULL`).run(agendamentoId, clienteId, ETAPA.confirmar, agoraTxt, visita)
  }
  db.prepare(`UPDATE visitas SET encerrada = ? WHERE cliente_id = ? AND agendamento_id IS NULL AND encerrada IS NULL AND criado_em >= ? AND id IS NOT ?`)
    .run(agendamentoId, clienteId, carimbo(somarMin(agora(), -3 * 1440)), visita ?? null)
}

/** Link da retomada: o que a pessoa tinha escolhido (sem dados pessoais) e se o horário ainda está livre */
export function infoRetomada(db: DB, id: string) {
  const v = db.prepare('SELECT servico_id AS servicoId, profissional_id AS profissionalId, data, hora, agendamento_id, encerrada FROM visitas WHERE id = ?').get(id) as
    { servicoId: string | null; profissionalId: string | null; data: string | null; hora: string | null; agendamento_id: string | null; encerrada: string | null } | undefined
  if (!v) return null
  const s = v.servicoId ? db.prepare('SELECT duracao FROM servicos WHERE id = ? AND ativo = 1').get(v.servicoId) as { duracao: number } | undefined : undefined
  const prof = v.profissionalId && (v.profissionalId === 'qualquer' || db.prepare('SELECT 1 FROM profissionais WHERE id = ? AND ativo = 1').get(v.profissionalId)) ? v.profissionalId : null
  const livre = !!(s && prof && v.data && v.hora && horariosLivres(db, prof, v.data, s.duracao).includes(v.hora))
  return {
    servicoId: s ? v.servicoId : null, profissionalId: s ? prof : null,
    data: livre ? v.data : null, hora: livre ? v.hora : null, livre,
    jaAgendou: !!(v.agendamento_id || v.encerrada),
  }
}

/** Tarefa automática: manda a mensagem de retomada (das 9h às 20h). */
export async function retomarParados(db: DB) {
  const agoraD = agora()
  const h = agoraD.getHours()
  if (h < 9 || h >= 20) return
  const espera = tempoDe(db, 'retomar') // minutos parado
  const lista = db.prepare(`
    SELECT v.id, v.cliente_id, v.etapa, v.data, v.hora, v.criado_em, c.nome, c.telefone, s.nome AS servico, p.nome AS profissional
    FROM visitas v JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN servicos s ON s.id = v.servico_id LEFT JOIN profissionais p ON p.id = v.profissional_id
    WHERE v.agendamento_id IS NULL AND v.encerrada IS NULL AND v.recuperacao_em IS NULL AND v.etapa >= ?
      AND v.atualizado_em <= ? AND v.atualizado_em > ? AND c.telefone NOT LIKE 'balcao-%'`)
    .all(ETAPA.servico, carimbo(somarMin(agoraD, -espera)), carimbo(somarMin(agoraD, -24 * 60))) as
    { id: string; cliente_id: string; etapa: number; data: string | null; hora: string | null; criado_em: string; nome: string; telefone: string; servico: string | null; profissional: string | null }[]
  const semana = carimbo(somarMin(agoraD, -7 * 1440))
  for (const v of lista) {
    // marcou de outro jeito (balcão, outra visita): não precisa retomar
    const marcou = db.prepare("SELECT id FROM agendamentos WHERE cliente_id = ? AND status = 'confirmado' AND criado_em >= ?").get(v.cliente_id, v.criado_em) as { id: string } | undefined
    if (marcou) { db.prepare('UPDATE visitas SET encerrada = ? WHERE id = ?').run(marcou.id, v.id); continue }
    db.prepare('UPDATE visitas SET recuperacao_em = ? WHERE id = ?').run(carimbo(agoraD), v.id)
    // no máximo uma retomada por semana para o mesmo número
    if (db.prepare("SELECT 1 FROM mensagens WHERE telefone = ? AND tipo = 'retomar' AND criado_em >= ?").get(v.telefone, semana)) {
      db.prepare("UPDATE visitas SET recuperacao_em = 'pulada' WHERE id = ?").run(v.id)
      continue
    }
    const barbeiro = v.profissional ? ` com o ${v.profissional.split(' ')[0]}` : ''
    const quando = v.data && v.hora ? `, ${dataExtenso(v.data).split(',')[0]} às ${v.hora}` : ''
    const texto = montar(db, 'retomar', {
      nome: v.nome.split(' ')[0], servico: v.servico ?? 'seu horário', barbeiro: v.profissional ?? '',
      escolha: `${v.servico ?? 'seu horário'}${barbeiro}${quando}`, link: `${config.urlApp}/#retomar/${v.id}`,
    })
    if (texto) await enviarWhatsApp(db, v.telefone, 'retomar', texto, v.id)
  }
}

/** Situação de quem parou no meio, para o painel */
export type EstadoParado = 'aguardando' | 'enviada' | 'recuperado' | 'nao_voltou' | 'voltou_sozinho'

const NOMES_ETAPA = ['abriu o app', 'serviço', 'barbeiro', 'horário', 'confirmar']

/** Números do funil no período (dias = 1 hoje, 7 ou 30) */
export function resumoFunil(db: DB, dias: number) {
  const agoraD = agora()
  const ini = new Date(agoraD); ini.setHours(0, 0, 0, 0); ini.setDate(ini.getDate() - (dias - 1))
  const desde = carimbo(ini)
  const n = (sql: string, ...a: (string | number)[]) => (db.prepare(sql).get(desde, ...a) as { n: number }).n

  const chegou = n('SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ?')
  const atracao = n('SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND (etapa >= ? OR agendamento_id IS NOT NULL)', ETAPA.servico)
  const arguicao = n('SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND (etapa >= ? OR agendamento_id IS NOT NULL)', ETAPA.horario)
  const acao = n('SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND agendamento_id IS NOT NULL')
  // apologia: atendido e satisfeito (nota 4–5) ou já marcou de novo
  const apologia = n(`SELECT COUNT(*) AS n FROM visitas v JOIN agendamentos a ON a.id = v.agendamento_id AND a.status = 'concluido'
                      WHERE v.criado_em >= ? AND (EXISTS (SELECT 1 FROM avaliacoes x WHERE x.agendamento_id = a.id AND x.nota >= 4)
                        OR EXISTS (SELECT 1 FROM agendamentos b WHERE b.cliente_id = a.cliente_id AND b.criado_em > a.criado_em AND b.status IN ('confirmado','concluido')))`)
  const atendidos = n(`SELECT COUNT(*) AS n FROM visitas v JOIN agendamentos a ON a.id = v.agendamento_id AND a.status = 'concluido' WHERE v.criado_em >= ?`)

  const origens = db.prepare(`SELECT origem, COUNT(*) AS visitas, SUM(agendamento_id IS NOT NULL) AS agendaram FROM visitas
                              WHERE criado_em >= ? GROUP BY origem ORDER BY visitas DESC`).all(desde) as { origem: string; visitas: number; agendaram: number }[]

  // onde as pessoas pararam (só quem saiu sem agendar)
  const saidas = (db.prepare(`SELECT etapa, COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND agendamento_id IS NULL AND encerrada IS NULL
                              AND atualizado_em <= ? GROUP BY etapa`).all(desde, carimbo(somarMin(agoraD, -10))) as { etapa: number; n: number }[])
    .map((s) => ({ etapa: NOMES_ETAPA[s.etapa] ?? 'outra', n: s.n }))

  // ao vivo: mexeu no app nos últimos 10 minutos e ainda não agendou
  const aoVivo = db.prepare(`SELECT v.id, v.origem, v.etapa, v.atualizado_em AS quando, c.nome, s.nome AS servico FROM visitas v
                             LEFT JOIN clientes c ON c.id = v.cliente_id LEFT JOIN servicos s ON s.id = v.servico_id
                             WHERE v.atualizado_em > ? AND v.agendamento_id IS NULL ORDER BY v.atualizado_em DESC LIMIT 30`)
    .all(carimbo(somarMin(agoraD, -10))) as { id: string; origem: string; etapa: number; quando: string; nome: string | null; servico: string | null }[]

  // pararam no meio: identificados (dá para retomar), dos últimos 7 dias
  const espera = tempoDe(db, 'retomar')
  const parados = (db.prepare(`
    SELECT v.id, v.etapa, v.origem, v.data, v.hora, v.atualizado_em AS quando, v.recuperacao_em, v.agendamento_id, v.encerrada,
           c.nome, c.telefone, s.nome AS servico, p.nome AS profissional
    FROM visitas v JOIN clientes c ON c.id = v.cliente_id LEFT JOIN servicos s ON s.id = v.servico_id LEFT JOIN profissionais p ON p.id = v.profissional_id
    WHERE v.etapa >= ? AND v.criado_em >= ? AND c.telefone NOT LIKE 'balcao-%'
      AND (v.recuperacao_em IS NOT NULL OR (v.agendamento_id IS NULL AND v.encerrada IS NULL AND v.atualizado_em <= ?))
    ORDER BY v.atualizado_em DESC LIMIT 50`)
    .all(ETAPA.servico, carimbo(somarMin(agoraD, -7 * 1440)), carimbo(somarMin(agoraD, -10))) as
    { id: string; etapa: number; origem: string; data: string | null; hora: string | null; quando: string; recuperacao_em: string | null; agendamento_id: string | null; encerrada: string | null
      nome: string; telefone: string; servico: string | null; profissional: string | null }[])
    .map((v) => {
      const enviada = !!v.recuperacao_em && v.recuperacao_em !== 'pulada'
      const voltou = !!(v.agendamento_id || v.encerrada)
      const estado: EstadoParado = voltou ? (enviada ? 'recuperado' : 'voltou_sozinho')
        : enviada ? (v.recuperacao_em! < carimbo(somarMin(agoraD, -24 * 60)) ? 'nao_voltou' : 'enviada')
        : v.quando < carimbo(somarMin(agoraD, -24 * 60)) || v.recuperacao_em === 'pulada' ? 'nao_voltou' : 'aguardando'
      return {
        id: v.id, nome: v.nome, telefone: v.telefone, origem: v.origem, parouEm: NOMES_ETAPA[v.etapa], servico: v.servico, profissional: v.profissional,
        data: v.data, hora: v.hora, quando: v.quando, estado, enviadaEm: enviada ? v.recuperacao_em : null,
        mensagemEm: estado === 'aguardando' ? carimbo(somarMin(lerCarimbo(v.quando), espera)) : null,
      }
    })

  const enviadas = n("SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND recuperacao_em IS NOT NULL AND recuperacao_em != 'pulada'")
  const recuperados = n("SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND recuperacao_em IS NOT NULL AND recuperacao_em != 'pulada' AND (agendamento_id IS NOT NULL OR encerrada IS NOT NULL)")
  const anonimos = n(`SELECT COUNT(*) AS n FROM visitas WHERE criado_em >= ? AND cliente_id IS NULL AND agendamento_id IS NULL AND etapa >= ? AND atualizado_em <= ?`,
    ETAPA.servico, carimbo(somarMin(agoraD, -10)))

  return {
    dias, agora: carimbo(agoraD),
    etapas: { chegou, atracao, arguicao, acao, apologia, atendidos },
    origens, saidas, aoVivo, parados,
    retomada: { enviadas, recuperados, anonimos, esperaMin: espera },
  }
}

/** Privacidade: visitas antigas saem depois de 6 meses */
export function limparVisitas(db: DB) {
  db.prepare('DELETE FROM visitas WHERE criado_em < ?').run(carimbo(somarMin(agora(), -180 * 1440)))
}
