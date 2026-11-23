/**
 * Tarefas automáticas (rodam a cada minuto):
 *  - lembrete 24h antes (se o horário foi marcado com mais de 24h de antecedência)
 *  - lembrete 1h antes
 *  - "volte a cortar": clientes há X dias sem vir e sem horário marcado (das 10h às 19h)
 *  - avaliação: 1h depois do atendimento concluído, link para dar a nota (das 9h às 21h)
 *  - aniversário: no dia, cupom de desconto automático (a partir das 9h)
 *  - lista de espera: abriu vaga num dia lotado → avisa o primeiro da fila; 30 min depois, o próximo
 *  - fila do dia: convite "pode adiantar" que venceu passa para o próximo cliente (fila.ts)
 *  - cupom de aniversário perto de vencer, pedido da loja separado e não retirado
 */
import type { DB } from './db.ts'
import { lerBarbearia, novoId } from './db.ts'
import { config } from './config.ts'
import { horariosLivres } from './agenda.ts'
import { agora, carimbo, dataIso, lerCarimbo, somarMin } from './tempo.ts'
import { notificar } from './servicos-agendamento.ts'
import { enviarWhatsApp } from './whatsapp.ts'
import { montar, tempoDe, varsAgendamento } from './mensagens.ts'
import { preencher } from '../../shared/modelos.ts'
import { dataExtenso } from './tempo.ts'
import { vencerConvites } from './fila.ts'

type Linha = { id: string; inicio: string; criado_em: string }

export function clientesParaRetorno(db: DB) {
  const dias = tempoDe(db, 'retorno')
  const limite = carimbo(somarMin(agora(), -dias * 24 * 60))
  const agoraTxt = carimbo(agora())
  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.telefone, c.aviso_retorno_em AS avisadoEm, MAX(a.inicio) AS ultimaVisita,
           (SELECT p.nome FROM agendamentos u JOIN profissionais p ON p.id = u.profissional_id
             WHERE u.cliente_id = c.id AND u.status = 'concluido' ORDER BY u.inicio DESC LIMIT 1) AS barbeiro
    FROM clientes c JOIN agendamentos a ON a.cliente_id = c.id AND a.status = 'concluido'
    WHERE c.telefone NOT LIKE 'balcao-%'
      AND NOT EXISTS (SELECT 1 FROM agendamentos f WHERE f.cliente_id = c.id AND f.status = 'confirmado' AND f.inicio > ?)
    GROUP BY c.id HAVING ultimaVisita <= ? ORDER BY ultimaVisita`).all(agoraTxt, limite) as
    { id: string; nome: string; telefone: string; avisadoEm: string | null; ultimaVisita: string; barbeiro: string }[]
  return linhas.map((l) => ({
    ...l,
    dias: Math.floor((agora().getTime() - lerCarimbo(l.ultimaVisita).getTime()) / 86_400_000),
    avisado: !!l.avisadoEm && l.avisadoEm > l.ultimaVisita,
  }))
}

export async function rodarTarefas(db: DB) {
  const agoraD = agora()
  const agoraTxt = carimbo(agoraD)

  // lembrete da véspera (tempo configurável; padrão 24 h antes)
  const h1 = tempoDe(db, 'lembrete_1h') * 60
  const h24 = Math.max(tempoDe(db, 'lembrete_24h') * 60, h1 + 60)
  const em24 = db.prepare(`SELECT id, inicio, criado_em FROM agendamentos
                           WHERE status = 'confirmado' AND lembrete_24h = 0 AND inicio > ? AND inicio <= ?`)
    .all(carimbo(somarMin(agoraD, h1 + 60)), carimbo(somarMin(agoraD, h24))) as Linha[]
  for (const a of em24) {
    db.prepare('UPDATE agendamentos SET lembrete_24h = 1 WHERE id = ?').run(a.id)
    // marcado em cima da hora: a confirmação já serve de lembrete
    if (a.criado_em <= carimbo(somarMin(lerCarimbo(a.inicio), -h24))) await notificar(db, a.id, 'lembrete_24h')
  }

  // lembrete em cima da hora (padrão 1 h antes)
  const em1 = db.prepare(`SELECT id, inicio, criado_em FROM agendamentos
                          WHERE status = 'confirmado' AND lembrete_1h = 0 AND inicio > ? AND inicio <= ?`)
    .all(agoraTxt, carimbo(somarMin(agoraD, h1))) as Linha[]
  for (const a of em1) {
    db.prepare('UPDATE agendamentos SET lembrete_1h = 1 WHERE id = ?').run(a.id)
    if (a.criado_em <= carimbo(somarMin(lerCarimbo(a.inicio), -(h1 + 30)))) await notificar(db, a.id, 'lembrete_1h')
  }

  await rodarAutomacoes(db)
  limparDados(db)
  vencerConvites(db)
  await cupomVencendo(db)
  await pedidoParado(db)

  await convidarAvaliacao(db)
  await parabenizar(db)
  await avisarEspera(db)

  // volte a cortar (só em horário comercial)
  const h = agoraD.getHours()
  if (h >= 10 && h < 19) {
    for (const c of clientesParaRetorno(db).filter((c) => !c.avisado)) {
      db.prepare('UPDATE clientes SET aviso_retorno_em = ? WHERE id = ?').run(agoraTxt, c.id)
      const texto = montar(db, 'retorno', { nome: c.nome.split(' ')[0], dias: c.dias, barbeiro: (c.barbeiro ?? 'a gente').split(' ')[0] })
      if (texto) await enviarWhatsApp(db, c.telefone, 'retorno', texto, c.id)
    }
  }
}

/** Convite para avaliar, 1h depois do atendimento concluído (só uma vez por atendimento). */
async function convidarAvaliacao(db: DB) {
  const agoraD = agora()
  const h = agoraD.getHours()
  if (h < 9 || h >= 21) return
  const lista = db.prepare(`SELECT a.id, c.nome, c.telefone, p.nome AS profissional FROM agendamentos a
                            JOIN clientes c ON c.id = a.cliente_id JOIN profissionais p ON p.id = a.profissional_id
                            WHERE a.status = 'concluido' AND a.avaliacao_enviada = 0 AND a.fim <= ? AND a.fim > ?
                              AND c.telefone NOT LIKE 'balcao-%'
                              AND NOT EXISTS (SELECT 1 FROM avaliacoes v WHERE v.agendamento_id = a.id)`)
    .all(carimbo(somarMin(agoraD, -tempoDe(db, 'avaliacao') * 60)), carimbo(somarMin(agoraD, -48 * 60))) as { id: string; nome: string; telefone: string; profissional: string }[]
  for (const a of lista) {
    db.prepare('UPDATE agendamentos SET avaliacao_enviada = 1 WHERE id = ?').run(a.id)
    const texto = montar(db, 'avaliacao', { nome: a.nome.split(' ')[0], barbeiro: a.profissional, link: `${config.urlApp}/#avaliar/${a.id}` })
    if (texto) await enviarWhatsApp(db, a.telefone, 'avaliacao', texto, a.id)
  }
}

/** No dia do aniversário: cria o cupom e avisa (uma vez por ano). */
async function parabenizar(db: DB) {
  const agoraD = agora()
  if (agoraD.getHours() < 9 || agoraD.getHours() >= 20) return
  const ano = agoraD.getFullYear()
  const hoje = dataIso(agoraD)
  const lista = db.prepare(`SELECT id, nome, telefone FROM clientes
                            WHERE aniversario = ? AND (aniversario_ano IS NULL OR aniversario_ano < ?) AND telefone NOT LIKE 'balcao-%'`)
    .all(hoje.slice(5), ano) as { id: string; nome: string; telefone: string }[]
  if (!lista.length) return
  const b = lerBarbearia(db)
  const pct = Math.min(100, Math.max(0, Number(b.desconto_aniversario ?? 15)))
  if (!pct) return
  const validade = new Date(agoraD); validade.setDate(validade.getDate() + Math.max(0, Number(b.validade_aniversario ?? config.regras.diasCupom)))
  const validoAte = dataIso(validade)
  for (const c of lista) {
    db.prepare('UPDATE clientes SET aniversario_ano = ? WHERE id = ?').run(ano, c.id)
    db.prepare('INSERT INTO cupons (id, cliente_id, motivo, desconto_pct, valido_ate, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(novoId(), c.id, 'aniversario', pct, validoAte, carimbo(agoraD))
    const texto = montar(db, 'aniversario', { nome: c.nome.split(' ')[0], desconto: pct, validade: validoAte === hoje ? 'hoje' : `${validoAte.slice(8, 10)}/${validoAte.slice(5, 7)}` })
    if (texto) await enviarWhatsApp(db, c.telefone, 'aniversario', texto, c.id)
  }
}

/** Lista de espera: um por vez, na ordem de chegada; cada um tem 30 min para garantir a vaga. */
async function avisarEspera(db: DB) {
  const agoraD = agora()
  const hoje = dataIso(agoraD)
  db.prepare('DELETE FROM espera WHERE data < ?').run(hoje)
  const h = agoraD.getHours()
  if (h < 8 || h >= 21) return
  const limite = carimbo(somarMin(agoraD, -30))
  const linhas = db.prepare(`SELECT e.id, e.data, e.profissional_id AS prof, e.avisado_em AS avisadoEm, s.duracao, s.nome AS servico, c.nome, c.telefone
                             FROM espera e JOIN servicos s ON s.id = e.servico_id JOIN clientes c ON c.id = e.cliente_id
                             ORDER BY e.data, e.criado_em`).all() as
    { id: string; data: string; prof: string; avisadoEm: string | null; duracao: number; servico: string; nome: string; telefone: string }[]
  const vezDe = new Set<string>()   // dias em que alguém ainda está na vez (avisado há menos de 30 min)
  for (const e of linhas) {
    if (e.avisadoEm && e.avisadoEm > limite) { vezDe.add(e.data); continue }
    if (e.avisadoEm || vezDe.has(e.data)) continue
    const horas = horariosLivres(db, e.prof, e.data, e.duracao)
    if (!horas.length) continue
    vezDe.add(e.data)
    db.prepare('UPDATE espera SET avisado_em = ? WHERE id = ?').run(carimbo(agoraD), e.id)
    const texto = montar(db, 'espera', { nome: e.nome.split(' ')[0], servico: e.servico, data: dataExtenso(e.data), horarios: horas.slice(0, 4).join(', ') + (horas.length > 4 ? '…' : '') })
    if (texto) await enviarWhatsApp(db, e.telefone, 'espera', texto, e.id)
  }
}

/** Automações criadas pelo dono. Cada uma vai uma vez por atendimento e nunca "para trás":
 *  só conta o que vence depois que a automação foi criada (não dispara para o histórico). */
async function rodarAutomacoes(db: DB) {
  const lista = db.prepare('SELECT * FROM automacoes WHERE ativo = 1').all() as { id: string; gatilho: string; valor: number; texto: string; criado_em: string }[]
  if (!lista.length) return
  const agoraD = agora()
  const agoraTxt = carimbo(agoraD)
  const h = agoraD.getHours()
  const horaBoa = h >= 8 && h < 21
  const sel = `SELECT a.id, a.inicio, a.fim, a.criado_em, c.nome, c.telefone, s.nome AS servico, p.nome AS profissional, a.cliente_id
               FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
               WHERE c.telefone NOT LIKE 'balcao-%' AND NOT EXISTS (SELECT 1 FROM automacao_envios x WHERE x.automacao_id = ? AND x.ref = a.id)`
  type Ag = { id: string; inicio: string; fim: string; criado_em: string; nome: string; telefone: string; servico: string; profissional: string; cliente_id: string }
  for (const au of lista) {
    let alvos: Ag[] = []
    if (au.gatilho === 'antes_horario') {
      const ate = carimbo(somarMin(agoraD, au.valor * 60))
      alvos = (db.prepare(`${sel} AND a.status = 'confirmado' AND a.inicio > ? AND a.inicio <= ?`).all(au.id, agoraTxt, ate) as Ag[])
        .filter((a) => carimbo(somarMin(lerCarimbo(a.inicio), -au.valor * 60)) >= au.criado_em && a.criado_em <= carimbo(somarMin(lerCarimbo(a.inicio), -au.valor * 60)))
    } else if (horaBoa) {
      const min = au.gatilho === 'dias_depois' ? au.valor * 1440 : au.valor * 60
      const vence = carimbo(somarMin(agoraD, -min))
      alvos = (db.prepare(`${sel} AND a.status = 'concluido' AND a.fim <= ? AND a.fim > ?`).all(au.id, vence, carimbo(somarMin(agoraD, -min - 2 * 1440))) as Ag[])
        .filter((a) => carimbo(somarMin(lerCarimbo(a.fim), min)) >= au.criado_em)
      if (au.gatilho === 'primeira_visita') alvos = alvos.filter((a) =>
        (db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE cliente_id = ? AND status = 'concluido' AND inicio <= ?").get(a.cliente_id, a.inicio) as { n: number }).n === 1)
    }
    for (const a of alvos) {
      db.prepare('INSERT OR IGNORE INTO automacao_envios (automacao_id, ref, enviado_em) VALUES (?, ?, ?)').run(au.id, a.id, agoraTxt)
      const b = lerBarbearia(db)
      const texto = preencher(au.texto, { barbearia: b.nome, endereco: b.endereco, cidade: (b.cidade ?? '').split(' - ')[0], link: config.urlApp, ...varsAgendamento(a) })
      await enviarWhatsApp(db, a.telefone, 'automacao', texto, a.id)
    }
  }
}

/** Privacidade: não guarda o que não precisa.
 *  - códigos de acesso vencidos saem na hora
 *  - histórico de mensagens do WhatsApp fica 6 meses (tem nome e telefone do cliente) */
export function limparDados(db: DB) {
  db.prepare('DELETE FROM codigos WHERE expira_em < ?').run(Date.now() - 60_000)
  db.prepare('DELETE FROM mensagens WHERE criado_em < ?').run(carimbo(somarMin(agora(), -180 * 1440)))
}

/** Cupom de aniversário perto de vencer: quem não usou e não tem horário marcado (uma vez por cupom). */
async function cupomVencendo(db: DB) {
  const agoraD = agora()
  if (agoraD.getHours() < 10 || agoraD.getHours() >= 19) return
  const dias = tempoDe(db, 'cupom_vencendo')
  const hoje = dataIso(agoraD)
  const ate = new Date(agoraD); ate.setDate(ate.getDate() + dias)
  const lista = db.prepare(`SELECT u.id, u.desconto_pct, u.valido_ate, u.criado_em, c.id AS cliente, c.nome, c.telefone FROM cupons u JOIN clientes c ON c.id = u.cliente_id
                            WHERE u.agendamento_id IS NULL AND u.aviso_vencendo = 0 AND u.valido_ate >= ? AND u.valido_ate <= ?
                              AND NOT EXISTS (SELECT 1 FROM agendamentos f WHERE f.cliente_id = c.id AND f.status = 'confirmado' AND f.inicio > ?)`)
    .all(hoje, dataIso(ate), carimbo(agoraD)) as { id: string; desconto_pct: number; valido_ate: string; criado_em: string; cliente: string; nome: string; telefone: string }[]
  for (const u of lista) {
    db.prepare('UPDATE cupons SET aviso_vencendo = 1 WHERE id = ?').run(u.id)
    // cupom curto (ex.: vale só no dia ou 1 semana com aviso de 7 dias): o parabéns já avisou
    const duracao = (lerCarimbo(u.valido_ate).getTime() - lerCarimbo(u.criado_em.slice(0, 10)).getTime()) / 86_400_000
    if (duracao <= dias) continue
    const validade = u.valido_ate === hoje ? 'hoje' : `em ${u.valido_ate.slice(8, 10)}/${u.valido_ate.slice(5, 7)}`
    const texto = montar(db, 'cupom_vencendo', { nome: u.nome.split(' ')[0], desconto: u.desconto_pct, validade })
    if (texto) await enviarWhatsApp(db, u.telefone, 'cupom_vencendo', texto, u.cliente)
  }
}

/** Pedido separado e não retirado depois de X dias: um lembrete. */
async function pedidoParado(db: DB) {
  const agoraD = agora()
  if (agoraD.getHours() < 10 || agoraD.getHours() >= 19) return
  const limite = carimbo(somarMin(agoraD, -tempoDe(db, 'pedido_parado') * 1440))
  const lista = db.prepare(`SELECT o.id, c.nome, c.telefone FROM pedidos o JOIN clientes c ON c.id = o.cliente_id
                            WHERE o.status = 'separado' AND o.lembrete_enviado = 0 AND o.separado_em IS NOT NULL AND o.separado_em <= ?`).all(limite) as { id: string; nome: string; telefone: string }[]
  for (const o of lista) {
    db.prepare('UPDATE pedidos SET lembrete_enviado = 1 WHERE id = ?').run(o.id)
    const itens = (db.prepare('SELECT nome, qtd FROM pedido_itens WHERE pedido_id = ?').all(o.id) as { nome: string; qtd: number }[]).map((i) => `• ${i.qtd}× ${i.nome}`).join('\n')
    const texto = montar(db, 'pedido_parado', { nome: o.nome.split(' ')[0], itens })
    if (texto) await enviarWhatsApp(db, o.telefone, 'pedido_parado', texto, o.id)
  }
}

export function iniciarTarefas(db: DB) {
  const rodar = () => rodarTarefas(db).catch((e) => console.error('Erro nas tarefas automáticas:', e))
  rodar()
  return setInterval(rodar, 60_000)
}
