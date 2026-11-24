/**
 * Divulgação: link do app, QR code, textos prontos para o WhatsApp Business e o Instagram,
 * e um cartaz para imprimir e deixar no balcão.
 * Hoje os clientes marcam pelo WhatsApp: a mensagem automática é o que leva cada um para o app.
 */
import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import Icone from '../../components/Icone'
import { useApp } from '../../contexto'
import { api, type ModeloMsg, type UsuarioPainel } from '../../api'
import { VARIAVEIS, preencher } from '../../../shared/modelos'

const B = import.meta.env.BASE_URL

/** cada texto leva o link com a origem, para o Funil saber de onde a pessoa veio */
const ORIGEM_TEXTO: Record<string, string> = { div_saudacao: 'whatsapp', div_ausencia: 'whatsapp', div_bio: 'instagram' }

export default function Divulgacao({ usuario }: { usuario: UsuarioPainel }) {
  const { barbearia, avisar } = useApp()
  const dono = usuario.papel === 'dono'
  const [modelos, setModelos] = useState<ModeloMsg[] | null>(null)
  const [editando, setEditando] = useState<string | null>(null)
  const carregar = useCallback(() => { api.painel.modelos().then(setModelos).catch(() => setModelos([])) }, [])
  useEffect(() => { carregar() }, [carregar])
  // o painel fica em outro endereço: o link divulgado é sempre o do app do cliente
  const link = (barbearia?.urlApp ? `${barbearia.urlApp.replace(/\/$/, '')}/` : new URL('./', location.href).href)
  const comOrigem = (o: string) => `${link}?o=${o}`
  const [qr, setQr] = useState('')

  useEffect(() => {
    QRCode.toString(`${link}?o=qr`, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#16110cff', light: '#00000000' } })
      .then(setQr).catch(() => setQr(''))
  }, [link])

  if (!barbearia) return null
  const nome = barbearia.nome
  const vars = { barbearia: nome, link, cidade: barbearia.cidade.split(' - ')[0] }
  const varsDe = (chave: string) => (ORIGEM_TEXTO[chave] ? { ...vars, link: comOrigem(ORIGEM_TEXTO[chave]) } : vars)
  const textos = (modelos ?? []).filter((m) => m.grupo === 'divulgacao')
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

        {!modelos && <div className="cartao cartao--esqueleto" />}
        {textos.map((t) => editando === t.chave ? (
          <EditarTexto key={t.chave} m={t} vars={varsDe(t.chave)} fechar={() => setEditando(null)} salvo={() => { setEditando(null); carregar() }} />
        ) : (
          <div key={t.chave} className="cartao">
            <div className="linha-entre">
              <h3>{t.nome}</h3>
              <div className="evento__acoes">
                {dono && <button className="chip" onClick={() => setEditando(t.chave)}>Editar</button>}
                <button className="chip chip--ok" onClick={() => copiar(preencher(t.texto, varsDe(t.chave)), 'Texto')}>Copiar</button>
              </div>
            </div>
            <p className="mensagem__texto">{preencher(t.texto, varsDe(t.chave)).replace(/\*/g, '')}</p>
            <p className="suave pequeno">{t.descricao}{ORIGEM_TEXTO[t.chave] ? ' O link já marca no Funil quem veio por aqui.' : ''}</p>
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
        <p className="suave pequeno centro">Imprima em A4 ou A5 e deixe no balcão e no espelho. Quem escanear já cai na agenda da Roque, e o Funil mostra quantos vieram pelo cartaz.</p>
      </aside>
    </div>
  )
}

/** Editar um texto de divulgação (só o dono) */
function EditarTexto({ m, vars, fechar, salvo }: { m: ModeloMsg; vars: Record<string, string>; fechar: () => void; salvo: () => void }) {
  const { avisar } = useApp()
  const [texto, setTexto] = useState(m.texto)
  const salvar = async (t: string | null) => {
    try { await api.painel.salvarModelo(m.chave, { texto: t }); avisar(t === null ? 'Texto original restaurado' : 'Texto salvo'); salvo() } catch (e) { avisar((e as Error).message, 'erro') }
  }
  return (
    <div className="cartao form">
      <h3>{m.nome}</h3>
      <label className="campo"><span>Texto</span><textarea rows={6} value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 1000))} /></label>
      <div className="variaveis">
        <span className="suave pequeno">Inserir:</span>
        {m.variaveis.map((v) => <button key={v} type="button" className="chip" onClick={() => setTexto(texto + `{${v}}`)}>{VARIAVEIS[v]?.rotulo ?? v}</button>)}
      </div>
      <div className="previa"><span className="suave pequeno">Como fica</span><p className="mensagem__texto">{preencher(texto, vars).replace(/\*/g, '')}</p></div>
      <div className="acoes">
        <button className="botao botao--principal pequeno" disabled={texto.trim().length < 5} onClick={() => salvar(texto)}>Salvar</button>
        <button className="botao botao--fantasma pequeno" onClick={fechar}>Cancelar</button>
        {texto !== m.padrao && <button className="botao botao--fantasma pequeno acoes__direita" onClick={() => salvar(null)}>Restaurar original</button>}
      </div>
    </div>
  )
}
