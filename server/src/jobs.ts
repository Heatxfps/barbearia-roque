/**
 * Tarefas automáticas (rodam a cada minuto):
 *  - lembrete 24h antes (se o horário foi marcado com mais de 24h de antecedência)
 *  - lembrete 1h antes
 *  - "volte a cortar": clientes há X dias sem vir e sem horário marcado (das 10h às 19h)
 *  - avaliação: 1h depois do atendimento concluído, link para dar a nota (das 9h às 21h)
 *  - aniversário: no dia, cupom de desconto automático (a partir das 9h)
 *  - lista de espera: abriu vaga num dia lotado → avisa o primeiro da fila; 30 min depois, o próximo
 */
import type { DB } from './db.ts'
import { lerBarbearia, novoId } from './db.ts'
import { config } from './config.ts'
import { horariosLivres } from './agenda.ts'
import { agora, carimbo, dataIso, lerCarimbo, somarMin } from './tempo.ts'
import { notificar } from './servicos-agendamento.ts'
import { enviarWhatsApp } from './whatsapp.ts'
import { textos } from './textos.ts'

type Linha = { id: string; inicio: string; criado_em: string }

export function clientesParaRetorno(db: DB) {
  const dias = config.regras.diasRetorno
  const limite = carimbo(somarMin(agora(), -dias * 24 * 60))
  const agoraTxt = carimbo(agora())
  const linhas = db.prepare(`
    SELECT c.id, c.nome, c.telefone, c.aviso_retorno_em AS avisadoEm, MAX(a.inicio) AS ultimaVisita
    FROM clientes c JOIN agendamentos a ON a.cliente_id = c.id AND a.status = 'concluido'
    WHERE c.telefone NOT LIKE 'balcao-%'
      AND NOT EXISTS (SELECT 1 FROM agendamentos f WHERE f.cliente_id = c.id AND f.status = 'confirmado' AND f.inicio > ?)
    GROUP BY c.id HAVING ultimaVisita <= ? ORDER BY ultimaVisita`).all(agoraTxt, limite) as
    { id: string; nome: string; telefone: string; avisadoEm: string | null; ultimaVisita: string }[]
  return linhas.map((l) => ({
    ...l,
    dias: Math.floor((agora().getTime() - lerCarimbo(l.ultimaVisita).getTime()) / 86_400_000),
    avisado: !!l.avisadoEm && l.avisadoEm > l.ultimaVisita,
  }))
}

export async function rodarTarefas(db: DB) {
  const agoraD = agora()
  const agoraTxt = carimbo(agoraD)

  // lembrete de 24h
  const em24 = db.prepare(`SELECT id, inicio, criado_em FROM agendamentos
                           WHERE status = 'confirmado' AND lembrete_24h = 0 AND inicio > ? AND inicio <= ?`)
    .all(carimbo(somarMin(agoraD, 180)), carimbo(somarMin(agoraD, 24 * 60))) as Linha[]
  for (const a of em24) {
    db.prepare('UPDATE agendamentos SET lembrete_24h = 1 WHERE id = ?').run(a.id)
    // marcado em cima da hora: a confirmação já serve de lembrete
    if (a.criado_em <= carimbo(somarMin(lerCarimbo(a.inicio), -24 * 60))) await notificar(db, a.id, 'lembrete_24h')
  }

  // lembrete de 1h
  const em1 = db.prepare(`SELECT id, inicio, criado_em FROM agendamentos
                          WHERE status = 'confirmado' AND lembrete_1h = 0 AND inicio > ? AND inicio <= ?`)
    .all(agoraTxt, carimbo(somarMin(agoraD, 60))) as Linha[]
  for (const a of em1) {
    db.prepare('UPDATE agendamentos SET lembrete_1h = 1 WHERE id = ?').run(a.id)
    if (a.criado_em <= carimbo(somarMin(lerCarimbo(a.inicio), -90))) await notificar(db, a.id, 'lembrete_1h')
  }

  await convidarAvaliacao(db)
  await parabenizar(db)
  await avisarEspera(db)

  // volte a cortar (só em horário comercial)
  const h = agoraD.getHours()
  if (h >= 10 && h < 19) {
    const nome = lerBarbearia(db).nome
    for (const c of clientesParaRetorno(db).filter((c) => !c.avisado)) {
      db.prepare('UPDATE clientes SET aviso_retorno_em = ? WHERE id = ?').run(agoraTxt, c.id)
      await enviarWhatsApp(db, c.telefone, 'retorno', textos.retorno(c.nome, c.dias, nome))
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
    .all(carimbo(somarMin(agoraD, -60)), carimbo(somarMin(agoraD, -48 * 60))) as { id: string; nome: string; telefone: string; profissional: string }[]
  if (!lista.length) return
  const nome = lerBarbearia(db).nome
  for (const a of lista) {
    db.prepare('UPDATE agendamentos SET avaliacao_enviada = 1 WHERE id = ?').run(a.id)
    await enviarWhatsApp(db, a.telefone, 'avaliacao', textos.avaliacao(a.nome, a.profissional, nome, `${config.urlApp}/#avaliar/${a.id}`))
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
  const validade = new Date(agoraD); validade.setDate(validade.getDate() + config.regras.diasCupom)
  const validoAte = dataIso(validade)
  for (const c of lista) {
    db.prepare('UPDATE clientes SET aniversario_ano = ? WHERE id = ?').run(ano, c.id)
    db.prepare('INSERT INTO cupons (id, cliente_id, motivo, desconto_pct, valido_ate, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
      .run(novoId(), c.id, 'aniversario', pct, validoAte, carimbo(agoraD))
    await enviarWhatsApp(db, c.telefone, 'aniversario', textos.aniversario(c.nome, pct, `${validoAte.slice(8, 10)}/${validoAte.slice(5, 7)}`, b.nome, config.urlApp))
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
  const nome = lerBarbearia(db).nome
  const vezDe = new Set<string>()   // dias em que alguém ainda está na vez (avisado há menos de 30 min)
  for (const e of linhas) {
    if (e.avisadoEm && e.avisadoEm > limite) { vezDe.add(e.data); continue }
    if (e.avisadoEm || vezDe.has(e.data)) continue
    const horas = horariosLivres(db, e.prof, e.data, e.duracao)
    if (!horas.length) continue
    vezDe.add(e.data)
    db.prepare('UPDATE espera SET avisado_em = ? WHERE id = ?').run(carimbo(agoraD), e.id)
    await enviarWhatsApp(db, e.telefone, 'espera', textos.espera(e.nome, e.servico, e.data, horas, nome, config.urlApp))
  }
}

export function iniciarTarefas(db: DB) {
  const rodar = () => rodarTarefas(db).catch((e) => console.error('Erro nas tarefas automáticas:', e))
  rodar()
  return setInterval(rodar, 60_000)
}
