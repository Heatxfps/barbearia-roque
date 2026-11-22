/** Histórico das mensagens de WhatsApp enviadas pelo app. */
import { useEffect, useState } from 'react'
import { api, type Mensagem } from '../../api'
import { useApp } from '../../contexto'
import { dataCurta, formatarTelefone, hora } from '../../util'

const TIPO: Record<string, string> = {
  codigo: 'Código de acesso', codigo_painel: 'Código do painel', confirmacao: 'Confirmação', lembrete_24h: 'Lembrete 24h', lembrete_1h: 'Lembrete 1h',
  cancelamento: 'Cancelamento', retorno: 'Volte a cortar', avaliacao: 'Avaliação', aniversario: 'Aniversário', espera: 'Lista de espera',
  pedido: 'Pedido', pedido_separado: 'Pedido separado', aviso_novo: 'Aviso: novo horário', aviso_cancelou: 'Aviso: cancelamento', aviso_pedido: 'Aviso: pedido',
}

export default function Mensagens() {
  const { barbearia } = useApp()
  const [lista, setLista] = useState<Mensagem[] | null>(null)
  useEffect(() => {
    const f = () => api.painel.mensagens().then(setLista).catch(() => setLista([]))
    f(); const t = setInterval(f, 10000); return () => clearInterval(t)
  }, [])
  const demo = barbearia?.whatsappModo === 'demo' || barbearia?.whatsappModo === 'offline'
  return (
    <div className="painel__col">
      <p className="suave pequeno">
        {demo ? 'Modo demonstração: as mensagens abaixo seriam enviadas pelo WhatsApp da barbearia. Ao conectar o WhatsApp, elas saem de verdade.'
          : 'Mensagens enviadas automaticamente pelo WhatsApp da barbearia.'}
      </p>
      {lista && !lista.length && <p className="vazio">Nenhuma mensagem ainda.</p>}
      <div className="mensagens">
        {lista?.map((m) => (
          <div key={m.id} className="mensagem">
            <div className="linha-entre">
              <span className="badge">{TIPO[m.tipo] ?? m.tipo}</span>
              <span className="suave pequeno">{dataCurta(m.criadoEm)} {hora(m.criadoEm)} · {formatarTelefone(m.telefone)}</span>
            </div>
            <p className="mensagem__texto">{m.tipo.startsWith('codigo') ? m.texto.replace(/\*(\d{6})\*/, '*••••••*') : m.texto}</p>
            {m.status === 'erro' && <p className="pequeno erro">Falhou: {m.erro}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
