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
  googleAvaliacao?: string
  descontoAniversario?: number
  horarios: Record<number, [string, string] | null>
  fidelidadeMeta: number
  diasAgenda: number
  antecedenciaCancelarMin: number
  whatsappModo: 'demo' | 'evolution' | 'zapi' | 'offline'
  servicos: Servico[]
  profissionais: Profissional[]
}

export type Fidelidade = { selos: number; meta: number; premiosConquistados: number; totalAtendimentos: number }
export type Cupom = { motivo: string; desconto: number; validoAte: string }
export type Cliente = { id: string; nome: string; telefone: string; fidelidade: Fidelidade; aniversario?: string | null; cupom?: Cupom | null }

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
  desconto?: number
  avaliacao?: number | null
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
export type Produto = { id: string; nome: string; descricao: string; preco: number; foto?: string | null; ativo?: boolean }
export type ItemPedido = { nome: string; preco: number; qtd: number }
export type StatusPedido = 'novo' | 'separado' | 'retirado' | 'cancelado'
export type Pedido = { id: string; status: StatusPedido; total: number; criadoEm: string; itens: ItemPedido[] }
export type PedidoPainel = Pedido & { cliente: string; telefone: string; observacao: string }
export type Espera = { id: string; data: string; servicoId: string; servico: string; profissionalId: string; profissional: string; avisadoEm: string | null }
export type EsperaPainel = { id: string; cliente: string; telefone: string; servico: string; profissionalId: string; profissional: string; criadoEm: string; avisadoEm: string | null }
export type AvaliacaoInfo = { id: string; inicio: string; servico: string; profissional: string; foto: string | null; cliente: string; nota: number | null; comentario: string | null; googleAvaliacao: string }
export type ResumoAvaliacoes = {
  media: number; total: number
  porProfissional: { id: string; nome: string; foto: string | null; media: number; n: number }[]
  recentes: { id: string; nota: number; comentario: string; criadoEm: string; cliente: string; profissional: string }[]
}
export type UsuarioLista = { id: string; nome: string; email: string; papel: 'dono' | 'barbeiro'; profissionalId: string | null }
export type Expediente = { dia: number; inicio: string; fim: string; intervaloInicio: string | null; intervaloFim: string | null }
export type ProfissionalPainel = Profissional & { ativo: boolean; expediente: Expediente[] }
export type DadosBarbearia = { nome: string; cidade: string; endereco: string; whatsapp: string; instagram: string; dono: string; google_avaliacao: string; desconto_aniversario: number }
export type NovoProfissional = { nome: string; especialidade: string; ativo: boolean; foto?: string | null; expediente?: Expediente[] }
export type ClientePainel = { id: string; nome: string; telefone: string; visitas: number; faltas: number; ultimaVisita: string | null }

export interface Api {
  modo: 'servidor' | 'local'
  barbearia(): Promise<Barbearia>
  dias(servicoId: string, profissionalId: string): Promise<Dia[]>
  horarios(data: string, servicoId: string, profissionalId: string): Promise<string[]>

  pedirCodigo(telefone: string): Promise<{ jaCliente: boolean; codigoDemo?: string }>
  verificar(telefone: string, codigo: string, nome?: string, aniversario?: string): Promise<Cliente>
  eu(): Promise<Cliente | null>
  sair(): void
  atualizarPerfil(d: { nome?: string; aniversario?: string | null }): Promise<void>

  meusAgendamentos(): Promise<{ agora: string; agendamentos: Agendamento[] }>
  agendar(d: { servicoId: string; profissionalId: string; data: string; hora: string }): Promise<{ id: string; profissionalId: string; inicio: string }>
  cancelar(id: string): Promise<void>

  minhaEspera(): Promise<Espera[]>
  entrarEspera(d: { servicoId: string; profissionalId: string; data: string }): Promise<{ posicao: number }>
  sairEspera(id: string): Promise<void>

  produtos(): Promise<Produto[]>
  pedir(itens: { produtoId: string; qtd: number }[], observacao?: string): Promise<{ id: string; total: number }>
  meusPedidos(): Promise<Pedido[]>
  cancelarPedido(id: string): Promise<void>

  avaliacao(id: string): Promise<AvaliacaoInfo>
  avaliar(id: string, nota: number, comentario: string): Promise<void>

  painel: {
    logado(): boolean
    entrar(email: string, senha: string): Promise<UsuarioPainel>
    sair(): void
    eu(): Promise<UsuarioPainel>
    resumo(data: string): Promise<Resumo>
    agenda(data: string, profissional?: string): Promise<{ agendamentos: ItemAgenda[]; bloqueios: Bloqueio[]; espera?: EsperaPainel[] }>
    removerEspera(id: string): Promise<void>
    avaliacoes(): Promise<ResumoAvaliacoes>
    pedidos(todos?: boolean): Promise<PedidoPainel[]>
    statusPedido(id: string, status: StatusPedido): Promise<void>
    status(id: string, status: Status): Promise<void>
    encaixe(d: { nome: string; telefone?: string; servicoId: string; profissionalId: string; data: string; hora: string }): Promise<void>
    bloquear(d: { profissionalId: string; data: string; inicio: string; fim: string; motivo: string }): Promise<void>
    desbloquear(id: string): Promise<void>
    clientes(busca: string): Promise<ClientePainel[]>
    mensagens(): Promise<Mensagem[]>
    servicos(): Promise<Servico[]>
    salvarServico(id: string | null, s: Omit<Servico, 'id'>): Promise<void>
    // só o dono
    salvarBarbearia(d: Partial<DadosBarbearia>): Promise<void>
    profissionais(): Promise<ProfissionalPainel[]>
    salvarProfissional(id: string, p: NovoProfissional): Promise<void>
    criarProfissional(p: NovoProfissional): Promise<void>
    removerProfissional(id: string): Promise<void>
    enviarFoto(dataUrl: string): Promise<string>
    produtosPainel(): Promise<Produto[]>
    salvarProduto(id: string | null, p: Omit<Produto, 'id'>): Promise<void>
    removerProduto(id: string): Promise<void>
    usuarios(): Promise<UsuarioLista[]>
    criarUsuario(d: { nome: string; email: string; senha: string; profissionalId: string }): Promise<void>
    removerUsuario(id: string): Promise<void>
    trocarSenha(atual: string, nova: string): Promise<void>
  }
}
