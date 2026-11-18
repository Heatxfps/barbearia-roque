/** Geração dos horários disponíveis (protótipo). */
import { barbearia, profissionais } from './data'
import type { Agendamento } from './store'

export const PASSO_MIN = 30

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** "YYYY-MM-DDTHH:MM" no horário local, para comparar com data+hora dos agendamentos */
export const agoraChave = () => {
  const d = new Date()
  return `${iso(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function proximosDias(qtd = 14): Date[] {
  const out: Date[] = []
  const d = new Date(); d.setHours(0, 0, 0, 0)
  while (out.length < qtd) {
    if (barbearia.horarios[d.getDay()]) out.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return out
}

// "ocupação" fictícia, mas estável, para o protótipo parecer real
function ocupadoFicticio(chave: string) {
  let h = 0
  for (const c of chave) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 100 < 35
}

export function horariosLivres(data: string, profissionalId: string, agendamentos: Agendamento[]): string[] {
  const [y, m, dd] = data.split('-').map(Number)
  const dia = new Date(y, m - 1, dd)
  const exp = barbearia.horarios[dia.getDay()]
  if (!exp) return []
  const agora = new Date()
  const profs = profissionalId === 'qualquer' ? profissionais.filter((p) => p.id !== 'qualquer').map((p) => p.id) : [profissionalId]
  const out: string[] = []
  for (let min = exp[0] * 60; min < exp[1] * 60; min += PASSO_MIN) {
    const hora = `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
    const quando = new Date(y, m - 1, dd, Math.floor(min / 60), min % 60)
    if (quando.getTime() < agora.getTime() + 30 * 60000) continue
    const algumLivre = profs.some(
      (p) =>
        !ocupadoFicticio(`${data}${p}${hora}`) &&
        !agendamentos.some((a) => a.status === 'confirmado' && a.data === data && a.hora === hora && a.profissionalId === p)
    )
    if (algumLivre) out.push(hora)
  }
  return out
}

export const dataLonga = (data: string) => {
  const [y, m, d] = data.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}
