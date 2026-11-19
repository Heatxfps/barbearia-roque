/** Textos das mensagens de WhatsApp (edite à vontade). */
import { dataExtenso } from './tempo.ts'

type Info = { nome: string; servico: string; inicio: string; profissional: string; barbearia: string; endereco?: string }

const quando = (inicio: string) => `${dataExtenso(inicio)} às ${inicio.slice(11, 16)}`
const primeiro = (n: string) => n.split(' ')[0]

export const textos = {
  codigo: (codigo: string, barbearia: string) =>
    `*${barbearia}*\nSeu código de acesso é *${codigo}*.\nEle vale por 10 minutos. Não compartilhe com ninguém.`,

  confirmacao: (i: Info) =>
    `Fala, ${primeiro(i.nome)}! ✂️\nSeu horário na *${i.barbearia}* está confirmado:\n\n*${i.servico}* com ${i.profissional}\n📅 ${quando(i.inicio)}\n\nSe precisar remarcar ou cancelar, é só abrir o app.`,

  lembrete24h: (i: Info) =>
    `Oi, ${primeiro(i.nome)}! Lembrete: amanhã tem *${i.servico}* na *${i.barbearia}*, ${quando(i.inicio)}, com ${i.profissional}.\nNão vai conseguir vir? Remarque pelo app para liberar o horário. 🙏`,

  lembrete1h: (i: Info) =>
    `${primeiro(i.nome)}, daqui a 1 hora é o seu horário na *${i.barbearia}* (${i.inicio.slice(11, 16)}). Te esperamos! 💈${i.endereco ? `\n📍 ${i.endereco}` : ''}`,

  cancelamento: (i: Info) =>
    `${primeiro(i.nome)}, seu horário de *${i.servico}* (${quando(i.inicio)}) foi cancelado. Quando quiser, é só agendar de novo pelo app.`,

  retorno: (nome: string, dias: number, barbearia: string) =>
    `E aí, ${primeiro(nome)}! Já faz ${dias} dias desde o seu último corte na *${barbearia}*. Bora dar aquele tapa no visual? Agende pelo app em 20 segundos. ✂️`,
}
