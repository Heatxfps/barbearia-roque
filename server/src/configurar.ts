/**
 * Cria o arquivo server/.env com segredos novos (rode uma vez por instalação).
 *
 *   npm --prefix server run configurar -- --email dono@barbeariaroque.com.br [--dominio roque.com.br]
 *
 * Gera JWT_SEGREDO e uma senha forte para o painel e mostra a senha UMA vez na tela.
 * Não sobrescreve um .env que já exista.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { parseArgs } from 'node:util'

const { values } = parseArgs({
  options: {
    email: { type: 'string', default: 'dono@roque.local' },
    nome: { type: 'string', default: 'Luciano Roque' },
    whatsapp: { type: 'string', default: 'demo' },
    arquivo: { type: 'string', default: '.env' },
  },
})

if (existsSync(values.arquivo)) {
  console.log(`⚠️  ${values.arquivo} já existe. Nada foi alterado (apague o arquivo se quiser gerar de novo).`)
  process.exit(0)
}

const senha = randomBytes(9).toString('base64url')
const modelo = readFileSync('.env.example', 'utf8')
const valores: Record<string, string> = {
  JWT_SEGREDO: randomBytes(32).toString('hex'),
  ADMIN_EMAIL: values.email,
  ADMIN_SENHA: senha,
  ADMIN_NOME: values.nome,
  WHATSAPP_MODO: values.whatsapp,
}
const env = modelo.replace(/^([A-Z_]+)=.*$/gm, (linha, chave: string) => (chave in valores ? `${chave}=${valores[chave]}` : linha))
writeFileSync(values.arquivo, env, { mode: 0o600 })

console.log(`
✔ ${values.arquivo} criado.

  Login do painel (anote agora, ele não aparece de novo):
    e-mail: ${values.email}
    senha:  ${senha}

  Essa senha vale para um banco NOVO. Se o banco já existia, o login antigo continua;
  troque em Painel → Ajustes → Minha senha.
`)
