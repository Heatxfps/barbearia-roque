/**
 * Tela de abertura: a parede de tijolos da barbearia "acende" e a logo da
 * Roque se monta peça por peça (escudo, navalhas, BARBEARIA, R, poste,
 * tesoura e ROQUE), terminando com um brilho metálico.
 * As peças são geradas por tools/separar_logo.py.
 */
import { useCallback, useEffect, useState } from 'react'

const B = import.meta.env.BASE_URL
const parte = (n: string) => `${B}logo-partes/${n}.png`

const IMAGENS = [
  `${B}img/parede-sem-letreiro.jpg`,
  ...['escudo', 'navalhas', 'r', 'poste', 'tesoura', 'logo-completa'].map(parte),
  ...Array.from({ length: 9 }, (_, i) => parte(`barbearia-${i + 1}`)),
  ...Array.from({ length: 5 }, (_, i) => parte(`roque-${i + 1}`)),
]

type Props = { onFim: () => void }

export default function Splash({ onFim }: Props) {
  const [pronto, setPronto] = useState(false)
  const [saindo, setSaindo] = useState(false)

  // só começa a animação quando todas as peças carregaram (4G lento)
  useEffect(() => {
    let vivo = true
    const carregar = (src: string) => new Promise<void>((ok) => { const i = new Image(); i.onload = i.onerror = () => ok(); i.src = src })
    const limite = setTimeout(() => vivo && setPronto(true), 4000)
    Promise.all(IMAGENS.map(carregar)).then(() => vivo && setPronto(true))
    return () => { vivo = false; clearTimeout(limite) }
  }, [])

  useEffect(() => {
    if (!pronto) return
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t1 = setTimeout(() => setSaindo(true), reduzido ? 900 : 5800)
    const t2 = setTimeout(onFim, reduzido ? 1300 : 6400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [pronto, onFim])

  const pular = useCallback(() => { setSaindo(true); setTimeout(onFim, 450) }, [onFim])
  // dá para pular a qualquer momento: toque, clique, Esc, Enter ou espaço
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(e.key)) { e.preventDefault(); pular() } }
    window.addEventListener('keydown', tecla); return () => window.removeEventListener('keydown', tecla)
  }, [pular])

  return (
    <div className={`splash ${pronto ? 'splash--pronto' : ''} ${saindo ? 'splash--saindo' : ''}`} onClick={pular} role="button" tabIndex={0} aria-label="Barbearia Roque. Toque para entrar">
      <div className="splash__palco">
      <div className="splash__fundo" style={{ backgroundImage: `url(${B}img/parede-sem-letreiro.jpg)` }} />
      <div className="splash__luz splash__luz--1" />
      <div className="splash__luz splash__luz--2" />
      <div className="splash__vinheta" />

      <div className="logo-montagem">
        <img className="lp lp-escudo" src={parte('escudo')} alt="" />
        <img className="lp lp-navalhas" src={parte('navalhas')} alt="" />
        {Array.from({ length: 9 }, (_, i) => (
          <img key={i} className="lp lp-letra-b" style={{ ['--i' as string]: i }} src={parte(`barbearia-${i + 1}`)} alt="" />
        ))}
        <img className="lp lp-r" src={parte('r')} alt="" />
        <img className="lp lp-poste" src={parte('poste')} alt="" />
        <img className="lp lp-tesoura" src={parte('tesoura')} alt="" />
        {Array.from({ length: 5 }, (_, i) => (
          <img key={i} className="lp lp-letra-r" style={{ ['--i' as string]: i }} src={parte(`roque-${i + 1}`)} alt="" />
        ))}
        <div className="lp lp-brilho" style={{ WebkitMaskImage: `url(${parte('logo-completa')})`, maskImage: `url(${parte('logo-completa')})` }} />
      </div>
      </div>

      <p className="splash__cidade">Nova Venécia · ES</p>
      <span className="splash__pular">toque para pular</span>
    </div>
  )
}
