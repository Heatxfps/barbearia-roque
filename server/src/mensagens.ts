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

/** Texto pronto para enviar, ou null se o dono desligou essa mensagem (`mesmoDesligada`: envio pedido na mão) */
export function montar(db: DB, chave: string, vars: Record<string, string | number | undefined>, mesmoDesligada = false): string | null {
  const m = lerModelo(db, chave)
  if (!m.ativo && !mesmoDesligada) return null
  const b = lerBarbearia(db)
  return preencher(m.texto, { barbearia: b.nome, endereco: b.endereco, cidade: (b.cidade ?? '').split(' - ')[0], link: config.urlApp, ...vars })
}

export function listarModelos(db: DB) {
  return MODELOS.map((p) => {
    const m = lerModelo(db, p.chave)
    return { ...p, padrao: p.texto, texto: m.texto, ativo: m.ativo, valor: m.valor, personalizado: m.personalizado }
  })
}

/** Situação de uma mensagem para mostrar no painel (Clientes → lembretes, chamar de volta, aniversários) */
export type Estado =
  | { estado: 'enviada' | 'falhou'; quando: string; erro?: string | null; tipo: string }
  | { estado: 'programada'; quando: string }
  | { estado: 'nao_vai' | 'desligada' | 'sem_whatsapp'; motivo?: string }

type LinhaMsg = { status: string; erro: string | null; criado_em: string; tipo: string }
const deMensagem = (m: LinhaMsg): Estado => ({ estado: m.status === 'erro' ? 'falhou' : 'enviada', quando: m.criado_em, erro: m.erro, tipo: m.tipo })

/** Última mensagem desses tipos ligada a um agendamento/cliente (ref) ou, nas antigas sem ref, ao telefone desde uma data */
export function ultimaMensagem(db: DB, tipos: string[], f: { ref?: string; telefone?: string; desde?: string }): Estado | null {
  const em = tipos.map(() => '?').join(',')
  const m = (f.ref
    ? db.prepare(`SELECT status, erro, criado_em, tipo FROM mensagens WHERE ref = ? AND tipo IN (${em}) ORDER BY criado_em DESC, rowid DESC LIMIT 1`).get(f.ref, ...tipos)
    : undefined) ?? (f.telefone
    ? db.prepare(`SELECT status, erro, criado_em, tipo FROM mensagens WHERE telefone = ? AND tipo IN (${em}) AND criado_em >= ? ORDER BY criado_em DESC, rowid DESC LIMIT 1`).get(f.telefone, ...tipos, f.desde ?? '')
    : undefined)
  return m ? deMensagem(m as LinhaMsg) : null
}

/** Variáveis de um agendamento (para confirmação, lembretes, automações…) */
export const varsAgendamento = (d: { nome: string; servico: string; profissional: string; inicio: string; telefone?: string }) => ({
  nome: d.nome.split(' ')[0], servico: d.servico, barbeiro: d.profissional,
  data: dataExtenso(d.inicio), hora: d.inicio.slice(11, 16), telefone: d.telefone,
})
