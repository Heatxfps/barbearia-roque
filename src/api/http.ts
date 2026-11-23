/** Implementação real: conversa com o servidor (pasta server/). */
import type { Api, Barbearia, Cliente, UsuarioPainel } from './tipos'

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
  async verificar(telefone, codigo, nome, aniversario) {
    const r = await chamar<{ token?: string; novo?: true }>('POST', '/auth/verificar', { telefone, codigo, nome, aniversario })
    if (r.novo) return { novo: true }
    gravar(CH_CLIENTE, r.token!)
    return chamar<Cliente>('GET', '/me')
  },
  meusDados: () => chamar('GET', '/me/dados'),
  excluirConta: async () => { await chamar('DELETE', '/me'); gravar(CH_CLIENTE, null) },
  async eu() {
    if (!ler(CH_CLIENTE)) return null
    try { return await chamar<Cliente>('GET', '/me') } catch { return null }
  },
  sair: () => gravar(CH_CLIENTE, null),
  atualizarPerfil: async (d) => { await chamar('PUT', '/me', d) },

  meusAgendamentos: () => chamar('GET', '/me/agendamentos'),
  agendar: (d) => chamar('POST', '/me/agendamentos', d),
  cancelar: async (id, remarcar = false) => { await chamar('POST', `/me/agendamentos/${id}/cancelar`, { remarcar }) },
  convite: (id) => chamar('GET', `/adiantar/${encodeURIComponent(id)}`),
  adiantar: (id) => chamar('POST', `/adiantar/${encodeURIComponent(id)}`, {}),

  minhaEspera: () => chamar('GET', '/me/espera'),
  entrarEspera: (d) => chamar('POST', '/me/espera', d),
  sairEspera: async (id) => { await chamar('DELETE', `/me/espera/${id}`) },

  produtos: () => chamar('GET', '/produtos'),
  pedir: (itens, observacao) => chamar('POST', '/me/pedidos', { itens, observacao }),
  meusPedidos: () => chamar('GET', '/me/pedidos'),
  cancelarPedido: async (id) => { await chamar('POST', `/me/pedidos/${id}/cancelar`, {}) },

  avaliacao: (id) => chamar('GET', `/avaliacao/${encodeURIComponent(id)}`),
  avaliar: async (id, nota, comentario) => { await chamar('POST', `/avaliacao/${encodeURIComponent(id)}`, { nota, comentario }) },

  painel: {
    logado: () => !!ler(CH_PAINEL),
    async entrar(email, senha, lembrar) {
      const r = await chamar<{ token?: string; usuario?: UsuarioPainel; etapa?: 'codigo'; desafio?: string; destino?: string; codigoDemo?: string }>(
        'POST', '/admin/login', { email, senha, lembrar })
      if (r.etapa === 'codigo') return { etapa: 'codigo', desafio: r.desafio!, destino: r.destino!, codigoDemo: r.codigoDemo }
      gravar(CH_PAINEL, r.token!)
      return { usuario: r.usuario! }
    },
    async confirmarCodigo(desafio, codigo) {
      const r = await chamar<{ token: string; usuario: UsuarioPainel }>('POST', '/admin/login/codigo', { desafio, codigo })
      gravar(CH_PAINEL, r.token)
      return r.usuario
    },
    retorno: () => p('GET', '/admin/retorno'),
    aniversariantes: () => p('GET', '/admin/aniversariantes'),
    salvarSeguranca: async (senha, telefone) => { await p('PUT', '/admin/seguranca', { senha, telefone }) },
    sair: () => gravar(CH_PAINEL, null),
    eu: () => p('GET', '/admin/eu'),
    resumo: (data) => p('GET', `/admin/resumo?${qs({ data })}`),
    agenda: (data, profissional) => p('GET', `/admin/agenda?${qs({ data, profissional })}`),
    removerEspera: async (id) => { await p('DELETE', `/admin/espera/${id}`) },
    avaliacoes: () => p('GET', '/admin/avaliacoes'),
    pedidos: (todos) => p('GET', `/admin/pedidos?status=${todos ? 'todos' : 'abertos'}`),
    statusPedido: async (id, status) => { await p('PATCH', `/admin/pedidos/${id}`, { status }) },
    status: (id, status) => p('PATCH', `/admin/agendamentos/${id}`, { status }),
    lembretes: () => p('GET', '/admin/lembretes'),
    lembrar: async (id) => { await p('POST', `/admin/agendamentos/${id}/lembrar`, {}) },
    encaixe: async (d) => { await p('POST', '/admin/agendamentos', d) },
    bloquear: async (d) => { await p('POST', '/admin/bloqueios', d) },
    desbloquear: async (id) => { await p('DELETE', `/admin/bloqueios/${id}`) },
    clientes: (busca) => p('GET', `/admin/clientes?${qs({ busca })}`),
    mensagens: (status = 'todas') => p('GET', `/admin/mensagens?status=${status}`),
    modelos: () => p('GET', '/admin/modelos'),
    salvarModelo: async (chave, d) => { await p('PUT', `/admin/modelos/${chave}`, d) },
    automacoes: () => p('GET', '/admin/automacoes'),
    salvarAutomacao: async (id, d) => { await p(id ? 'PUT' : 'POST', id ? `/admin/automacoes/${id}` : '/admin/automacoes', d) },
    removerAutomacao: async (id) => { await p('DELETE', `/admin/automacoes/${id}`) },
    servicos: async () => (await p<(Record<string, unknown>)[]>('GET', '/admin/servicos')).map((s) => ({ ...s, destaque: !!s.destaque, ativo: !!s.ativo })) as never,
    salvarServico: async (id, s) => { await p(id ? 'PUT' : 'POST', id ? `/admin/servicos/${id}` : '/admin/servicos', s) },
    salvarBarbearia: async (d) => { await p('PUT', '/admin/barbearia', d) },
    profissionais: async () => (await p<(Record<string, unknown>)[]>('GET', '/admin/profissionais')).map((x) => ({ ...x, ativo: !!x.ativo })) as never,
    salvarProfissional: async (id, d) => { await p('PUT', `/admin/profissionais/${id}`, d) },
    criarProfissional: async (d) => { await p('POST', '/admin/profissionais', d) },
    removerProfissional: async (id) => { await p('DELETE', `/admin/profissionais/${id}`) },
    enviarFoto: async (imagem) => (await p<{ url: string }>('POST', '/admin/fotos', { imagem })).url,
    produtosPainel: () => p('GET', '/admin/produtos'),
    salvarProduto: async (id, d) => { await p(id ? 'PUT' : 'POST', id ? `/admin/produtos/${id}` : '/admin/produtos', d) },
    removerProduto: async (id) => { await p('DELETE', `/admin/produtos/${id}`) },
    usuarios: () => p('GET', '/admin/usuarios'),
    criarUsuario: async (d) => { await p('POST', '/admin/usuarios', d) },
    removerUsuario: async (id) => { await p('DELETE', `/admin/usuarios/${id}`) },
    trocarSenha: async (atual, nova) => { gravar(CH_PAINEL, (await p<{ token: string }>('PUT', '/admin/senha', { atual, nova })).token) },
  },
}
