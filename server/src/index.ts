/** Inicia a API da Barbearia Roque. */
import { networkInterfaces } from 'node:os'
import { abrirBanco } from './db.ts'
import { criarApp } from './app.ts'
import { config } from './config.ts'
import { iniciarTarefas } from './jobs.ts'

const db = abrirBanco()
const app = await criarApp(db, { logger: true })
if (config.jobs) iniciarTarefas(db)

await app.listen({ port: config.porta, host: config.host })
const rede = Object.values(networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => `http://${i!.address}:${config.porta}`)
console.log(`\n✂️  Barbearia Roque  (WhatsApp: ${config.whatsapp.modo})`)
console.log(`   Neste computador:          http://localhost:${config.porta}`)
for (const r of rede) console.log(`   No celular (mesmo Wi-Fi):  ${r}`)
console.log('   Painel da equipe: acrescente /painel no endereço\n')

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => { await app.close(); db.close(); process.exit(0) })
}
