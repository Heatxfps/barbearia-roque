/** Regras de negócio de agendamento usadas pelo cliente e pelo painel. */
import type { DB } from './db.ts'
import { lerBarbearia, novoId, transacao } from './db.ts'
import { escolherProfissional, fimDoServico, horariosDoProfissional } from './agenda.ts'
import { config } from './config.ts'
import { agora, carimbo, somarMin } from './tempo.ts'
import { enviarWhatsApp } from './whatsapp.ts'
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
    db.prepare(`INSERT INTO agendamentos (id, cliente_id, profissional_id, servico_id, inicio, fim, preco, origem, criado_em)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, dados.clienteId, prof, servico.id, inicio, fimDoServico(dados.data, dados.hora, servico.duracao), servico.preco, dados.origem, carimbo(agora()))
    return { id, profissionalId: prof, inicio }
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
  if (!config.avisarBarbearia) return
  const d = detalhe(db, id)
  const b = lerBarbearia(db)
  const destino = (b.whatsapp ?? '').replace(/\D/g, '')
  if (!d || destino.length < 12) return
  const info = { ...d, barbearia: b.nome }
  await enviarWhatsApp(db, destino, tipo === 'novo' ? 'aviso_novo' : 'aviso_cancelou', tipo === 'novo' ? textos.avisoNovo(info) : textos.avisoCancelou(info))
}

/** Selos do cartão fidelidade = atendimentos concluídos (o ciclo recomeça a cada meta). */
export function fidelidade(db: DB, clienteId: string) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM agendamentos WHERE cliente_id = ? AND status = 'concluido'").get(clienteId) as { n: number }
  const meta = config.regras.fidelidadeMeta
  return { selos: n % meta, meta, premiosConquistados: Math.floor(n / meta), totalAtendimentos: n }
}
