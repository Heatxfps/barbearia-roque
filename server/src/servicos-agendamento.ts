/** Regras de negócio de agendamento usadas pelo cliente e pelo painel. */
import type { DB } from './db.ts'
import { lerBarbearia, novoId, transacao } from './db.ts'
import { escolherProfissional, fimDoServico, horariosDoProfissional } from './agenda.ts'
import { config } from './config.ts'
import { agora, carimbo, dataIso, somarMin } from './tempo.ts'
import { enviarWhatsApp, type TipoMensagem } from './whatsapp.ts'
import { textos } from './textos.ts'

export class ErroNegocio extends Error {
  status: number
  constructor(msg: string, status = 400) { super(msg); this.status = status }
}

type Servico = { id: string; nome: string; preco: number; duracao: number }

export function buscarServico(db: DB, id: string): Servico {
  const s = db.prepare('SELECT id, nome, preco, duracao FROM servicos WHERE id = ? AND ativo = 1').get(id) as Servico | undefined
  if (!s) throw new ErroNegocio('Serviço não encontrado', 404)
  return s
}

export function criarAgendamento(db: DB, dados: {
  clienteId: string; servicoId: string; profissionalId: string; data: string; hora: string; origem: 'app' | 'balcao'
}) {
  const servico = buscarServico(db, dados.servicoId)
  const id = novoId()
  const r = transacao(db, () => {
    let prof = dados.profissionalId
    if (prof === 'qualquer') {
      const escolhido = escolherProfissional(db, dados.data, dados.hora, servico.duracao)
      if (!escolhido) throw new ErroNegocio('Esse horário acabou de ser ocupado. Escolha outro.', 409)
      prof = escolhido
    } else {
      const existe = db.prepare('SELECT 1 FROM profissionais WHERE id = ? AND ativo = 1').get(prof)
      if (!existe) throw new ErroNegocio('Profissional não encontrado', 404)
      // reconfere dentro da transação: evita dois clientes no mesmo horário
      if (!horariosDoProfissional(db, prof, dados.data, servico.duracao).includes(dados.hora))
        throw new ErroNegocio('Esse horário acabou de ser ocupado. Escolha outro.', 409)
    }
    const inicio = `${dados.data} ${dados.hora}`
    // cupom (aniversário) entra sozinho, se o horário cair dentro da validade
    const cupom = cupomAtivo(db, dados.clienteId, dados.data)
    const desconto = cupom ? Math.round(servico.preco * cupom.desconto_pct) / 100 : 0
    db.prepare(`INSERT INTO agendamentos (id, cliente_id, profissional_id, servico_id, inicio, fim, preco, desconto, origem, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, dados.clienteId, prof, servico.id, inicio, fimDoServico(dados.data, dados.hora, servico.duracao), servico.preco - desconto, desconto, dados.origem, carimbo(agora()))
    if (cupom) db.prepare('UPDATE cupons SET agendamento_id = ? WHERE id = ?').run(id, cupom.id)
    // conseguiu horário nesse dia: sai da lista de espera dele
    db.prepare('DELETE FROM espera WHERE cliente_id = ? AND data = ?').run(dados.clienteId, dados.data)
    return { id, profissionalId: prof, inicio, desconto }
  })
  if (dados.origem === 'app') {
    void notificar(db, id, 'confirmacao')
    void avisarBarbearia(db, id, 'novo')
  }
  return r
}

export function cancelarAgendamento(db: DB, id: string, porCliente?: string) {
  const a = db.prepare('SELECT id, cliente_id, inicio, status FROM agendamentos WHERE id = ?').get(id) as
    { id: string; cliente_id: string; inicio: string; status: string } | undefined
  if (!a || (porCliente && a.cliente_id !== porCliente)) throw new ErroNegocio('Agendamento não encontrado', 404)
  if (a.status !== 'confirmado') throw new ErroNegocio('Esse agendamento não pode mais ser cancelado')
  if (porCliente) {
    const limite = carimbo(somarMin(agora(), config.regras.antecedenciaCancelarMin))
    if (a.inicio < limite) {
      const h = config.regras.antecedenciaCancelarMin / 60
      throw new ErroNegocio(`Cancelamentos pelo app só até ${h}h antes. Fale com a barbearia pelo WhatsApp.`)
    }
  }
  db.prepare("UPDATE agendamentos SET status = 'cancelado' WHERE id = ?").run(id)
  // o cupom usado nesse horário volta a valer
  db.prepare('UPDATE cupons SET agendamento_id = NULL WHERE agendamento_id = ?').run(id)
  void notificar(db, id, 'cancelamento')
  if (porCliente) void avisarBarbearia(db, id, 'cancelou')
}

type Detalhe = { telefone: string; nome: string; servico: string; profissional: string; inicio: string }

export function detalhe(db: DB, id: string): Detalhe | undefined {
  return db.prepare(`SELECT c.telefone, c.nome, s.nome AS servico, p.nome AS profissional, a.inicio
                     FROM agendamentos a JOIN clientes c ON c.id = a.cliente_id
                     JOIN servicos s ON s.id = a.servico_id JOIN profissionais p ON p.id = a.profissional_id
                     WHERE a.id = ?`).get(id) as Detalhe | undefined
}

export async function notificar(db: DB, id: string, tipo: 'confirmacao' | 'cancelamento' | 'lembrete_24h' | 'lembrete_1h') {
  const d = detalhe(db, id)
  if (!d) return
  const b = lerBarbearia(db)
  const info = { ...d, barbearia: b.nome, endereco: b.endereco }
  const texto = tipo === 'confirmacao' ? textos.confirmacao(info)
    : tipo === 'cancelamento' ? textos.cancelamento(info)
    : tipo === 'lembrete_24h' ? textos.lembrete24h(info)
    : textos.lembrete1h(info)
  await enviarWhatsApp(db, d.telefone, tipo, texto)
}

/** Avisa o WhatsApp da própria barbearia quando o cliente marca ou cancela pelo app,
 *  para quem está no balcão saber na hora (desligue com AVISAR_BARBEARIA=0). */
export async function avisarBarbearia(db: DB, id: string, tipo: 'novo' | 'cancelou') {
  const d = detalhe(db, id)
  if (!d) return
  const info = { ...d, barbearia: lerBarbearia(db).nome }
  await avisarBarbeariaTexto(db, tipo === 'novo' ? 'aviso_novo' : 'aviso_cancelou', tipo === 'novo' ? textos.avisoNovo(info) : textos.avisoCancelou(info))
}

/** Manda um texto para o WhatsApp da própria barbearia (se o número estiver configurado). */
export async function avisarBarbeariaTexto(db: DB, tipo: TipoMensagem, texto: string) {
  if (!config.avisarBarbearia) return
  const destino = (lerBarbearia(db).whatsapp ?? '').replace(/\D/g, '')
  if (destino.length < 12) return
  await enviarWhatsApp(db, destino, tipo, texto)
}

export type Cupom = { id: string; motivo: string; desconto_pct: number; valido_ate: string }

/** Cupom ainda não usado e válido para um horário na data informada (padrão: hoje). */
export function cupomAtivo(db: DB, clienteId: string, data = dataIso(agora())): Cupom | undefined {
  return db.prepare(`SELECT id, motivo, desconto_pct, valido_ate FROM cupons
                     WHERE cliente_id = ? AND agendamento_id IS NULL AND valido_ate >= ? AND substr(criado_em,1,10) <= ?
                     ORDER BY desconto_pct DESC LIMIT 1`).get(clienteId, data, data) as Cupom | undefined
}

/** Selos do cartão fidelidade = atendimentos concluídos (o ciclo recomeça a cada meta). */
export function fidelidade(db: DB, clienteId: string) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE cliente_id = ? AND status = 'concluido'").get(clienteId) as { n: number }
  const meta = config.regras.fidelidadeMeta
  return { selos: n % meta, meta, premiosConquistados: Math.floor(n / meta), totalAtendimentos: n }
}
