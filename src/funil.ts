/**
 * Funil do lado do app: cada visita tem um id (guardado no aparelho) e avisa o servidor a cada passo.
 * Uma visita dura enquanto a pessoa mexe no app; 30 min parado ou agendou = próxima abertura é outra visita.
 * A origem vem do link (?o=instagram, ?o=qr…) ou do site de onde a pessoa veio.
 */
import { api } from './api'

const CHAVE = 'roque-visita'
const PAUSA = 30 * 60_000
type Guardada = { id: string; em: number; origem: string; etapa: number }

const novoId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, '0')).join('')
const ler = (): Guardada | null => { try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') } catch { return null } }
const gravar = (v: Guardada | null) => { try { v ? localStorage.setItem(CHAVE, JSON.stringify(v)) : localStorage.removeItem(CHAVE) } catch { /* modo privado */ } }

function origemDaEntrada(): string {
  const q = new URLSearchParams(location.search).get('o')
  if (q) return q
  const ref = document.referrer
  if (!ref || ref.startsWith(location.origin)) return 'direto'
  if (/instagram\./.test(ref)) return 'instagram'
  if (/facebook\.|fb\./.test(ref)) return 'facebook'
  if (/google\./.test(ref)) return 'google'
  if (/whatsapp|wa\.me/.test(ref)) return 'whatsapp'
  return 'site'
}

let atual: Guardada | null = null

/** Começa (ou continua) a visita. `retomar`: id da visita do link "faltou terminar" */
export function iniciarVisita(retomar?: string) {
  const g = ler()
  if (retomar) atual = { id: retomar, em: Date.now(), origem: g?.origem ?? 'direto', etapa: 0 }
  else if (g && Date.now() - g.em < PAUSA) atual = g
  else {
    atual = { id: novoId(), em: Date.now(), origem: origemDaEntrada(), etapa: 0 }
    void api.funil({ visita: atual.id, origem: atual.origem, etapa: 0 })
  }
  gravar(atual)
  // tira o ?o= do endereço (não vai junto se a pessoa compartilhar o link)
  if (location.search.includes('o=')) history.replaceState(null, '', location.pathname + location.hash)
}

/** Passo do agendamento (1 serviço · 2 barbeiro · 3 horário · 4 confirmar) */
export function passo(etapa: number, dados: { servicoId?: string; profissionalId?: string; data?: string; hora?: string } = {}) {
  if (!atual) iniciarVisita()
  atual = { ...atual!, em: Date.now(), etapa: Math.max(atual!.etapa, etapa) }
  gravar(atual)
  void api.funil({ visita: atual.id, etapa, ...dados })
}

/** id para mandar junto com o agendamento */
export const visitaAtual = () => atual?.id

/** Agendou: a próxima abertura é outra visita */
export function encerrarVisita() { atual = null; gravar(null) }
