/** Configuração via variáveis de ambiente (veja .env.example). */
import { randomBytes } from 'node:crypto'

const env = process.env

export const config = {
  porta: Number(env.PORTA ?? 3333),
  host: env.HOST ?? '0.0.0.0',
  banco: env.BANCO ?? 'dados/roque.db',
  jwtSegredo: env.JWT_SEGREDO ?? randomBytes(32).toString('hex'),
  /** origem do app (CORS). Vazio = mesma origem. Use * só em desenvolvimento. */
  origemApp: env.ORIGEM_APP ?? '*',
  /** pasta com o build do app (servida junto com a API em produção) */
  pastaApp: env.PASTA_APP ?? '../dist',

  admin: {
    email: env.ADMIN_EMAIL ?? 'dono@roque.local',
    senha: env.ADMIN_SENHA ?? 'roque123',
    nome: env.ADMIN_NOME ?? 'Luciano Roque',
  },

  whatsapp: {
    /** demo = só registra no painel | evolution = Evolution API | zapi = Z-API */
    modo: (env.WHATSAPP_MODO ?? 'demo') as 'demo' | 'evolution' | 'zapi',
    evolutionUrl: env.EVOLUTION_URL ?? '',
    evolutionInstancia: env.EVOLUTION_INSTANCIA ?? '',
    evolutionChave: env.EVOLUTION_CHAVE ?? '',
    zapiInstancia: env.ZAPI_INSTANCIA ?? '',
    zapiToken: env.ZAPI_TOKEN ?? '',
    zapiClientToken: env.ZAPI_CLIENT_TOKEN ?? '',
  },

  regras: {
    passoMin: Number(env.PASSO_MIN ?? 30),
    antecedenciaAgendarMin: Number(env.ANTECEDENCIA_AGENDAR_MIN ?? 30),
    antecedenciaCancelarMin: Number(env.ANTECEDENCIA_CANCELAR_MIN ?? 120),
    diasAgenda: Number(env.DIAS_AGENDA ?? 21),
    fidelidadeMeta: Number(env.FIDELIDADE_META ?? 10),
    diasRetorno: Number(env.DIAS_RETORNO ?? 20),
  },

  /** liga os lembretes automáticos (desligado nos testes) */
  jobs: env.JOBS !== '0',
}

if (!env.JWT_SEGREDO) console.warn('⚠️  JWT_SEGREDO não definido: usando um aleatório (logins caem ao reiniciar).')
if (!env.ADMIN_SENHA) console.warn('⚠️  ADMIN_SENHA não definida: usando a senha padrão de demonstração.')
