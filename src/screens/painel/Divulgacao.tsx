/**
 * Divulgação: link do app, QR code, textos prontos para o WhatsApp Business e o Instagram,
 * e um cartaz para imprimir e deixar no balcão.
 * Hoje os clientes marcam pelo WhatsApp: a mensagem automática é o que leva cada um para o app.
 */
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Icone from '../../components/Icone'
import { useApp } from '../../contexto'

const B = import.meta.env.BASE_URL

export default function Divulgacao() {
  const { barbearia, avisar } = useApp()
  const link = new URL(B, location.origin).href
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toString(link, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#16110cff', light: '#00000000' } })
      .then(setQr).catch(() => setQr(''))
  }, [link])

  if (!barbearia) return null
  const nome = barbearia.nome
  const textos = [
    {
      titulo: 'Mensagem de saudação do WhatsApp Business',
      dica: 'WhatsApp Business → Ferramentas comerciais → Mensagem de saudação. Quem chamar a barbearia recebe o link na hora, mesmo com vocês no meio de um corte.',
      texto: `Olá! Que bom falar com a *${nome}* ✂️\n\nPara marcar seu horário em segundos, escolha o barbeiro e o horário direto no nosso app:\n${link}\n\nSe preferir, deixe sua mensagem que respondemos assim que sairmos da cadeira.`,
    },
    {
      titulo: 'Mensagem de ausência (fora do expediente)',
      dica: 'WhatsApp Business → Ferramentas comerciais → Mensagem de ausência → "Fora do horário comercial".',
      texto: `Estamos fechados agora, mas a agenda da *${nome}* funciona 24h 🕐\nMarque seu horário pelo app: ${link}`,
    },
    {
      titulo: 'Bio do Instagram',
      dica: 'Cole no perfil e use o link como "link na bio".',
      texto: `✂️ Barbearia clássica em ${barbearia.cidade.split(' - ')[0]}\n📲 Agende pelo app: ${link}`,
    },
  ]

  const copiar = async (t: string, o: string) => {
    try { await navigator.clipboard.writeText(t); avisar(`${o} copiado`) } catch { avisar('Não deu para copiar. Selecione o texto e copie.', 'erro') }
  }
  const compartilhar = async () => {
    if (navigator.share) { try { await navigator.share({ title: nome, text: `Agende seu horário na ${nome}`, url: link }) } catch { /* cancelado */ } }
    else copiar(link, 'Link')
  }

  return (
    <div className="painel__grade">
      <section className="painel__col">
        <div className="cartao divulga-link">
          <p className="sobretitulo">Link do app</p>
          <strong className="divulga-link__url">{link.replace(/^https?:\/\//, '')}</strong>
          <div className="acoes">
            <button className="botao botao--principal pequeno" onClick={() => copiar(link, 'Link')}>Copiar link</button>
            <button className="botao botao--fantasma pequeno" onClick={compartilhar}><Icone nome="whats" tam={18} /> Compartilhar</button>
          </div>
          {link.includes('localhost') && <p className="suave pequeno">Este é o endereço deste computador. Na VPS, com o domínio, o link e o QR code mudam sozinhos.</p>}
        </div>

        {textos.map((t) => (
          <div key={t.titulo} className="cartao">
            <div className="linha-entre"><h3>{t.titulo}</h3><button className="chip" onClick={() => copiar(t.texto, 'Texto')}>Copiar</button></div>
            <p className="mensagem__texto">{t.texto.replace(/\*/g, '')}</p>
            <p className="suave pequeno">{t.dica}</p>
          </div>
        ))}
      </section>

      <aside className="painel__col">
        <div className="cartaz" aria-label="Cartaz para o balcão">
          <img className="cartaz__logo" src={`${B}logo-partes/logo-completa.png`} alt={nome} />
          <p className="cartaz__chamada">Agende seu horário<br /><em>pelo celular</em></p>
          <div className="cartaz__qr" dangerouslySetInnerHTML={{ __html: qr }} />
          <p className="cartaz__passo">Aponte a câmera para o código</p>
          <p className="cartaz__link">{link.replace(/^https?:\/\//, '').replace(/\/$/, '')}</p>
        </div>
        <button className="botao botao--fantasma" onClick={() => window.print()}><Icone nome="painel" tam={18} /> Imprimir cartaz</button>
        <p className="suave pequeno centro">Imprima em A4 ou A5 e deixe no balcão e no espelho. Quem escanear já cai na agenda da Roque.</p>
      </aside>
    </div>
  )
}
