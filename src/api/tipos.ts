/** Tipos compartilhados entre o app e a API. */
import type { Gatilho, ModeloPadrao } from '../../shared/modelos'

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
  /** endereço público do app do cliente (o painel fica em outro endereço) */
  urlApp?: string
  descontoAniversario?: number
  validadeAniversario?: number
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
  /** convite "pode adiantar" valendo: novo início oferecido */
  adiantarPara?: string | null
}

export type Dia = { data: string; livres: number }

export type UsuarioPainel = { nome: string; email: string; papel: 'dono' | 'barbeiro'; profissionalId: string | null; trocarSenha?: boolean; verificacaoWhatsApp?: boolean }
/** login do painel: entra direto, ou (dono com WhatsApp cadastrado) pede o código */
export type ResultadoLogin = { usuario: UsuarioPainel } | { etapa: 'codigo'; desafio: string; destino: string; codigoDemo?: string }
/** Situação de uma mensagem automática (Clientes → lembretes, chamar de volta, aniversários) */
export type EstadoMsg =
  | { estado: 'enviada' | 'falhou'; quando: string; erro?: string | null; tipo?: string }
  | { estado: 'programada'; quando: string }
  | { estado: 'nao_vai' | 'desligada' | 'sem_whatsapp'; motivo?: string }
export type Retorno = { id: string; nome: string; telefone: string; dias: number; avisado: boolean; ultimaVisita: string; barbeiro?: string | null; estado?: EstadoMsg }
export type Aniversariante = {
  id: string; nome: string; telefone: string; aniversario: string; emDias: number
  estado?: EstadoMsg; cupom?: { status: 'usado' | 'ativo' | 'vencido'; validoAte: string; desconto: number } | null
}
export type ItemLembrete = {
  id: string; inicio: string; cliente: string; telefone: string; servico: string; profissional: string
  semWhatsapp: boolean; adiantarPara: string | null
  lembretes: ({ chave: string; nome: string } & EstadoMsg)[]
  manual: EstadoMsg | null
}
/** convite "pode adiantar" enviado ao próximo cliente */
export type Oferta = { agendamentoId: string; cliente: string; de: string; para: string }
export type ConviteAdiantar = { id: string; cliente: string; servico: string; profissional: string; foto: string | null; inicio: string; para: string | null; status: Status }

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
export type Mensagem = { id: string; telefone: string; tipo: string; texto: string; status: string; erro?: string; criadoEm: string; ref?: string }
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
  distribuicao?: { nota: number; n: number }[]
}
export type UsuarioLista = { id: string; nome: string; email: string; papel: 'dono' | 'barbeiro'; profissionalId: string | null }
export type Expediente = { dia: number; inicio: string; fim: string; intervaloInicio: string | null; intervaloFim: string | null }
export type ProfissionalPainel = Profissional & { ativo: boolean; expediente: Expediente[] }
export type DadosBarbearia = { nome: string; cidade: string; endereco: string; whatsapp: string; instagram: string; dono: string; google_avaliacao: string; desconto_aniversario: number; validade_aniversario: number }
export type ModeloMsg = ModeloPadrao & { padrao: string; ativo: boolean; valor: number | null; personalizado: boolean }
export type Automacao = { id: string; nome: string; gatilho: Gatilho; valor: number; texto: string; ativo: boolean }
export type NovoProfissional = { nome: string; especialidade: string; ativo: boolean; foto?: string | null; expediente?: Expediente[] }
export type ClientePainel = { id: string; nome: string; telefone: string; visitas: number; faltas: number; ultimaVisita: string | null }

/** Funil (5 A's): um passo da visita ao app. etapa 0 abriu · 1 serviço · 2 barbeiro · 3 horário · 4 confirmar */
export type PassoFunil = { visita: string; origem?: string; etapa: number; servicoId?: string; profissionalId?: string; data?: string; hora?: string }
export type Retomada = { servicoId: string | null; profissionalId: string | null; data: string | null; hora: string | null; livre: boolean; jaAgendou: boolean }
export type EstadoParado = 'aguardando' | 'enviada' | 'recuperado' | 'nao_voltou' | 'voltou_sozinho'
export type Funil = {
  dias: number; agora: string
  etapas: { chegou: number; atracao: number; arguicao: number; acao: number; apologia: number; atendidos: number }
  origens: { origem: string; visitas: number; agendaram: number }[]
  saidas: { etapa: string; n: number }[]
  aoVivo: { id: string; origem: string; etapa: number; quando: string; nome: string | null; servico: string | null }[]
  parados: { id: string; nome: string; telefone: string; origem: string; parouEm: string; servico: string | null; profissional: string | null
    data: string | null; hora: string | null; quando: string; estado: EstadoParado; enviadaEm: string | null; mensagemEm: string | null }[]
  retomada: { enviadas: number; recuperados: number; anonimos: number; esperaMin: number }
}

export interface Api {
  modo: 'servidor' | 'local'
  barbearia(): Promise<Barbearia>
  dias(servicoId: string, profissionalId: string): Promise<Dia[]>
  horarios(data: string, servicoId: string, profissionalId: string): Promise<string[]>

  pedirCodigo(telefone: string): Promise<{ codigoDemo?: string }>
  /** código certo: entra; se for a 1ª vez e sem nome, devolve { novo: true } para o app pedir o nome */
  verificar(telefone: string, codigo: string, nome?: string, aniversario?: string): Promise<Cliente | { novo: true }>
  meusDados(): Promise<unknown>
  excluirConta(): Promise<void>
  eu(): Promise<Cliente | null>
  sair(): void
  atualizarPerfil(d: { nome?: string; aniversario?: string | null }): Promise<void>

  meusAgendamentos(): Promise<{ agora: string; agendamentos: Agendamento[] }>
  funil(p: PassoFunil): Promise<void>
  retomar(id: string): Promise<Retomada>
  agendar(d: { servicoId: string; profissionalId: string; data: string; hora: string; visita?: string }): Promise<{ id: string; profissionalId: string; inicio: string }>
  cancelar(id: string, remarcar?: boolean): Promise<void>
  convite(id: string): Promise<ConviteAdiantar>
  adiantar(id: string): Promise<{ inicio: string }>

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
    entrar(email: string, senha: string, lembrar: boolean): Promise<ResultadoLogin>
    confirmarCodigo(desafio: string, codigo: string): Promise<UsuarioPainel>
    retorno(): Promise<Retorno[]>
    aniversariantes(): Promise<Aniversariante[]>
    salvarSeguranca(senha: string, telefone: string | null): Promise<void>
    sair(): void
    eu(): Promise<UsuarioPainel>
    resumo(data: string): Promise<Resumo>
    funil(dias: number): Promise<Funil>
    agenda(data: string, profissional?: string): Promise<{ agendamentos: ItemAgenda[]; bloqueios: Bloqueio[]; espera?: EsperaPainel[] }>
    removerEspera(id: string): Promise<void>
    avaliacoes(): Promise<ResumoAvaliacoes>
    pedidos(todos?: boolean): Promise<PedidoPainel[]>
    statusPedido(id: string, status: StatusPedido): Promise<void>
    status(id: string, status: Status): Promise<{ adiantar?: Oferta | null }>
    lembretes(): Promise<ItemLembrete[]>
    lembrar(id: string): Promise<void>
    encaixe(d: { nome: string; telefone?: string; servicoId: string; profissionalId: string; data: string; hora: string }): Promise<void>
    bloquear(d: { profissionalId: string; data: string; inicio: string; fim: string; motivo: string }): Promise<void>
    desbloquear(id: string): Promise<void>
    clientes(busca: string): Promise<ClientePainel[]>
    mensagens(status?: 'todas' | 'enviadas' | 'falharam'): Promise<Mensagem[]>
    modelos(): Promise<ModeloMsg[]>
    salvarModelo(chave: string, d: { texto?: string | null; ativo?: boolean; valor?: number | null }): Promise<void>
    automacoes(): Promise<Automacao[]>
    salvarAutomacao(id: string | null, d: Omit<Automacao, 'id'>): Promise<void>
    removerAutomacao(id: string): Promise<void>
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
