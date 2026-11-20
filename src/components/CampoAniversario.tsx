/** Dia e mês do aniversário (sem ano: só serve para o cupom). Valor no formato "MM-DD" ou "" */
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const p2 = (n: number) => String(n).padStart(2, '0')

export default function CampoAniversario({ valor, mudar, rotulo = 'Aniversário (opcional)' }: { valor: string; mudar: (v: string) => void; rotulo?: string }) {
  const [mes, dia] = valor ? [valor.slice(0, 2), valor.slice(3, 5)] : ['', '']
  const atualizar = (m: string, d: string) => {
    if (!m || !d) return mudar(m || d ? `${m || '00'}-${d || '00'}` : '')
    const max = new Date(2000, Number(m), 0).getDate()   // 2000: aceita 29/02
    mudar(`${m}-${p2(Math.min(Number(d), max))}`)
  }
  return (
    <div className="campo">
      <span>{rotulo}</span>
      <div className="campos-2">
        <select value={dia} onChange={(e) => atualizar(mes, e.target.value)} aria-label="Dia">
          <option value="">Dia</option>
          {Array.from({ length: 31 }, (_, i) => <option key={i} value={p2(i + 1)}>{i + 1}</option>)}
        </select>
        <select value={mes} onChange={(e) => atualizar(e.target.value, dia)} aria-label="Mês">
          <option value="">Mês</option>
          {MESES.map((m, i) => <option key={m} value={p2(i + 1)}>{m}</option>)}
        </select>
      </div>
    </div>
  )
}

/** "MM-DD" completo? */
export const aniversarioOk = (v: string) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v)
