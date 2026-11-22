/**
 * Situação das mensagens automáticas por cliente, para o painel (Clientes):
 *  - lembretes de cada horário dos próximos dias (véspera e em cima da hora)
 *  - "volte a cortar" de quem sumiu
 *  - parabéns/cupom dos aniversariantes
 * Cada item diz se a mensagem já foi (e quando), falhou, está programada (e para quando),
 * não vai (e por quê) ou está desligada.
 */
import type { DB } from './db.ts'
import { lerBarbearia } from './db.ts'
import { agora, carimbo, dataIso, lerCarimbo, somarMin } from './tempo.ts'
import { lerModelo, tempoDe, ultimaMensagem, type Estado } from './mensagens.ts'
import { clientesParaRetorno } from './jobs.ts'

const semWhats = (tel: string) => tel.startsWith('balcao-')

/** Próxima janela em que um job "de horário comercial" roda (ex.: das 10h às 19h) */
function proximaJanela(de: number, ate: number, base = agora()) {
  const d = new Date(base); d.setSeconds(0, 0)
  if (d.getHours() >= ate) { d.setDate(d.getDate() + 1); d.setHours(de, 0) } else if (d.getHours() < de) d.setHours(de, 0)
  return carimbo(d)
}

type Ag = { id: string; inicio: string; criado_em: string; lembrete_24h: number; lembrete_1h: number; telefone: string }

function estadoLembrete(db: DB, a: Ag, chave: 'lembrete_24h' | 'lembrete_1h'): Estado {
  if (semWhats(a.telefone)) return { estado: 'sem_whatsapp' }
  const m = ultimaMensagem(db, [chave], { ref: a.id })
  if (m) return m
  const h1 = tempoDe(db, 'lembrete_1h') * 60
  const min = chave === 'lembrete_1h' ? h1 : Math.max(tempoDe(db, 'lembrete_24h') * 60, h1 + 60)
  const quando = carimbo(somarMin(lerCarimbo(a.inicio), -min))
  const emCima = a.criado_em > (chave === 'lembrete_1h' ? carimbo(somarMin(lerCarimbo(a.inicio), -(min + 30))) : quando)
  if (emCima) return { estado: 'nao_vai', motivo: chave === 'lembrete_1h' ? 'marcou em cima da hora' : 'marcou com pouca antecedência' }
  if (chave === 'lembrete_24h' ? a.lembrete_24h : a.lembrete_1h) return { estado: 'nao_vai', motivo: 'estava desligado na hora' }
  if (!lerModelo(db, chave).ativo) return { estado: 'desligada' }
  const agoraTxt = carimbo(agora())
  return { estado: 'programada', quando: quando < agoraTxt ? agoraTxt : quando }
}

/** Horários confirmados de agora até `dias` dias, com a situação de cada lembrete */
export function lembretes(db: DB, dias = 7) {
  const agoraTxt = carimbo(agora())
  const lista = db.prepare(`SELECT a.id, a.inicio, a.criado_em, a.lembrete_24h, a.lembrete_1h, a.adiantar_para AS adiantarPara, a.adiantar_ate AS adiantarAte,
                                   c.nome AS cliente, c.telefone, s.nome AS servico, p.nome AS profissional
                            FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                            WHERE a.status = 'confirmado' AND a.inicio > ? AND a.inicio <= ? ORDER BY a.inicio`)
    .all(agoraTxt, carimbo(somarMin(agora(), dias * 1440))) as (Ag & { cliente: string; servico: string; profissional: string; adiantarPara: string | null; adiantarAte: string | null })[]
  return lista.map((a) => ({
    id: a.id, inicio: a.inicio, cliente: a.cliente, telefone: a.telefone, servico: a.servico, profissional: a.profissional,
    semWhatsapp: semWhats(a.telefone),
    adiantarPara: a.adiantarPara && a.adiantarAte && a.adiantarAte > agoraTxt ? a.adiantarPara : null,
    lembretes: [
      { chave: 'lembrete_24h', nome: 'Véspera', ...estadoLembrete(db, a, 'lembrete_24h') },
      { chave: 'lembrete_1h', nome: 'Em cima da hora', ...estadoLembrete(db, a, 'lembrete_1h') },
    ],
    manual: ultimaMensagem(db, ['lembrete_manual'], { ref: a.id }),
  }))
}

/** "Chamar de volta" com a situação da mensagem "volte a cortar" */
export function retornoComEstado(db: DB) {
  const ligado = lerModelo(db, 'retorno').ativo
  return clientesParaRetorno(db).slice(0, 50).map((c) => {
    let estado: Estado
    if (c.avisado) estado = ultimaMensagem(db, ['retorno'], { ref: c.id, telefone: c.telefone, desde: c.ultimaVisita }) ?? { estado: 'nao_vai', motivo: 'estava desligada na hora' }
    else if (!ligado) estado = { estado: 'desligada' }
    else estado = { estado: 'programada', quando: proximaJanela(10, 19) }
    // só conta a mensagem se for depois da última visita
    if ((estado.estado === 'enviada' || estado.estado === 'falhou') && estado.quando < c.ultimaVisita) estado = ligado ? { estado: 'programada', quando: proximaJanela(10, 19) } : { estado: 'desligada' }
    return { ...c, estado }
  })
}

/** Aniversariantes de 3 dias atrás até 7 dias para a frente, com a situação do parabéns e do cupom */
export function aniversariantes(db: DB) {
  const hoje = agora(); hoje.setHours(0, 0, 0, 0)
  const dias = Array.from({ length: 11 }, (_, i) => { const d = new Date(hoje); d.setDate(d.getDate() + i - 3); return d })
  const mmdd = dias.map((d) => dataIso(d).slice(5))
  const lista = db.prepare(`SELECT id, nome, telefone, aniversario, aniversario_ano FROM clientes WHERE aniversario IN (${mmdd.map(() => '?').join(',')})`).all(...mmdd) as
    { id: string; nome: string; telefone: string; aniversario: string; aniversario_ano: number | null }[]
  const b = lerBarbearia(db)
  const pct = Number(b.desconto_aniversario ?? 15)
  const ligado = lerModelo(db, 'aniversario').ativo && pct > 0
  const agoraTxt = carimbo(agora())
  return lista.map((c) => {
    const i = mmdd.indexOf(c.aniversario)
    const dia = dias[i]
    const emDias = i - 3
    const ano = dia.getFullYear()
    let estado: Estado
    let cupom: { status: 'usado' | 'ativo' | 'vencido'; validoAte: string; desconto: number } | null = null
    if (semWhats(c.telefone)) estado = { estado: 'sem_whatsapp' }
    else if ((c.aniversario_ano ?? 0) >= ano) {
      estado = ultimaMensagem(db, ['aniversario'], { ref: c.id, telefone: c.telefone, desde: `${ano}-01-01` }) ?? { estado: 'nao_vai', motivo: 'estava desligada na hora' }
      const u = db.prepare("SELECT agendamento_id, valido_ate, desconto_pct FROM cupons WHERE cliente_id = ? AND motivo = 'aniversario' AND substr(criado_em,1,4) = ? ORDER BY criado_em DESC LIMIT 1")
        .get(c.id, String(ano)) as { agendamento_id: string | null; valido_ate: string; desconto_pct: number } | undefined
      if (u) cupom = { status: u.agendamento_id ? 'usado' : u.valido_ate < dataIso(agora()) ? 'vencido' : 'ativo', validoAte: u.valido_ate, desconto: u.desconto_pct }
    } else if (emDias < 0) estado = { estado: 'nao_vai', motivo: 'o aniversário já passou' }
    else if (!ligado) estado = { estado: 'desligada' }
    else {
      const q = new Date(dia); q.setHours(9, 0, 0, 0)
      const quando = carimbo(q)
      estado = quando >= agoraTxt ? { estado: 'programada', quando }
        : agora().getHours() >= 20 ? { estado: 'nao_vai', motivo: 'o cadastro chegou depois das 20h' } : { estado: 'programada', quando: agoraTxt }
    }
    return { id: c.id, nome: c.nome, telefone: c.telefone, aniversario: c.aniversario, emDias, estado, cupom }
  }).sort((a, b) => a.emDias - b.emDias)
}
