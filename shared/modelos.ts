/**
 * Mensagens automáticas do WhatsApp: textos padrão, variáveis e tempos.
 * Usado pelo servidor (para enviar) e pelo painel (para editar e pré-visualizar).
 * O dono pode mudar o texto, ligar/desligar e ajustar o tempo; "restaurar" volta para o texto daqui.
 */

export type Grupo = 'antes' | 'agendamento' | 'depois' | 'especiais' | 'loja' | 'barbearia' | 'divulgacao'
export type Unidade = 'horas' | 'dias'

export type Tempo = { padrao: number; unidade: Unidade; rotulo: string; min: number; max: number }

export type ModeloPadrao = {
  chave: string
  nome: string
  grupo: Grupo
  descricao: string
  texto: string
  variaveis: string[]
  tempo?: Tempo
}

/** O que cada variável vira (para mostrar ao editar) */
export const VARIAVEIS: Record<string, { rotulo: string; exemplo: string }> = {
  nome: { rotulo: 'primeiro nome do cliente', exemplo: 'João' },
  servico: { rotulo: 'serviço', exemplo: 'Corte + Barba' },
  barbeiro: { rotulo: 'barbeiro', exemplo: 'Daniel Andrade' },
  data: { rotulo: 'dia do horário', exemplo: 'sexta-feira, 27 de novembro' },
  hora: { rotulo: 'hora do horário', exemplo: '15:30' },
  barbearia: { rotulo: 'nome da barbearia', exemplo: 'Barbearia Roque' },
  endereco: { rotulo: 'endereço', exemplo: 'Rua …, Nova Venécia' },
  cidade: { rotulo: 'cidade', exemplo: 'Nova Venécia' },
  link: { rotulo: 'link do app', exemplo: 'https://roque.app' },
  dias: { rotulo: 'dias desde o último corte', exemplo: '23' },
  desconto: { rotulo: '% de desconto', exemplo: '15' },
  validade: { rotulo: 'validade do cupom', exemplo: '20/12' },
  horarios: { rotulo: 'horários que abriram', exemplo: '14:00, 14:30' },
  itens: { rotulo: 'itens do pedido', exemplo: '• 1× Pomada modeladora' },
  total: { rotulo: 'total do pedido', exemplo: 'R$ 45,00' },
  telefone: { rotulo: 'WhatsApp do cliente', exemplo: '5527999990000' },
}

const AGENDA = ['nome', 'servico', 'barbeiro', 'data', 'hora', 'barbearia', 'endereco', 'link']

export const MODELOS: ModeloPadrao[] = [
  {
    chave: 'confirmacao', nome: 'Confirmação', grupo: 'agendamento',
    descricao: 'Logo depois que o cliente marca pelo app.',
    texto: 'Fala, {nome}! ✂️\nSeu horário na *{barbearia}* está confirmado:\n\n*{servico}* com {barbeiro}\n📅 {data} às {hora}\n\nSe precisar remarcar ou cancelar, é só abrir o app.',
    variaveis: AGENDA,
  },
  {
    chave: 'lembrete_24h', nome: 'Lembrete da véspera', grupo: 'antes',
    descricao: 'Só vai se o horário foi marcado com antecedência maior que esse tempo.',
    texto: 'Oi, {nome}! Lembrete: tem *{servico}* na *{barbearia}* {data}, às {hora}, com {barbeiro}.\nNão vai conseguir vir? Remarque pelo app para liberar o horário. 🙏',
    variaveis: AGENDA, tempo: { padrao: 24, unidade: 'horas', rotulo: 'antes do horário', min: 3, max: 72 },
  },
  {
    chave: 'lembrete_1h', nome: 'Lembrete em cima da hora', grupo: 'antes',
    descricao: 'Último aviso, com o endereço.',
    texto: '{nome}, daqui a pouco é o seu horário na *{barbearia}* ({hora}). Te esperamos! 💈\n📍 {endereco}',
    variaveis: AGENDA, tempo: { padrao: 1, unidade: 'horas', rotulo: 'antes do horário', min: 1, max: 6 },
  },
  {
    chave: 'cancelamento', nome: 'Horário cancelado', grupo: 'agendamento',
    descricao: 'Quando o horário é cancelado (pelo cliente ou pela barbearia).',
    texto: '{nome}, seu horário de *{servico}* ({data} às {hora}) foi cancelado. Quando quiser, é só agendar de novo pelo app.',
    variaveis: AGENDA,
  },
  {
    chave: 'avaliacao', nome: 'Pedido de avaliação', grupo: 'depois',
    descricao: 'Depois que o barbeiro marca o atendimento como concluído (das 9h às 21h).',
    texto: '{nome}, valeu pela visita na *{barbearia}*! ✂️\nComo foi o atendimento com {barbeiro}? Leva 10 segundos:\n{link}',
    variaveis: ['nome', 'barbeiro', 'servico', 'barbearia', 'link'], tempo: { padrao: 1, unidade: 'horas', rotulo: 'depois do atendimento', min: 1, max: 24 },
  },
  {
    chave: 'retorno', nome: 'Volte a cortar', grupo: 'depois',
    descricao: 'Para quem está esse tempo sem vir e sem horário marcado (das 10h às 19h, uma vez por visita).',
    texto: 'E aí, {nome}! Já faz {dias} dias desde o seu último corte na *{barbearia}*. Bora dar aquele tapa no visual? Agende pelo app em 20 segundos. ✂️\n{link}',
    variaveis: ['nome', 'dias', 'barbearia', 'link'], tempo: { padrao: 20, unidade: 'dias', rotulo: 'sem vir', min: 7, max: 90 },
  },
  {
    chave: 'aniversario', nome: 'Aniversário', grupo: 'especiais',
    descricao: 'No dia do aniversário, a partir das 9h. O % e a validade do cupom ficam em Ajustes.',
    texto: '🎂 Feliz aniversário, {nome}!\nA *{barbearia}* te deu *{desconto}% de desconto* no próximo horário, até {validade}. O desconto entra sozinho quando você agenda pelo app.\n{link}',
    variaveis: ['nome', 'desconto', 'validade', 'barbearia', 'link'],
  },
  {
    chave: 'espera', nome: 'Vaga da lista de espera', grupo: 'especiais',
    descricao: 'Quando abre vaga num dia lotado: avisa o primeiro da fila; 30 min depois, o próximo.',
    texto: '{nome}, abriu vaga na *{barbearia}*! 🙌\n*{servico}* {data}: {horarios}\nVocê é o primeiro da lista de espera. Garanta pelo app nos próximos 30 min:\n{link}',
    variaveis: ['nome', 'servico', 'data', 'horarios', 'barbearia', 'link'],
  },
  {
    chave: 'pedido', nome: 'Pedido recebido', grupo: 'loja',
    descricao: 'Quando o cliente reserva produtos na loja.',
    texto: '{nome}, seu pedido na *{barbearia}* foi recebido! 🛍️\n{itens}\nTotal: *{total}*, pago na retirada.\nAvisamos quando estiver separado.',
    variaveis: ['nome', 'itens', 'total', 'barbearia'],
  },
  {
    chave: 'pedido_separado', nome: 'Pedido separado', grupo: 'loja',
    descricao: 'Quando a equipe marca o pedido como separado.',
    texto: '{nome}, seu pedido está separado na *{barbearia}*. É só passar para retirar. 🛍️',
    variaveis: ['nome', 'barbearia'],
  },
  {
    chave: 'aviso_novo', nome: 'Para a barbearia: novo horário', grupo: 'barbearia',
    descricao: 'Vai para o WhatsApp da própria barbearia a cada horário marcado pelo app.',
    texto: '📲 *Novo horário pelo app*\n{nome} · {servico}\n👤 {barbeiro}\n📅 {data} às {hora}\nWhatsApp: +{telefone}',
    variaveis: ['nome', 'servico', 'barbeiro', 'data', 'hora', 'telefone'],
  },
  {
    chave: 'aviso_cancelou', nome: 'Para a barbearia: cancelamento', grupo: 'barbearia',
    descricao: 'Quando o cliente cancela pelo app.',
    texto: '❌ *Cancelado pelo cliente*\n{nome} · {servico} com {barbeiro}\n📅 {data} às {hora}\nO horário já voltou a ficar livre no app.',
    variaveis: ['nome', 'servico', 'barbeiro', 'data', 'hora'],
  },
  {
    chave: 'aviso_pedido', nome: 'Para a barbearia: novo pedido', grupo: 'barbearia',
    descricao: 'A cada pedido da loja.',
    texto: '🛍️ *Novo pedido para retirar*\n{nome} (+{telefone})\n{itens}\nTotal: {total}',
    variaveis: ['nome', 'telefone', 'itens', 'total'],
  },
  {
    chave: 'div_saudacao', nome: 'Saudação do WhatsApp Business', grupo: 'divulgacao',
    descricao: 'WhatsApp Business → Ferramentas comerciais → Mensagem de saudação.',
    texto: 'Olá! Que bom falar com a *{barbearia}* ✂️\n\nPara marcar seu horário em segundos, escolha o barbeiro e o horário direto no nosso app:\n{link}\n\nSe preferir, deixe sua mensagem que respondemos assim que sairmos da cadeira.',
    variaveis: ['barbearia', 'link', 'cidade'],
  },
  {
    chave: 'div_ausencia', nome: 'Mensagem de ausência', grupo: 'divulgacao',
    descricao: 'WhatsApp Business → Ferramentas comerciais → Mensagem de ausência → "Fora do horário comercial".',
    texto: 'Estamos fechados agora, mas a agenda da *{barbearia}* funciona 24h 🕐\nMarque seu horário pelo app: {link}',
    variaveis: ['barbearia', 'link', 'cidade'],
  },
  {
    chave: 'div_bio', nome: 'Bio do Instagram', grupo: 'divulgacao',
    descricao: 'Cole no perfil e use o link como "link na bio".',
    texto: '✂️ Barbearia clássica em {cidade}\n📲 Agende pelo app: {link}',
    variaveis: ['barbearia', 'link', 'cidade'],
  },
]

export const modeloPadrao = (chave: string) => MODELOS.find((m) => m.chave === chave)

/** Troca {variavel} pelo valor; variável desconhecida fica como está */
export const preencher = (texto: string, vars: Record<string, string | number | undefined>) =>
  texto.replace(/\{(\w+)\}/g, (m, k: string) => (vars[k] === undefined ? m : String(vars[k])))

/** Exemplo preenchido (pré-visualização no painel) */
export const exemplo = (texto: string) => preencher(texto, Object.fromEntries(Object.entries(VARIAVEIS).map(([k, v]) => [k, v.exemplo])))

// ---------- automações criadas pelo dono ----------
export type Gatilho = 'antes_horario' | 'depois_atendimento' | 'dias_depois' | 'primeira_visita'
export const GATILHOS: Record<Gatilho, { rotulo: string; unidade: Unidade; padrao: number; min: number; max: number; grupo: Grupo; dica: string }> = {
  antes_horario: { rotulo: 'antes do horário', unidade: 'horas', padrao: 3, min: 1, max: 72, grupo: 'antes', dica: 'Ex.: "Separe 10 min a mais se for fazer barba".' },
  depois_atendimento: { rotulo: 'depois do atendimento', unidade: 'horas', padrao: 3, min: 1, max: 48, grupo: 'depois', dica: 'Ex.: dica de cuidado com a barba depois do corte.' },
  dias_depois: { rotulo: 'dias depois do atendimento', unidade: 'dias', padrao: 7, min: 1, max: 60, grupo: 'depois', dica: 'Ex.: "Como ficou o corte uma semana depois?"' },
  primeira_visita: { rotulo: 'depois da 1ª visita do cliente', unidade: 'horas', padrao: 2, min: 1, max: 72, grupo: 'depois', dica: 'Boas-vindas para quem veio pela primeira vez.' },
}
export const VARIAVEIS_AUTOMACAO = AGENDA
