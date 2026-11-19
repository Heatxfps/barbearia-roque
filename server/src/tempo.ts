/**
 * Datas e horas da barbearia, sempre no horário LOCAL do servidor
 * (no Docker: TZ=America/Sao_Paulo). Formato gravado no banco: "YYYY-MM-DD HH:MM",
 * que ordena e compara certo como texto.
 */

const p2 = (n: number) => String(n).padStart(2, '0')

export const dataIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const horaTxt = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`
export const carimbo = (d: Date) => `${dataIso(d)} ${horaTxt(d)}`

export function lerCarimbo(s: string): Date {
  const [data, hora = '00:00'] = s.split(/[ T]/)
  const [y, m, d] = data.split('-').map(Number)
  const [h, mi] = hora.split(':').map(Number)
  return new Date(y, m - 1, d, h, mi)
}

export const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
export const deMinutos = (min: number) => `${p2(Math.floor(min / 60))}:${p2(min % 60)}`

export const somarMin = (d: Date, min: number) => new Date(d.getTime() + min * 60000)

/** "agora" substituível nos testes */
let relogio = () => new Date()
export const agora = () => relogio()
export const definirRelogio = (fn: () => Date) => { relogio = fn }

export const dataValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(lerCarimbo(s).getTime())
export const horaValida = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s)

export function dataExtenso(c: string) {
  return lerCarimbo(c).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

/** Normaliza telefone brasileiro para o formato do WhatsApp: 55 + DDD + número */
export function normalizarTelefone(t: string): string | null {
  let d = t.replace(/\D/g, '')
  if (d.length === 10 || d.length === 11) d = '55' + d
  if (!/^55\d{10,11}$/.test(d)) return null
  return d
}
