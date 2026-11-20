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

/** Foto: as da equipe original ficam em public/img/equipe (retrato 3:4 ou avatar);
 *  as enviadas pelo painel chegam como endereço ("/fotos/abc.jpg") e servem para os dois usos. */
export const foto = (nome: string, tipo: 'retrato' | 'avatar' = 'retrato') =>
  /^(\/|https?:)/.test(nome) ? nome : `${import.meta.env.BASE_URL}img/equipe/${nome}${tipo === 'avatar' ? '-avatar' : ''}.jpg`

/** Reduz a foto escolhida no celular (até 900 px, JPEG) antes de enviar */
export function lerImagem(arquivo: File, max = 900): Promise<string> {
  return new Promise((ok, falha) => {
    const img = new Image()
    const url = URL.createObjectURL(arquivo)
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      ok(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); falha(new Error('Não deu para abrir essa imagem')) }
    img.src = url
  })
}

/** "03-25" → "25/03" */
export const aniversarioTxt = (mmdd: string) => `${mmdd.slice(3, 5)}/${mmdd.slice(0, 2)}`

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]
