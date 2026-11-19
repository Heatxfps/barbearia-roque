/**
 * Login do cliente sem senha: WhatsApp → código de 6 dígitos.
 * No modo demonstração (sem WhatsApp conectado) o código aparece na tela.
 */
import { useState } from 'react'
import { api, type Cliente } from '../api'
import { useApp } from '../contexto'

export default function Entrar({ aoEntrar, textoBotao = 'Receber código no WhatsApp' }: { aoEntrar: (c: Cliente) => void; textoBotao?: string }) {
  const { avisar, definirCliente } = useApp()
  const [etapa, setEtapa] = useState<'telefone' | 'codigo'>('telefone')
  const [tel, setTel] = useState('')
  const [nome, setNome] = useState('')
  const [codigo, setCodigo] = useState('')
  const [jaCliente, setJaCliente] = useState(false)
  const [demo, setDemo] = useState<string | undefined>()
  const [carregando, setCarregando] = useState(false)

  const telValido = tel.replace(/\D/g, '').length >= 10

  const pedir = async () => {
    setCarregando(true)
    try {
      const r = await api.pedirCodigo(tel)
      setJaCliente(r.jaCliente)
      setDemo(r.codigoDemo)
      if (r.codigoDemo) setCodigo(r.codigoDemo)
      setEtapa('codigo')
    } catch (e) { avisar((e as Error).message, 'erro') } finally { setCarregando(false) }
  }

  const verificar = async () => {
    setCarregando(true)
    try {
      const c = await api.verificar(tel, codigo, nome.trim() || undefined)
      definirCliente(c)
      aoEntrar(c)
    } catch (e) { avisar((e as Error).message, 'erro') } finally { setCarregando(false) }
  }

  if (etapa === 'telefone') {
    return (
      <div className="entrar">
        <label className="campo">
          <span>Seu WhatsApp</span>
          <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(27) 9 9999-9999" inputMode="tel" autoComplete="tel" />
        </label>
        <p className="suave pequeno">Sem senha: mandamos um código pelo WhatsApp para confirmar que é você.</p>
        <button className="botao botao--principal" disabled={!telValido || carregando} onClick={pedir}>{carregando ? 'Enviando…' : textoBotao}</button>
      </div>
    )
  }

  return (
    <div className="entrar">
      {demo && (
        <div className="demo-codigo">
          <span className="sobretitulo">Modo demonstração</span>
          <p>Na versão final o código chega no WhatsApp. Aqui ele já veio preenchido: <strong>{demo}</strong></p>
        </div>
      )}
      {!jaCliente && (
        <label className="campo">
          <span>Seu nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como podemos te chamar?" autoComplete="name" />
        </label>
      )}
      <label className="campo">
        <span>Código de 6 dígitos</span>
        <input className="campo-codigo" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" />
      </label>
      <button className="botao botao--principal" disabled={codigo.length !== 6 || (!jaCliente && nome.trim().length < 2) || carregando} onClick={verificar}>
        {carregando ? 'Conferindo…' : 'Confirmar'}
      </button>
      <button className="link" onClick={() => { setEtapa('telefone'); setCodigo('') }}>Trocar número</button>
    </div>
  )
}
