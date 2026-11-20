/**
 * Envio de WhatsApp com três modos:
 *  - demo:      não envia nada; registra a mensagem para aparecer no painel do dono
 *  - evolution: Evolution API (gratuita, roda na própria VPS, conecta via QR code)
 *  - zapi:      Z-API (serviço pago brasileiro, ~R$ 100/mês)
 * Toda mensagem fica registrada na tabela `mensagens`.
 */
import type { DB } from './db.ts'
import { novoId } from './db.ts'
import { config } from './config.ts'
import { agora, carimbo } from './tempo.ts'

export type TipoMensagem = 'codigo' | 'confirmacao' | 'lembrete_24h' | 'lembrete_1h' | 'cancelamento' | 'retorno' | 'aviso_novo' | 'aviso_cancelou' | 'avaliacao' | 'aniversario' | 'espera' | 'pedido' | 'pedido_separado' | 'aviso_pedido'

async function enviarDeVerdade(telefone: string, texto: string): Promise<void> {
  const w = config.whatsapp
  let resp: Response
  if (w.modo === 'evolution') {
    resp = await fetch(`${w.evolutionUrl.replace(/\/$/, '')}/message/sendText/${encodeURIComponent(w.evolutionInstancia)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: w.evolutionChave },
      body: JSON.stringify({ number: telefone, text: texto }),
    })
  } else if (w.modo === 'zapi') {
    resp = await fetch(`https://api.z-api.io/instances/${w.zapiInstancia}/token/${w.zapiToken}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Client-Token': w.zapiClientToken },
      body: JSON.stringify({ phone: telefone, message: texto }),
    })
  } else return
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).slice(0, 200)}`)
}

export async function enviarWhatsApp(db: DB, telefone: string, tipo: TipoMensagem, texto: string) {
  const id = novoId()
  const demo = config.whatsapp.modo === 'demo'
  db.prepare('INSERT INTO mensagens (id, telefone, tipo, texto, status, criado_em) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, telefone, tipo, texto, demo ? 'demo' : 'enviando', carimbo(agora()))
  if (demo) return
  try {
    await enviarDeVerdade(telefone, texto)
    db.prepare("UPDATE mensagens SET status = 'enviado' WHERE id = ?").run(id)
  } catch (e) {
    db.prepare("UPDATE mensagens SET status = 'erro', erro = ? WHERE id = ?").run(String(e), id)
    console.error('Falha no WhatsApp:', e)
  }
}
