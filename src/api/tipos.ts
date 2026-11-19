/** Tipos compartilhados entre o app e a API. */

export type Servico = { id: string; nome: string; descricao: string; preco: number; duracao: number; destaque: boolean; ativo?: boolean }
export type Profissional = { id: string; nome: string; especialidade: string; foto?: string | null }

export type Barbearia = {
  nome: string
  cidade: string
  endereco: string
  whatsapp: string
  instagram: string
  dono?: { nome: string; foto: string | null } | null
  horarios: Record<number, [string, string] | null>
  fidelidadeMeta: number
  diasAgenda: number
  antecedenciaCancelarMin: number
  whatsappModo: 'demo' | 'evolution' | 'zapi' | 'offline'
  servicos: Servico[]
  profissionais: Profissional[]
}

export type Fidelidade = { selos: number; meta: number; premiosConquistados: number; totalAtendimentos: number }
export type Cliente = { id: string; nome: string; telefone: string; fidelidade: Fidelidade }

export type Status = 'confirmado' | 'concluido' | 'faltou' | 'cancelado'

export type Agendamento = {
  id: string
  servicoId: string
  profissionalId: string
  servico: string
  profissional: string
  inicio: string // "YYYY-MM-DD HH:MM"
  fim: string
  preco: number
  status: Status
}

export type Dia = { data: string; livres: number }

export type UsuarioPainel = { nome: string; email: string; papel: 'dono' | 'barbeiro'; profissionalId: string | null }

export type Resumo = {
  data: string
  hoje: { atendimentos: number; previsto: number; recebido: number }
  mes: { concluidos: number; faltas: number; cancelados: number; faturado: number; taxaFalta: number; percentualApp: number }
  porServico: { nome: string; n: number }[]
  porProfissional: { nome: string; n: number; total: number }[]
  retorno: { id: string; nome: string; telefone: string; dias: number; avisado: boolean; ultimaVisita: string }[]
}

export type ItemAgenda = Agendamento & { origem: 'app' | 'balcao'; cliente: string; telefone: string; visitas: number }
export type Bloqueio = { id: string; inicio: string; fim: string; motivo: string; profissionalId: string; profissional: string }
export type Mensagem = { id: string; telefone: string; tipo: string; texto: string; status: string; erro?: string; criadoEm: string }
export type ClientePainel = { id: string; nome: string; telefone: string; visitas: number; faltas: number; ultimaVisita: string | null }

export interface Api {
  modo: 'servidor' | 'local'
  barbearia(): Promise<Barbearia>
  dias(servicoId: string, profissionalId: string): Promise<Dia[]>
  horarios(data: string, servicoId: string, profissionalId: string): Promise<string[]>

  pedirCodigo(telefone: string): Promise<{ jaCliente: boolean; codigoDemo?: string }>
  verificar(telefone: string, codigo: string, nome?: string): Promise<Cliente>
  eu(): Promise<Cliente | null>
  sair(): void

  meusAgendamentos(): Promise<{ agora: string; agendamentos: Agendamento[] }>
  agendar(d: { servicoId: string; profissionalId: string; data: string; hora: string }): Promise<{ id: string; profissionalId: string; inicio: string }>
  cancelar(id: string): Promise<void>

  painel: {
    logado(): boolean
    entrar(email: string, senha: string): Promise<UsuarioPainel>
    sair(): void
    eu(): Promise<UsuarioPainel>
    resumo(data: string): Promise<Resumo>
    agenda(data: string, profissional?: string): Promise<{ agendamentos: ItemAgenda[]; bloqueios: Bloqueio[] }>
    status(id: string, status: Status): Promise<void>
    encaixe(d: { nome: string; telefone?: string; servicoId: string; profissionalId: string; data: string; hora: string }): Promise<void>
    bloquear(d: { profissionalId: string; data: string; inicio: string; fim: string; motivo: string }): Promise<void>
    desbloquear(id: string): Promise<void>
    clientes(busca: string): Promise<ClientePainel[]>
    mensagens(): Promise<Mensagem[]>
    servicos(): Promise<Servico[]>
    salvarServico(id: string | null, s: Omit<Servico, 'id'>): Promise<void>
  }
}
