/**
 * Mensagens editáveis pelo dono: lê o modelo (texto, ligado/desligado, tempo) e monta o texto final.
 * Os textos padrão ficam em shared/modelos.ts (o painel usa o mesmo arquivo).
 */
import type { DB } from './db.ts'
import { lerBarbearia } from './db.ts'
import { config } from './config.ts'
import { dataExtenso } from './tempo.ts'
import { MODELOS, modeloPadrao, preencher } from '../../shared/modelos.ts'

export type Modelo = { texto: string; ativo: boolean; valor: number | null; personalizado: boolean }

export function lerModelo(db: DB, chave: string): Modelo {
  const p = modeloPadrao(chave)
  if (!p) throw new Error(`Modelo desconhecido: ${chave}`)
  const o = db.prepare('SELECT texto, ativo, valor FROM modelos WHERE chave = ?').get(chave) as { texto: string | null; ativo: number; valor: number | null } | undefined
  return { texto: o?.texto ?? p.texto, ativo: o ? !!o.ativo : true, valor: o?.valor ?? p.tempo?.padrao ?? null, personalizado: !!o?.texto }
}

/** Tempo configurado (horas ou dias) de um modelo */
export const tempoDe = (db: DB, chave: string) => lerModelo(db, chave).valor ?? modeloPadrao(chave)?.tempo?.padrao ?? 0

/** Texto pronto para enviar, ou null se o dono desligou essa mensagem */
export function montar(db: DB, chave: string, vars: Record<string, string | number | undefined>): string | null {
  const m = lerModelo(db, chave)
  if (!m.ativo) return null
  const b = lerBarbearia(db)
  return preencher(m.texto, { barbearia: b.nome, endereco: b.endereco, cidade: (b.cidade ?? '').split(' - ')[0], link: config.urlApp, ...vars })
}

export function listarModelos(db: DB) {
  return MODELOS.map((p) => {
    const m = lerModelo(db, p.chave)
    return { ...p, padrao: p.texto, texto: m.texto, ativo: m.ativo, valor: m.valor, personalizado: m.personalizado }
  })
}

/** Variáveis de um agendamento (para confirmação, lembretes, automações…) */
export const varsAgendamento = (d: { nome: string; servico: string; profissional: string; inicio: string; telefone?: string }) => ({
  nome: d.nome.split(' ')[0], servico: d.servico, barbeiro: d.profissional,
  data: dataExtenso(d.inicio), hora: d.inicio.slice(11, 16), telefone: d.telefone,
})
