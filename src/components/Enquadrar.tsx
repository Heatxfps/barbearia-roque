/**
 * Enquadrar foto antes de enviar: arrastar para posicionar e zoom (controle, rodinha do mouse ou pinça).
 * Devolve um JPEG já no tamanho final (ex.: 720×960 para barbeiro, 700×700 para produto).
 */
import { useEffect, useRef, useState } from 'react'

type Props = {
  arquivo: File
  proporcao: number                 // largura / altura do recorte
  saida: { largura: number; altura: number }
  guiaRedonda?: boolean             // mostra o círculo do avatar (barbeiro)
  titulo?: string
  aoConfirmar: (dataUrl: string) => void
  cancelar: () => void
}

export default function Enquadrar({ arquivo, proporcao, saida, guiaRedonda, titulo = 'Enquadrar foto', aoConfirmar, cancelar }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [quadro, setQuadro] = useState({ w: 300, h: 300 })
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const arraste = useRef<{ x: number; y: number; px: number; py: number } | null>(null)
  const dedos = useRef(new Map<number, { x: number; y: number }>())
  const pinca = useRef<{ dist: number; zoom: number } | null>(null)

  // tamanho do quadro na tela
  useEffect(() => {
    const largura = Math.min(340, window.innerWidth * 0.84, (window.innerHeight * 0.58) * proporcao)
    setQuadro({ w: Math.round(largura), h: Math.round(largura / proporcao) })
  }, [proporcao])

  useEffect(() => {
    const url = URL.createObjectURL(arquivo)
    const i = new Image()
    i.onload = () => setImg(i)
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [arquivo])

  const base = img ? Math.max(quadro.w / img.width, quadro.h / img.height) : 1   // escala que cobre o quadro
  const escala = base * zoom
  const largura = img ? img.width * escala : 0
  const altura = img ? img.height * escala : 0

  // mantém a foto cobrindo o quadro inteiro
  const limitar = (x: number, y: number) => ({
    x: Math.min(0, Math.max(quadro.w - largura, x)),
    y: Math.min(0, Math.max(quadro.h - altura, y)),
  })

  // centraliza ao abrir
  useEffect(() => { if (img) setPos({ x: (quadro.w - img.width * base) / 2, y: (quadro.h - img.height * base) / 2 }) }, [img, base, quadro])

  const mudarZoom = (novo: number, cx = quadro.w / 2, cy = quadro.h / 2) => {
    const z = Math.min(4, Math.max(1, novo))
    const k = z / zoom
    setZoom(z)
    setPos((p) => {
      const nx = cx - (cx - p.x) * k, ny = cy - (cy - p.y) * k
      const lw = img!.width * base * z, lh = img!.height * base * z
      return { x: Math.min(0, Math.max(quadro.w - lw, nx)), y: Math.min(0, Math.max(quadro.h - lh, ny)) }
    })
  }

  const baixar = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId)
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()]
      pinca.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      arraste.current = null
    } else arraste.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }
  }
  const mover = (e: React.PointerEvent) => {
    if (!dedos.current.has(e.pointerId)) return
    dedos.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinca.current && dedos.current.size === 2) {
      const [a, b] = [...dedos.current.values()]
      mudarZoom(pinca.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinca.current.dist))
    } else if (arraste.current) {
      setPos(limitar(arraste.current.px + e.clientX - arraste.current.x, arraste.current.py + e.clientY - arraste.current.y))
    }
  }
  const soltar = (e: React.PointerEvent) => { dedos.current.delete(e.pointerId); if (dedos.current.size < 2) pinca.current = null; arraste.current = null }

  const confirmar = () => {
    if (!img) return
    const c = document.createElement('canvas')
    c.width = saida.largura; c.height = saida.altura
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -pos.x / escala, -pos.y / escala, quadro.w / escala, quadro.h / escala, 0, 0, saida.largura, saida.altura)
    aoConfirmar(c.toDataURL('image/jpeg', 0.86))
  }

  return (
    <div className="confirmar" role="presentation">
      <div className="enquadrar" role="dialog" aria-label={titulo}>
        <p className="enquadrar__titulo">{titulo}</p>
        <div className="enquadrar__quadro" style={{ width: quadro.w, height: quadro.h }}
          onPointerDown={baixar} onPointerMove={mover} onPointerUp={soltar} onPointerCancel={soltar}
          onWheel={(e) => { const r = e.currentTarget.getBoundingClientRect(); mudarZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08), e.clientX - r.left, e.clientY - r.top) }}>
          {img ? <img src={img.src} alt="" draggable={false} style={{ left: pos.x, top: pos.y, width: largura, height: altura }} /> : <div className="carregando" />}
          {guiaRedonda && <span className="enquadrar__guia" aria-hidden="true" />}
          <span className="enquadrar__grade" aria-hidden="true" />
        </div>
        <p className="suave pequeno centro">Arraste para posicionar{guiaRedonda ? ' · o círculo é a foto pequena (avatar)' : ''}</p>
        <label className="enquadrar__zoom">
          <span aria-hidden="true">−</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => mudarZoom(Number(e.target.value))} aria-label="Zoom" />
          <span aria-hidden="true">+</span>
        </label>
        <div className="confirmar__botoes">
          <button className="botao botao--fantasma" onClick={cancelar}>Cancelar</button>
          <button className="botao botao--principal" disabled={!img} onClick={confirmar}>Usar esta foto</button>
        </div>
      </div>
    </div>
  )
}
