/**
 * Cálculo de horários livres.
 * Livre = expediente − intervalo − bloqueios − agendamentos ativos,
 * respeitando a DURAÇÃO do serviço (um combo de 70 min ocupa 3 "casas").
 */
import type { DB } from './db.ts'
import { config } from './config.ts'
import { agora, carimbo, deMinutos, lerCarimbo, minutos, somarMin } from './tempo.ts'

type Expediente = { inicio: string; fim: string; intervalo_inicio: string | null; intervalo_fim: string | null }
type Faixa = { inicio: string; fim: string }

const sobrepoe = (a0: string, a1: string, b0: string, b1: string) => a0 < b1 && b0 < a1

export function profissionaisAtivos(db: DB): string[] {
  return (db.prepare('SELECT id FROM profissionais WHERE ativo = 1 ORDER BY ordem').all() as { id: string }[]).map((p) => p.id)
}

/** Horários (HH:MM) em que o profissional consegue começar um serviço de `duracao` minutos na data. */
export function horariosDoProfissional(db: DB, profissionalId: string, data: string, duracao: number, ignorarAgendamento?: string): string[] {
  const dia = lerCarimbo(data).getDay()
  const exp = db.prepare('SELECT inicio, fim, intervalo_inicio, intervalo_fim FROM expediente WHERE profissional_id = ? AND dia = ?')
    .get(profissionalId, dia) as Expediente | undefined
  if (!exp) return []

  const ocupados = [
    ...(db.prepare(`SELECT inicio, fim FROM agendamentos
                    WHERE profissional_id = ? AND status IN ('confirmado','concluido') AND substr(inicio,1,10) = ? AND id != ?`)
      .all(profissionalId, data, ignorarAgendamento ?? '') as Faixa[]),
    ...(db.prepare('SELECT inicio, fim FROM bloqueios WHERE profissional_id = ? AND inicio < ? AND fim > ?')
      .all(profissionalId, `${data} 24:00`, `${data} 00:00`) as Faixa[]),
  ]
  if (exp.intervalo_inicio && exp.intervalo_fim) ocupados.push({ inicio: `${data} ${exp.intervalo_inicio}`, fim: `${data} ${exp.intervalo_fim}` })

  const limite = carimbo(somarMin(agora(), config.regras.antecedenciaAgendarMin))
  const livres: string[] = []
  for (let m = minutos(exp.inicio); m + duracao <= minutos(exp.fim); m += config.regras.passoMin) {
    const ini = `${data} ${deMinutos(m)}`
    const fim = `${data} ${deMinutos(m + duracao)}`
    if (ini < limite) continue
    if (ocupados.some((o) => sobrepoe(ini, fim, o.inicio, o.fim))) continue
    livres.push(deMinutos(m))
  }
  return livres
}

/** Horários livres para um profissional ou para "qualquer" (união de todos). */
export function horariosLivres(db: DB, profissionalId: string, data: string, duracao: number): string[] {
  const ids = profissionalId === 'qualquer' ? profissionaisAtivos(db) : [profissionalId]
  const todos = new Set<string>()
  for (const id of ids) horariosDoProfissional(db, id, data, duracao).forEach((h) => todos.add(h))
  return [...todos].sort()
}

/**
 * Escolhe quem atende quando o cliente não tem preferência:
 * entre os livres no horário, o que tem menos atendimentos no dia.
 */
export function escolherProfissional(db: DB, data: string, hora: string, duracao: number): string | null {
  const candidatos = profissionaisAtivos(db).filter((id) => horariosDoProfissional(db, id, data, duracao).includes(hora))
  if (!candidatos.length) return null
  const carga = (id: string) => (db.prepare(`SELECT COUNT(*) AS n FROM agendamentos WHERE profissional_id = ? AND substr(inicio,1,10) = ? AND status IN ('confirmado','concluido')`)
    .get(id, data) as { n: number }).n
  return candidatos.sort((a, b) => carga(a) - carga(b))[0]
}

export const fimDoServico = (data: string, hora: string, duracao: number) => carimbo(somarMin(lerCarimbo(`${data} ${hora}`), duracao))
