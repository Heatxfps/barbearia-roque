/**
 * "Banco de dados" do protótipo: salva no próprio celular (localStorage).
 * Na versão de produção isso vira um backend (ver docs/ARQUITETURA.md).
 */
import { useEffect, useState } from 'react'

export type Agendamento = {
  id: string
  servicoId: string
  profissionalId: string
  data: string // YYYY-MM-DD
  hora: string // HH:MM
  cliente: string
  telefone: string
  status: 'confirmado' | 'cancelado' | 'concluido'
  criadoEm: number
}

export type Estado = {
  cliente: { nome: string; telefone: string } | null
  agendamentos: Agendamento[]
  selos: number
}

const CHAVE = 'roque-app-v1'
const inicial: Estado = { cliente: null, agendamentos: [], selos: 6 }

function ler(): Estado {
  try {
    const s = localStorage.getItem(CHAVE)
    return s ? { ...inicial, ...JSON.parse(s) } : inicial
  } catch {
    return inicial
  }
}

let estado = ler()
const ouvintes = new Set<(e: Estado) => void>()

export function atualizar(fn: (e: Estado) => Estado) {
  estado = fn(estado)
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)) } catch { /* modo privado */ }
  ouvintes.forEach((o) => o(estado))
}

export function useEstado(): Estado {
  const [e, setE] = useState(estado)
  useEffect(() => { ouvintes.add(setE); return () => { ouvintes.delete(setE) } }, [])
  return e
}

export const novoId = () => Math.random().toString(36).slice(2, 10)
