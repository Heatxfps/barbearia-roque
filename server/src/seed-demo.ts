/**
 * Gera dados FICTÍCIOS para a apresentação: clientes, histórico dos últimos
 * 45 dias (com faltas), agenda de hoje e dos próximos dias.
 * NÃO rode em produção com clientes reais.
 *
 * Uso: npm run seed:demo        (acrescenta, se o banco estiver sem agendamentos)
 *      npm run seed:demo -- --limpar   (apaga clientes/agendamentos antes)
 */
import { abrirBanco, novoId } from './db.ts'
import { fimDoServico, horariosDoProfissional, profissionaisAtivos } from './agenda.ts'
import { agora, carimbo, dataIso, definirRelogio, somarMin } from './tempo.ts'

const db = abrirBanco()
const limpar = process.argv.includes('--limpar')

const { n } = db.prepare('SELECT COUNT(*) AS n FROM agendamentos').get() as { n: number }
if (n > 0 && !limpar) {
  console.log('O banco já tem agendamentos. Use --limpar para recriar os dados de demonstração.')
  process.exit(0)
}
if (limpar) db.exec(`DELETE FROM avaliacoes; DELETE FROM cupons; DELETE FROM espera; DELETE FROM pedido_itens; DELETE FROM pedidos;
                     DELETE FROM agendamentos; DELETE FROM clientes; DELETE FROM mensagens; DELETE FROM codigos; DELETE FROM bloqueios;`)

// gerador pseudoaleatório fixo (sempre os mesmos dados)
let semente = 42
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

const nomes = ['João Pedro', 'Marcos Antônio', 'Felipe Rocha', 'Thiago Lima', 'André Souza', 'Bruno Martins', 'Rafael Costa', 'Diego Ferreira',
  'Lucas Vieira', 'Gustavo Henrique', 'Paulo Eduardo', 'Vinícius Teixeira', 'Matheus Alves', 'Gabriel Santos', 'Leonardo Dias', 'Caio Ribeiro',
  'Pedro Henrique', 'Igor Nascimento', 'Renan Barbosa', 'Eduardo Pinto', 'Samuel Moreira', 'Daniel Cardoso', 'Henrique Lopes', 'Victor Hugo',
  'Arthur Mendes', 'Murilo Campos', 'Otávio Freitas', 'Wesley Araújo', 'Kauã Monteiro', 'Davi Correia', 'Enzo Rezende', 'Fábio Nunes',
  'Luiz Felipe', 'Ricardo Gomes', 'Alan Machado', 'Júlio César', 'Hugo Batista', 'Nicolas Prado', 'Breno Castro', 'Elias Fonseca']

const servicos = db.prepare('SELECT id, preco, duracao FROM servicos WHERE ativo = 1').all() as { id: string; preco: number; duracao: number }[]
const pesos = ['corte', 'corte', 'corte', 'combo', 'combo', 'barba', 'barba', 'sobrancelha', 'pigmentacao', 'hidratacao', 'platinado']
const servicoAleatorio = () => servicos.find((s) => s.id === pick(pesos)) ?? servicos[0]
const profs = profissionaisAtivos(db)

const clientes = nomes.map((nome, i) => {
  const id = novoId()
  const tel = `55279${String(88000000 + i * 1371).padStart(8, '0')}`
  db.prepare('INSERT INTO clientes (id, nome, telefone, criado_em) VALUES (?, ?, ?, ?)').run(id, nome, tel, carimbo(somarMin(agora(), -90 * 1440)))
  return id
})

const ins = db.prepare(`INSERT INTO agendamentos (id, cliente_id, profissional_id, servico_id, inicio, fim, preco, status, origem, criado_em, lembrete_24h, lembrete_1h)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`)

const hojeReal = agora()
const hoje0 = new Date(hojeReal); hoje0.setHours(0, 0, 0, 0)
let total = 0

// clientes "sumidos" (para aparecer em "chamar de volta"): só vêm no começo do período
const sumidos = new Set(clientes.slice(-6))

for (let d = -45; d <= 6; d++) {
  const dia = new Date(hoje0); dia.setDate(dia.getDate() + d)
  const data = dataIso(dia)
  // para o passado, "volta o relógio" para meia-noite do dia, assim todos os horários contam como livres
  definirRelogio(() => (d < 0 ? new Date(dia.getTime() - 3600_000) : d === 0 ? new Date(hoje0.getTime() - 3600_000) : hojeReal))
  const ocupacao = d < 0 ? 0.62 : d === 0 ? 0.7 : Math.max(0.15, 0.5 - d * 0.07)
  for (const prof of profs) {
    for (const hora of horariosDoProfissional(db, prof, data, 30)) {
      if (rnd() > ocupacao / 1.6) continue
      const s = servicoAleatorio()
      if (!horariosDoProfissional(db, prof, data, s.duracao).includes(hora)) continue
      let cliente = pick(clientes)
      if (sumidos.has(cliente) && d > -25) cliente = pick(clientes.slice(0, -6))
      const inicio = `${data} ${hora}`
      const status = d < 0 ? (rnd() < 0.05 ? 'faltou' : rnd() < 0.04 ? 'cancelado' : 'concluido') : d === 0 && inicio < carimbo(hojeReal) ? 'concluido' : 'confirmado'
      ins.run(novoId(), cliente, prof, s.id, inicio, fimDoServico(data, hora, s.duracao), s.preco, status, rnd() < 0.68 ? 'app' : 'balcao',
        carimbo(somarMin(dia, -3 * 1440)))
      total++
    }
  }
}
definirRelogio(() => new Date())

// avaliações de parte dos atendimentos concluídos (para o painel ter média e comentários)
const elogios = ['Atendimento impecável, como sempre.', 'Melhor degradê da cidade!', 'Ambiente top e pontualidade.', 'Barba perfeita na navalha.', '', '', '', 'Voltarei com certeza.']
const concluidos = db.prepare(`SELECT id, cliente_id, profissional_id, fim FROM agendamentos WHERE status = 'concluido' ORDER BY inicio`).all() as
  { id: string; cliente_id: string; profissional_id: string; fim: string }[]
const insAv = db.prepare('INSERT INTO avaliacoes (id, agendamento_id, cliente_id, profissional_id, nota, comentario, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?)')
let avaliacoes = 0
for (const a of concluidos) {
  db.prepare('UPDATE agendamentos SET avaliacao_enviada = 1 WHERE id = ?').run(a.id)
  if (rnd() > 0.4) continue
  insAv.run(novoId(), a.id, a.cliente_id, a.profissional_id, rnd() < 0.82 ? 5 : rnd() < 0.8 ? 4 : 3, pick(elogios), a.fim)
  avaliacoes++
}

// alguns aniversários (um deles hoje, para mostrar o cupom) e pedidos da loja
const hojeMd = dataIso(hojeReal).slice(5)
clientes.slice(0, 12).forEach((id, i) => db.prepare('UPDATE clientes SET aniversario = ? WHERE id = ?')
  .run(i === 0 ? hojeMd : `${String(1 + (i % 12)).padStart(2, '0')}-${String(3 + i * 2).padStart(2, '0')}`, id))
const produtos = db.prepare('SELECT id, nome, preco FROM produtos WHERE ativo = 1').all() as { id: string; nome: string; preco: number }[]
if (produtos.length) {
  ;([[clientes[3], 'novo', 2], [clientes[7], 'separado', 30], [clientes[11], 'retirado', 60 * 26]] as [string, string, number][]).forEach(([cli, status, minAtras], k) => {
    const itens = [produtos[k % produtos.length], produtos[(k + 1) % produtos.length]].slice(0, k === 1 ? 1 : 2)
    const id = novoId()
    db.prepare('INSERT INTO pedidos (id, cliente_id, status, total, criado_em) VALUES (?, ?, ?, ?, ?)').run(id, cli, status, itens.reduce((t, p) => t + p.preco, 0), carimbo(somarMin(hojeReal, -minAtras)))
    for (const p of itens) db.prepare('INSERT INTO pedido_itens (pedido_id, produto_id, nome, preco, qtd) VALUES (?, ?, ?, ?, 1)').run(id, p.id, p.nome, p.preco)
  })
}

// algumas mensagens de exemplo no histórico do WhatsApp
const msg = db.prepare('INSERT INTO mensagens (id, telefone, tipo, texto, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
msg.run(novoId(), '5527988000000', 'lembrete_24h', 'Oi, João! Lembrete: amanhã tem *Corte* na *Barbearia Roque*…', 'demo', carimbo(somarMin(hojeReal, -20 * 60)))
msg.run(novoId(), '5527988001371', 'retorno', 'E aí, Marcos! Já faz 24 dias desde o seu último corte na *Barbearia Roque*…', 'demo', carimbo(somarMin(hojeReal, -26 * 60)))

console.log(`✔ Dados de demonstração criados: ${clientes.length} clientes, ${total} agendamentos, ${avaliacoes} avaliações, 3 pedidos.`)
db.close()
