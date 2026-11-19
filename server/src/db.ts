/**
 * Banco de dados SQLite (um arquivo só, ideal para uma barbearia numa VPS).
 * Usa o SQLite embutido no Node (node:sqlite), sem dependências nativas.
 */
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { config } from './config.ts'

export type DB = DatabaseSync

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS barbearia (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profissionais (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  especialidade TEXT NOT NULL DEFAULT '',
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS servicos (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco REAL NOT NULL,
  duracao INTEGER NOT NULL,
  destaque INTEGER NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  ordem INTEGER NOT NULL DEFAULT 0
);

-- expediente de cada profissional por dia da semana (0 = domingo)
CREATE TABLE IF NOT EXISTS expediente (
  profissional_id TEXT NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  dia INTEGER NOT NULL,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  intervalo_inicio TEXT,
  intervalo_fim TEXT,
  PRIMARY KEY (profissional_id, dia)
);

-- folgas, férias, horários travados pelo dono
CREATE TABLE IF NOT EXISTS bloqueios (
  id TEXT PRIMARY KEY,
  profissional_id TEXT NOT NULL REFERENCES profissionais(id) ON DELETE CASCADE,
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  motivo TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL UNIQUE,
  criado_em TEXT NOT NULL,
  aviso_retorno_em TEXT
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id),
  profissional_id TEXT NOT NULL REFERENCES profissionais(id),
  servico_id TEXT NOT NULL REFERENCES servicos(id),
  inicio TEXT NOT NULL,
  fim TEXT NOT NULL,
  preco REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmado', -- confirmado | concluido | faltou | cancelado
  origem TEXT NOT NULL DEFAULT 'app',        -- app | balcao
  criado_em TEXT NOT NULL,
  lembrete_24h INTEGER NOT NULL DEFAULT 0,
  lembrete_1h INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ag_prof_inicio ON agendamentos(profissional_id, inicio);
CREATE INDEX IF NOT EXISTS ag_cliente ON agendamentos(cliente_id, inicio);

CREATE TABLE IF NOT EXISTS codigos (
  telefone TEXT PRIMARY KEY,
  codigo_hash TEXT NOT NULL,
  expira_em INTEGER NOT NULL,
  enviado_em INTEGER NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0
);

-- todas as mensagens de WhatsApp (enviadas ou simuladas no modo demo)
CREATE TABLE IF NOT EXISTS mensagens (
  id TEXT PRIMARY KEY,
  telefone TEXT NOT NULL,
  tipo TEXT NOT NULL,
  texto TEXT NOT NULL,
  status TEXT NOT NULL,
  erro TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'dono', -- dono | barbeiro
  profissional_id TEXT REFERENCES profissionais(id)
);
`

export const novoId = () => randomBytes(8).toString('hex')

export function hashSenha(senha: string) {
  const sal = randomBytes(16).toString('hex')
  return `${sal}:${scryptSync(senha, sal, 32).toString('hex')}`
}
export function conferirSenha(senha: string, hash: string) {
  const [sal, h] = hash.split(':')
  const a = Buffer.from(h, 'hex')
  const b = scryptSync(senha, sal, 32)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Dados iniciais: troque pelos dados reais da Roque (ou edite pelo painel). */
function semear(db: DB) {
  const vazio = (db.prepare('SELECT COUNT(*) AS n FROM servicos').get() as { n: number }).n === 0
  if (!vazio) return

  const info: Record<string, string> = {
    nome: 'Barbearia Roque',
    cidade: 'Nova Venécia - ES',
    endereco: 'Endereço a confirmar · Nova Venécia - ES',
    whatsapp: '5527999999999',
    instagram: 'barbearia_roque',
  }
  const insInfo = db.prepare('INSERT INTO barbearia (chave, valor) VALUES (?, ?)')
  for (const [k, v] of Object.entries(info)) insInfo.run(k, v)

  const servicos: [string, string, string, number, number, number][] = [
    ['corte', 'Corte', 'Corte na tesoura ou máquina, lavagem e finalização', 45, 40, 1],
    ['barba', 'Barba', 'Toalha quente, navalha e balm', 35, 30, 1],
    ['combo', 'Corte + Barba', 'O ritual completo da casa', 75, 70, 1],
    ['sobrancelha', 'Sobrancelha', 'Acabamento na navalha', 15, 10, 0],
    ['pigmentacao', 'Pigmentação', 'Barba ou cabelo', 30, 20, 0],
    ['hidratacao', 'Hidratação', 'Tratamento para cabelo e barba', 30, 20, 0],
    ['platinado', 'Platinado / Luzes', 'Consulte o profissional', 150, 120, 0],
  ]
  const insS = db.prepare('INSERT INTO servicos (id, nome, descricao, preco, duracao, destaque, ordem) VALUES (?, ?, ?, ?, ?, ?, ?)')
  servicos.forEach((s, i) => insS.run(...s, i))

  const profs: [string, string, string][] = [
    ['p1', 'Profissional 1', 'Cortes clássicos e degradê'],
    ['p2', 'Profissional 2', 'Barba e navalha'],
    ['p3', 'Profissional 3', 'Química e platinado'],
  ]
  const insP = db.prepare('INSERT INTO profissionais (id, nome, especialidade, ordem) VALUES (?, ?, ?, ?)')
  const insE = db.prepare('INSERT INTO expediente (profissional_id, dia, inicio, fim, intervalo_inicio, intervalo_fim) VALUES (?, ?, ?, ?, ?, ?)')
  profs.forEach((p, i) => {
    insP.run(...p, i)
    for (let dia = 1; dia <= 5; dia++) insE.run(p[0], dia, '09:00', dia === 5 ? '20:00' : '19:00', '12:00', '13:00')
    insE.run(p[0], 6, '08:00', '17:00', null, null)
  })

  db.prepare('INSERT INTO usuarios (id, email, nome, senha_hash, papel) VALUES (?, ?, ?, ?, ?)')
    .run(novoId(), config.admin.email.toLowerCase(), config.admin.nome, hashSenha(config.admin.senha), 'dono')
}

export function abrirBanco(caminho = config.banco): DB {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true })
  const db = new DatabaseSync(caminho)
  db.exec(SCHEMA)
  semear(db)
  return db
}

/** Executa várias operações numa transação (tudo ou nada). */
export function transacao<T>(db: DB, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export function lerBarbearia(db: DB): Record<string, string> {
  const linhas = db.prepare('SELECT chave, valor FROM barbearia').all() as { chave: string; valor: string }[]
  return Object.fromEntries(linhas.map((l) => [l.chave, l.valor]))
}
