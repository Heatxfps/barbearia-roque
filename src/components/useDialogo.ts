/**
 * Comportamento de diálogo acessível (confirmação, gaveta, enquadrar foto, menu "Mais"):
 *  - ao abrir, o foco vai para dentro (elemento com [data-foco] ou o primeiro controle)
 *  - Tab e Shift+Tab ficam presos no diálogo
 *  - Esc fecha
 *  - ao fechar, o foco volta para onde estava
 *  - a página por trás não rola
 */
import { useEffect, useRef, type RefObject } from 'react'

const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function useDialogo(ref: RefObject<HTMLElement | null>, fechar?: () => void) {
  const fecharRef = useRef(fechar)
  fecharRef.current = fechar

  useEffect(() => {
    const caixa = ref.current
    if (!caixa) return
    const antes = document.activeElement as HTMLElement | null
    const focaveis = () => [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)].filter((e) => e.offsetParent !== null || e === document.activeElement)
    const inicial = caixa.querySelector<HTMLElement>('[data-foco]') ?? focaveis()[0] ?? caixa
    if (inicial === caixa && !caixa.hasAttribute('tabindex')) caixa.setAttribute('tabindex', '-1')
    inicial.focus({ preventScroll: true })

    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && fecharRef.current) { e.preventDefault(); fecharRef.current(); return }
      if (e.key !== 'Tab') return
      const lista = focaveis()
      if (!lista.length) { e.preventDefault(); return }
      const primeiro = lista[0], ultimo = lista[lista.length - 1]
      const atual = document.activeElement
      if (!caixa.contains(atual)) { e.preventDefault(); primeiro.focus(); return }
      if (e.shiftKey && atual === primeiro) { e.preventDefault(); ultimo.focus() }
      else if (!e.shiftKey && atual === ultimo) { e.preventDefault(); primeiro.focus() }
    }
    document.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', tecla)
      document.body.style.overflow = overflow
      if (antes && document.contains(antes)) antes.focus({ preventScroll: true })
    }
  }, [ref])
}
