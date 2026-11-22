/** Textos dos códigos de acesso (fixos, por segurança). As outras mensagens ficam em shared/modelos.ts e são editáveis no painel. */

export const textos = {
  codigo: (codigo: string, barbearia: string) =>
    `*${barbearia}*\nSeu código de acesso é *${codigo}*.\nEle vale por 10 minutos. Não compartilhe com ninguém.`,

  codigoPainel: (codigo: string) =>
    `*Painel da Roque*\nCódigo para entrar: *${codigo}*\nVale por 10 minutos. Se não foi você, troque sua senha.`,
}
