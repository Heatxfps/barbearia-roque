export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

const p2 = (n: number) => String(n).padStart(2, '0')
export const dataIso = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const lerData = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d) }

/** "quinta-feira, 19 de novembro" */
export const dataLonga = (s: string) => lerData(s).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
export const dataCurta = (s: string) => lerData(s).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
export const hora = (carimbo: string) => carimbo.slice(11, 16)

export const formatarTelefone = (t: string) => {
  const d = t.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return t
}

export const linkWhats = (tel: string, texto?: string) => `https://wa.me/${tel.replace(/\D/g, '')}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`
