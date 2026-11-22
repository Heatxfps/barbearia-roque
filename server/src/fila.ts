/**
 * Fila do dia ("pode adiantar"): quando abre um espaço na agenda de um barbeiro HOJE
 * (alguém desmarcou, faltou ou o barbeiro terminou antes do previsto), o próximo cliente
 * dele recebe no WhatsApp um convite para vir mais cedo.
 *  - um convite por vez por barbeiro; vale 20 min; se não aceitar, passa para o seguinte
 *  - o cliente aceita pelo link (/#adiantar/ID) ou em "Meus horários"
 *  - quem aceita libera o horário antigo → o próximo da fila é convidado (efeito cascata)
 * A lista de espera (dias lotados) continua funcionando à parte, em jobs.ts.
 */
import type { DB } from './db.ts'
import { transacao } from './db.ts'
import { config } from './config.ts'
import { intervaloLivre } from './agenda.ts'
import { agora, carimbo, dataIso, lerCarimbo, somarMin } from './tempo.ts'
import { enviarWhatsApp } from './whatsapp.ts'
import { lerModelo, montar, tempoDe, varsAgendamento } from './mensagens.ts'
import { ErroNegocio, avisarBarbeariaTexto } from './servicos-agendamento.ts'

export const VALIDADE_CONVITE_MIN = 20
const CHEGAR_MIN = 15        // tempo mínimo para o cliente sair de casa e chegar
const JANELA_MIN = 4 * 60    // só convida quem tem horário nas próximas 4 h
const PASSO_MIN = 5

export type Oferta = { agendamentoId: string; cliente: string; de: string; para: string }

type Candidato = { id: string; inicio: string; fim: string; nome: string; telefone: string; servico: string; profissional: string }

const arredondar = (d: Date) => { const r = new Date(d); r.setSeconds(0, 0); r.setMinutes(Math.ceil(r.getMinutes() / PASSO_MIN) * PASSO_MIN); return r }
const duracaoDe = (a: { inicio: string; fim: string }) => Math.round((lerCarimbo(a.fim).getTime() - lerCarimbo(a.inicio).getTime()) / 60000)

/** Abriu espaço na agenda do barbeiro: convida o próximo cliente dele (se houver quem possa adiantar). */
export function oferecerAdiantar(db: DB, profissionalId: string): Oferta | null {
  if (!lerModelo(db, 'adiantar').ativo) return null
  const agoraD = agora()
  if (agoraD.getHours() < 8 || agoraD.getHours() >= 21) return null
  const agoraTxt = carimbo(agoraD)
  // um convite por vez para cada barbeiro
  if (db.prepare("SELECT 1 FROM agendamentos WHERE profissional_id = ? AND status = 'confirmado' AND adiantar_ate > ?").get(profissionalId, agoraTxt)) return null

  const ganho = tempoDe(db, 'adiantar')
  const base = arredondar(somarMin(agoraD, CHEGAR_MIN))
  const candidatos = db.prepare(`SELECT a.id, a.inicio, a.fim, c.nome, c.telefone, s.nome AS servico, p.nome AS profissional
                                 FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                                 WHERE a.profissional_id = ? AND a.status = 'confirmado' AND substr(a.inicio,1,10) = ? AND a.inicio >= ? AND a.inicio <= ?
                                   AND a.adiantar_oferecido = 0 AND c.telefone NOT LIKE 'balcao-%'
                                 ORDER BY a.inicio`)
    .all(profissionalId, dataIso(agoraD), carimbo(somarMin(base, ganho)), carimbo(somarMin(agoraD, JANELA_MIN))) as Candidato[]

  for (const a of candidatos) {
    const dur = duracaoDe(a)
    const limite = carimbo(somarMin(lerCarimbo(a.inicio), -ganho))
    for (let t = base; carimbo(t) <= limite; t = somarMin(t, PASSO_MIN)) {
      const ini = carimbo(t)
      if (!intervaloLivre(db, profissionalId, ini, carimbo(somarMin(t, dur)), a.id)) continue
      db.prepare('UPDATE agendamentos SET adiantar_para = ?, adiantar_ate = ?, adiantar_oferecido = 1 WHERE id = ?')
        .run(ini, carimbo(somarMin(agoraD, VALIDADE_CONVITE_MIN)), a.id)
      const texto = montar(db, 'adiantar', { ...varsAgendamento(a), nova_hora: ini.slice(11, 16), link: `${config.urlApp}/#adiantar/${a.id}` })
      if (texto) void enviarWhatsApp(db, a.telefone, 'adiantar', texto, a.id)
      return { agendamentoId: a.id, cliente: a.nome, de: a.inicio, para: ini }
    }
  }
  return null
}

/** Convites que venceram sem resposta: limpa e passa para o próximo da fila (roda a cada minuto). */
export function vencerConvites(db: DB) {
  const vencidos = db.prepare("SELECT id, profissional_id AS prof FROM agendamentos WHERE adiantar_para IS NOT NULL AND (adiantar_ate <= ? OR status != 'confirmado')")
    .all(carimbo(agora())) as { id: string; prof: string }[]
  for (const v of vencidos) db.prepare('UPDATE agendamentos SET adiantar_para = NULL, adiantar_ate = NULL WHERE id = ?').run(v.id)
  for (const prof of new Set(vencidos.map((v) => v.prof))) oferecerAdiantar(db, prof)
}

type Detalhe = Candidato & { status: string; profissional_id: string; foto: string | null; adiantar_para: string | null; adiantar_ate: string | null }

const detalhe = (db: DB, id: string) => db.prepare(`SELECT a.id, a.inicio, a.fim, a.status, a.profissional_id, a.adiantar_para, a.adiantar_ate,
                                                           c.nome, c.telefone, s.nome AS servico, p.nome AS profissional, p.foto
                                                    FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                                                    WHERE a.id = ?`).get(id) as Detalhe | undefined

/** Dados do convite para a tela do link (o id do agendamento é aleatório, como no link de avaliação) */
export function infoAdiantar(db: DB, id: string) {
  const a = detalhe(db, id)
  if (!a) throw new ErroNegocio('Convite não encontrado', 404)
  const valido = a.status === 'confirmado' && !!a.adiantar_para && !!a.adiantar_ate && a.adiantar_ate > carimbo(agora())
  return { id: a.id, cliente: a.nome.split(' ')[0], servico: a.servico, profissional: a.profissional, foto: a.foto, inicio: a.inicio, para: valido ? a.adiantar_para : null, status: a.status }
}

/** Cliente aceitou: muda o horário, avisa a barbearia e convida o próximo para o horário que ficou livre. */
export function aceitarAdiantar(db: DB, id: string, clienteId?: string) {
  const a = detalhe(db, id)
  if (!a || (clienteId && db.prepare('SELECT 1 FROM agendamentos WHERE id = ? AND cliente_id = ?').get(id, clienteId) === undefined))
    throw new ErroNegocio('Convite não encontrado', 404)
  if (a.status !== 'confirmado' || !a.adiantar_para || !a.adiantar_ate) throw new ErroNegocio('Esse convite não está mais valendo. Seu horário continua o mesmo.', 410)
  if (a.adiantar_ate <= carimbo(agora())) throw new ErroNegocio(`O convite expirou (valia por ${VALIDADE_CONVITE_MIN} minutos). Seu horário continua o mesmo.`, 410)
  const para = a.adiantar_para
  const fim = carimbo(somarMin(lerCarimbo(para), duracaoDe(a)))
  if (!intervaloLivre(db, a.profissional_id, para, fim, a.id)) {
    db.prepare('UPDATE agendamentos SET adiantar_para = NULL, adiantar_ate = NULL WHERE id = ?').run(id)
    throw new ErroNegocio('Alguém pegou esse espaço antes. Seu horário continua o mesmo.', 409)
  }
  transacao(db, () => {
    if (!intervaloLivre(db, a.profissional_id, para, fim, a.id)) throw new ErroNegocio('Alguém pegou esse espaço antes. Seu horário continua o mesmo.', 409)
    // lembretes não fazem mais sentido: ele já sabe que vem agora
    db.prepare('UPDATE agendamentos SET inicio = ?, fim = ?, adiantar_para = NULL, adiantar_ate = NULL, lembrete_24h = 1, lembrete_1h = 1 WHERE id = ?').run(para, fim, id)
  })
  const aviso = montar(db, 'aviso_adiantou', { ...varsAgendamento(a), nome: a.nome, nova_hora: para.slice(11, 16) })
  if (aviso) void avisarBarbeariaTexto(db, 'aviso_adiantou', aviso)
  oferecerAdiantar(db, a.profissional_id) // o horário antigo dele ficou livre
  return { inicio: para, fim }
}
