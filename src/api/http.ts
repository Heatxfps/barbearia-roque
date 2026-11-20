/** Implementação real: conversa com o servidor (pasta server/). */
import type { Api, Barbearia, Cliente } from './tipos'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
const CH_CLIENTE = 'roque-token'
const CH_PAINEL = 'roque-token-painel'

const ler = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const gravar = (k: string, v: string | null) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch { /* modo privado */ } }

async function chamar<T>(metodo: string, caminho: string, corpo?: unknown, chaveToken = CH_CLIENTE): Promise<T> {
  const token = ler(chaveToken)
  let resp: Response
  try {
    resp = await fetch(`${BASE}/api${caminho}`, {
      method: metodo,
      headers: { ...(corpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    })
  } catch {
    throw new Error('Sem conexão com a barbearia. Verifique sua internet.')
  }
  const dados = resp.status === 204 ? null : await resp.json().catch(() => null)
  if (resp.status === 401) gravar(chaveToken, null)
  if (!resp.ok) throw new Error(dados?.erro ?? `Erro ${resp.status}`)
  return dados as T
}

const p = <T,>(m: string, c: string, b?: unknown) => chamar<T>(m, c, b, CH_PAINEL)
const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]).toString()

export const apiHttp: Api = {
  modo: 'servidor',
  barbearia: () => chamar<Barbearia>('GET', '/barbearia'),
  dias: (servico, profissional) => chamar('GET', `/dias?${qs({ servico, profissional })}`),
  horarios: async (data, servico, profissional) => (await chamar<{ horarios: string[] }>('GET', `/horarios?${qs({ data, servico, profissional })}`)).horarios,

  pedirCodigo: (telefone) => chamar('POST', '/auth/codigo', { telefone }),
  async verificar(telefone, codigo, nome) {
    const r = await chamar<{ token: string }>('POST', '/auth/verificar', { telefone, codigo, nome })
    gravar(CH_CLIENTE, r.token)
    return chamar<Cliente>('GET', '/me')
  },
  async eu() {
    if (!ler(CH_CLIENTE)) return null
    try { return await chamar<Cliente>('GET', '/me') } catch { return null }
  },
  sair: () => gravar(CH_CLIENTE, null),

  meusAgendamentos: () => chamar('GET', '/me/agendamentos'),
  agendar: (d) => chamar('POST', '/me/agendamentos', d),
  cancelar: async (id) => { await chamar('POST', `/me/agendamentos/${id}/cancelar`, {}) },

  painel: {
    logado: () => !!ler(CH_PAINEL),
    async entrar(email, senha) {
      const r = await chamar<{ token: string; usuario: never }>('POST', '/admin/login', { email, senha })
      gravar(CH_PAINEL, r.token)
      return r.usuario
    },
    sair: () => gravar(CH_PAINEL, null),
    eu: () => p('GET', '/admin/eu'),
    resumo: (data) => p('GET', `/admin/resumo?${qs({ data })}`),
    agenda: (data, profissional) => p('GET', `/admin/agenda?${qs({ data, profissional })}`),
    status: async (id, status) => { await p('PATCH', `/admin/agendamentos/${id}`, { status }) },
    encaixe: async (d) => { await p('POST', '/admin/agendamentos', d) },
    bloquear: async (d) => { await p('POST', '/admin/bloqueios', d) },
    desbloquear: async (id) => { await p('DELETE', `/admin/bloqueios/${id}`) },
    clientes: (busca) => p('GET', `/admin/clientes?${qs({ busca })}`),
    mensagens: () => p('GET', '/admin/mensagens'),
    servicos: async () => (await p<(Record<string, unknown>)[]>('GET', '/admin/servicos')).map((s) => ({ ...s, destaque: !!s.destaque, ativo: !!s.ativo })) as never,
    salvarServico: async (id, s) => { await p(id ? 'PUT' : 'POST', id ? `/admin/servicos/${id}` : '/admin/servicos', s) },
    salvarBarbearia: async (d) => { await p('PUT', '/admin/barbearia', d) },
    profissionais: async () => (await p<(Record<string, unknown>)[]>('GET', '/admin/profissionais')).map((x) => ({ ...x, ativo: !!x.ativo })) as never,
    salvarProfissional: async (id, d) => { await p('PUT', `/admin/profissionais/${id}`, d) },
    usuarios: () => p('GET', '/admin/usuarios'),
    criarUsuario: async (d) => { await p('POST', '/admin/usuarios', d) },
    removerUsuario: async (id) => { await p('DELETE', `/admin/usuarios/${id}`) },
    trocarSenha: async (atual, nova) => { await p('PUT', '/admin/senha', { atual, nova }) },
  },
}
