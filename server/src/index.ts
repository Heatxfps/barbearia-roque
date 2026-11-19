/** Inicia a API da Barbearia Roque. */
import { abrirBanco } from './db.ts'
import { criarApp } from './app.ts'
import { config } from './config.ts'
import { iniciarTarefas } from './jobs.ts'

const db = abrirBanco()
const app = await criarApp(db, { logger: true })
if (config.jobs) iniciarTarefas(db)

await app.listen({ port: config.porta, host: config.host })
console.log(`\n✂️  Barbearia Roque — API em http://localhost:${config.porta}  (WhatsApp: ${config.whatsapp.modo})\n`)

for (const sinal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sinal, async () => { await app.close(); db.close(); process.exit(0) })
}
