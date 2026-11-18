/**
 * DADOS DA BARBEARIA
 * --------------------------------------------------------------
 * ⚠️ Tudo aqui é EXEMPLO e precisa ser confirmado com a Roque
 * (serviços, preços, profissionais, horário e contatos).
 * Veja docs/PENDENCIAS.md.
 */

export type Servico = {
  id: string
  nome: string
  descricao: string
  preco: number
  duracao: number // minutos
  destaque?: boolean
}

export type Profissional = {
  id: string
  nome: string
  especialidade: string
  iniciais: string
}

export const barbearia = {
  nome: 'Barbearia Roque',
  cidade: 'Nova Venécia - ES',
  endereco: 'Endereço a confirmar · Nova Venécia - ES',
  whatsapp: '5527999999999', // EXEMPLO
  instagram: 'barbeariaroque', // EXEMPLO
  // dia da semana (0 = domingo) -> [abre, fecha] em horas; null = fechado
  horarios: {
    0: null,
    1: [9, 19],
    2: [9, 19],
    3: [9, 19],
    4: [9, 19],
    5: [9, 20],
    6: [8, 17],
  } as Record<number, [number, number] | null>,
  fidelidadeMeta: 10, // a cada 10 cortes, 1 grátis
}

export const servicos: Servico[] = [
  { id: 'corte', nome: 'Corte', descricao: 'Corte na tesoura ou máquina, lavagem e finalização', preco: 45, duracao: 40, destaque: true },
  { id: 'barba', nome: 'Barba', descricao: 'Toalha quente, navalha e balm', preco: 35, duracao: 30, destaque: true },
  { id: 'combo', nome: 'Corte + Barba', descricao: 'O ritual completo da casa', preco: 75, duracao: 70, destaque: true },
  { id: 'sobrancelha', nome: 'Sobrancelha', descricao: 'Acabamento na navalha', preco: 15, duracao: 10 },
  { id: 'pigmentacao', nome: 'Pigmentação', descricao: 'Barba ou cabelo', preco: 30, duracao: 20 },
  { id: 'hidratacao', nome: 'Hidratação', descricao: 'Tratamento para cabelo e barba', preco: 30, duracao: 20 },
  { id: 'platinado', nome: 'Platinado / Luzes', descricao: 'Consulte o profissional', preco: 150, duracao: 120 },
]

export const profissionais: Profissional[] = [
  { id: 'qualquer', nome: 'Sem preferência', especialidade: 'Primeiro horário livre', iniciais: '★' },
  { id: 'p1', nome: 'Profissional 1', especialidade: 'Cortes clássicos e degradê', iniciais: 'P1' },
  { id: 'p2', nome: 'Profissional 2', especialidade: 'Barba e navalha', iniciais: 'P2' },
  { id: 'p3', nome: 'Profissional 3', especialidade: 'Química e platinado', iniciais: 'P3' },
]

export const moeda = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
