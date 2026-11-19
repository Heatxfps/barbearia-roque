/**
 * Tarefas automáticas (rodam a cada minuto):
 *  - lembrete 24h antes (se o horário foi marcado com mais de 24h de antecedência)
 *  - lembrete 1h antes
 *  - "volte a cortar": clientes há X dias sem vir e sem horário marcado (das 10h às 19h)
 */
import type { DB } from './db.ts'
import { lerBarbearia } from './db.ts'
import { config } from './config.ts'
import { agora, carimbo, lerCarimbo, somarMin } from './tempo.ts'
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

export function iniciarTarefas(db: DB) {
  const rodar = () => rodarTarefas(db).catch((e) => console.error('Erro nas tarefas automáticas:', e))
  rodar()
  return setInterval(rodar, 60_000)
}
