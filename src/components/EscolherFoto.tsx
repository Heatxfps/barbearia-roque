/** Botão de foto do painel: escolhe a imagem, abre o enquadramento e envia já recortada. */
import { useState } from 'react'
import Icone from './Icone'
import Enquadrar from './Enquadrar'
import { api } from '../api'
import { useApp } from '../contexto'
import { foto } from '../util'

type Props = {
  valor: string | null | undefined
  nome: string
  mudar: (url: string) => void
  tipo: 'barbeiro' | 'produto'
}

const FORMATOS = {
  barbeiro: { proporcao: 3 / 4, saida: { largura: 720, altura: 960 }, guiaRedonda: true, titulo: 'Enquadrar foto do barbeiro' },
  produto: { proporcao: 1, saida: { largura: 700, altura: 700 }, guiaRedonda: false, titulo: 'Enquadrar foto do produto' },
}

export default function EscolherFoto({ valor, nome, mudar, tipo }: Props) {
  const { avisar } = useApp()
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const f = FORMATOS[tipo]

  const enviar = async (dataUrl: string) => {
    setArquivo(null); setEnviando(true)
    try { mudar(await api.painel.enviarFoto(dataUrl)) } catch (e) { avisar((e as Error).message, 'erro') } finally { setEnviando(false) }
  }

  return (
    <>
      <label className={`escolher-foto ${tipo === 'produto' ? 'escolher-foto--quadrada' : ''}`}>
        {valor ? <img src={foto(valor, tipo === 'barbeiro' ? 'avatar' : 'retrato')} alt="" /> : <span className="escolher-foto__vazio">{nome.trim()[0] ?? '?'}</span>}
        <span className="escolher-foto__acao"><Icone nome="camera" tam={16} /> {enviando ? 'Enviando…' : valor ? 'Trocar foto' : 'Pôr foto'}</span>
        <input type="file" accept="image/*" hidden onChange={(e) => { const a = e.target.files?.[0]; if (a) setArquivo(a); e.target.value = '' }} />
      </label>
      {arquivo && <Enquadrar arquivo={arquivo} {...f} aoConfirmar={enviar} cancelar={() => setArquivo(null)} />}
    </>
  )
}
