/**
 * Mensagens automáticas do WhatsApp: textos padrão, variáveis e tempos.
 * Usado pelo servidor (para enviar) e pelo painel (para editar e pré-visualizar).
 * O dono pode mudar o texto, ligar/desligar e ajustar o tempo; "restaurar" volta para o texto daqui.
 */

/** Etapa do fluxo onde a mensagem aparece. Cliente: marcou → antes → no dia → (na cadeira) → depois → voltar.
 *  Loja: pedidos de produtos. Barbearia: avisos que vão para o WhatsApp da própria barbearia. */
export type Grupo = 'marcou' | 'antes' | 'no_dia' | 'depois' | 'voltar' | 'loja' | 'barbearia' | 'divulgacao'
export type Raia = 'cliente' | 'loja' | 'equipe'
export const RAIA: Record<Grupo, Raia | null> = { marcou: 'cliente', antes: 'cliente', no_dia: 'cliente', depois: 'cliente', voltar: 'cliente', loja: 'loja', barbearia: 'equipe', divulgacao: null }
export type Unidade = 'minutos' | 'horas' | 'dias'

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
  nova_hora: { rotulo: 'novo horário (adiantado)', exemplo: '14:20' },
  nota: { rotulo: 'nota da avaliação', exemplo: '2' },
  comentario: { rotulo: 'comentário do cliente', exemplo: 'Demorou para começar' },
}

const AGENDA = ['nome', 'servico', 'barbeiro', 'data', 'hora', 'barbearia', 'endereco', 'link']

export const MODELOS: ModeloPadrao[] = [
  // ---------------- cliente: marcou ----------------
  {
    chave: 'espera', nome: 'Vaga da lista de espera', grupo: 'marcou',
    descricao: 'Dia lotado: o cliente entra na lista. Abriu vaga, avisa o primeiro; 30 min depois, o próximo.',
    texto: '{nome}, abriu vaga na *{barbearia}*! 🙌\n*{servico}* {data}: {horarios}\nVocê é o primeiro da lista de espera. Garanta pelo app nos próximos 30 min:\n{link}',
    variaveis: ['nome', 'servico', 'data', 'horarios', 'barbearia', 'link'],
  },
  {
    chave: 'confirmacao', nome: 'Confirmação', grupo: 'marcou',
    descricao: 'Logo depois que o cliente marca pelo app. Se tiver desconto de aniversário, o app acrescenta uma linha avisando.',
    texto: 'Fala, {nome}! ✂️\nSeu horário na *{barbearia}* está confirmado:\n\n*{servico}* com {barbeiro}\n📅 {data} às {hora}\n📍 {endereco}\n\nSe precisar remarcar ou cancelar, é só abrir o app.',
    variaveis: AGENDA,
  },
  {
    chave: 'cancelamento', nome: 'Cliente cancelou', grupo: 'marcou',
    descricao: 'Comprovante para o cliente que cancelou pelo app (não vai quando ele está só remarcando).',
    texto: '{nome}, seu horário de *{servico}* ({data} às {hora}) foi cancelado. Quando quiser, é só agendar de novo pelo app.',
    variaveis: AGENDA,
  },
  {
    chave: 'cancelamento_casa', nome: 'Barbearia desmarcou', grupo: 'marcou',
    descricao: 'Quando a equipe cancela o horário pelo painel (imprevisto, barbeiro doente…).',
    texto: '{nome}, precisamos desmarcar seu horário de *{servico}* ({data} às {hora}) na *{barbearia}*. Desculpe o transtorno! 🙏\nEscolha outro horário pelo app: {link}',
    variaveis: AGENDA,
  },
  // ---------------- cliente: antes ----------------
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
  // ---------------- cliente: no dia ----------------
  {
    chave: 'adiantar', nome: 'Pode adiantar', grupo: 'no_dia',
    descricao: 'Alguém desmarcou no dia, faltou ou o barbeiro terminou antes: o próximo cliente dele é convidado a vir mais cedo. Um por vez; se não responder em 20 min, passa para o seguinte. Só vai se adiantar pelo menos esse tempo.',
    texto: '{nome}, abriu um espaço na agenda do {barbeiro} hoje! ⏩\nQuer adiantar seu *{servico}* das {hora} para as *{nova_hora}*?\nToque para confirmar (vale por 20 min):\n{link}',
    variaveis: ['nome', 'servico', 'barbeiro', 'hora', 'nova_hora', 'barbearia', 'link'], tempo: { padrao: 20, unidade: 'minutos', rotulo: 'mais cedo, no mínimo', min: 10, max: 120 },
  },
  {
    chave: 'faltou', nome: 'Sentimos sua falta', grupo: 'no_dia',
    descricao: 'Quando o barbeiro marca "faltou". Convida a remarcar, sem bronca.',
    texto: '{nome}, sentimos sua falta hoje às {hora} na *{barbearia}*. Aconteceu alguma coisa?\nQuando quiser, escolha outro horário pelo app: {link}',
    variaveis: AGENDA,
  },
  // ---------------- cliente: depois ----------------
  {
    chave: 'avaliacao', nome: 'Pedido de avaliação', grupo: 'depois',
    descricao: 'Depois que o barbeiro marca o atendimento como concluído (das 9h às 21h). Nota baixa avisa a barbearia.',
    texto: '{nome}, valeu pela visita na *{barbearia}*! ✂️\nComo foi o atendimento com {barbeiro}? Leva 10 segundos:\n{link}',
    variaveis: ['nome', 'barbeiro', 'servico', 'barbearia', 'link'], tempo: { padrao: 1, unidade: 'horas', rotulo: 'depois do atendimento', min: 1, max: 24 },
  },
  // ---------------- cliente: para voltar ----------------
  {
    chave: 'retorno', nome: 'Volte a cortar', grupo: 'voltar',
    descricao: 'Para quem está esse tempo sem vir e sem horário marcado (das 10h às 19h, uma vez por visita).',
    texto: 'E aí, {nome}! Já faz {dias} dias desde o seu último corte na *{barbearia}*. Bora dar aquele tapa no visual com o {barbeiro}? Agende pelo app em 20 segundos. ✂️\n{link}',
    variaveis: ['nome', 'dias', 'barbeiro', 'barbearia', 'link'], tempo: { padrao: 20, unidade: 'dias', rotulo: 'sem vir', min: 7, max: 90 },
  },
  {
    chave: 'aniversario', nome: 'Aniversário', grupo: 'voltar',
    descricao: 'No dia do aniversário, a partir das 9h. O % e a validade do cupom ficam em Ajustes.',
    texto: '🎂 Feliz aniversário, {nome}!\nA *{barbearia}* te deu *{desconto}% de desconto* no próximo horário, até {validade}. O desconto entra sozinho quando você agenda pelo app.\n{link}',
    variaveis: ['nome', 'desconto', 'validade', 'barbearia', 'link'],
  },
  {
    chave: 'cupom_vencendo', nome: 'Cupom vencendo', grupo: 'voltar',
    descricao: 'Para quem ganhou o desconto de aniversário, ainda não usou e não tem horário marcado (das 10h às 19h).',
    texto: '{nome}, seu desconto de aniversário de *{desconto}%* na *{barbearia}* vence {validade}. Ainda dá tempo! ✂️\n{link}',
    variaveis: ['nome', 'desconto', 'validade', 'barbearia', 'link'], tempo: { padrao: 2, unidade: 'dias', rotulo: 'antes de vencer', min: 1, max: 7 },
  },
  // ---------------- loja ----------------
  {
    chave: 'pedido', nome: 'Pedido recebido', grupo: 'loja',
    descricao: 'Quando o cliente reserva produtos na loja.',
    texto: '{nome}, seu pedido na *{barbearia}* foi recebido! 🛍️\n{itens}\nTotal: *{total}*, pago na retirada.\nAvisamos quando estiver separado.',
    variaveis: ['nome', 'itens', 'total', 'barbearia'],
  },
  {
    chave: 'pedido_separado', nome: 'Pedido separado', grupo: 'loja',
    descricao: 'Quando a equipe marca o pedido como separado.',
    texto: '{nome}, seu pedido está separado na *{barbearia}*. É só passar para retirar. 🛍️\n📍 {endereco}',
    variaveis: ['nome', 'barbearia', 'endereco'],
  },
  {
    chave: 'pedido_parado', nome: 'Lembrete de retirada', grupo: 'loja',
    descricao: 'Pedido separado e ainda não retirado depois desse tempo (uma vez, das 10h às 19h).',
    texto: '{nome}, seu pedido continua separado te esperando na *{barbearia}* 🛍️\n{itens}\nDá para retirar no seu próximo corte, se preferir.',
    variaveis: ['nome', 'itens', 'barbearia'], tempo: { padrao: 3, unidade: 'dias', rotulo: 'depois de separado', min: 1, max: 14 },
  },
  // ---------------- para a barbearia ----------------
  {
    chave: 'aviso_novo', nome: 'Novo horário', grupo: 'barbearia',
    descricao: 'Vai para o WhatsApp da própria barbearia a cada horário marcado pelo app.',
    texto: '📲 *Novo horário pelo app*\n{nome} · {servico}\n👤 {barbeiro}\n📅 {data} às {hora}\nWhatsApp: +{telefone}',
    variaveis: ['nome', 'servico', 'barbeiro', 'data', 'hora', 'telefone'],
  },
  {
    chave: 'aviso_cancelou', nome: 'Cliente cancelou', grupo: 'barbearia',
    descricao: 'Quando o cliente cancela pelo app.',
    texto: '❌ *Cancelado pelo cliente*\n{nome} · {servico} com {barbeiro}\n📅 {data} às {hora}\nO horário já voltou a ficar livre no app.',
    variaveis: ['nome', 'servico', 'barbeiro', 'data', 'hora'],
  },
  {
    chave: 'aviso_adiantou', nome: 'Cliente adiantou', grupo: 'barbearia',
    descricao: 'Quando o cliente aceita vir mais cedo (mensagem "Pode adiantar").',
    texto: '⏩ *Horário adiantado*\n{nome} · {servico} com {barbeiro}\nDas {hora} para as *{nova_hora}*',
    variaveis: ['nome', 'servico', 'barbeiro', 'hora', 'nova_hora'],
  },
  {
    chave: 'aviso_pedido', nome: 'Novo pedido', grupo: 'barbearia',
    descricao: 'A cada pedido da loja.',
    texto: '🛍️ *Novo pedido para retirar*\n{nome} (+{telefone})\n{itens}\nTotal: {total}',
    variaveis: ['nome', 'telefone', 'itens', 'total'],
  },
  {
    chave: 'aviso_avaliacao', nome: 'Avaliação baixa', grupo: 'barbearia',
    descricao: 'Quando um cliente dá 3 estrelas ou menos: dá para chamar e resolver antes que ele suma.',
    texto: '⚠️ *Avaliação de {nota}★*\n{nome} · atendimento com {barbeiro}\n"{comentario}"\nWhatsApp: +{telefone}',
    variaveis: ['nome', 'nota', 'comentario', 'barbeiro', 'telefone'],
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
