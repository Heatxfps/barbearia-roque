# Arquitetura (v1)

```
 Celular do cliente (PWA)        Painel (/#painel, no celular ou no computador)
          │                                   │
          └──────────────┬────────────────────┘
                         ▼  HTTPS (Caddy)
              Servidor Node.js (pasta server/)
        ┌────────────────┼──────────────────────┐
   API REST (Fastify)   Tarefas a cada minuto   Entrega o app (dist/)
        │               (lembretes, retorno)
        ▼                      │
   SQLite (/dados/roque.db)    ▼
                       WhatsApp: demo | Evolution API | Z-API
```

## Peças

| Pasta | O que é |
|---|---|
| `src/` | App React + TypeScript (Vite). Instalável (PWA) |
| `src/api/` | Camada de dados. `http.ts` fala com o servidor; `local.ts` é o modo offline/vitrine (GitHub Pages) |
| `src/screens/painel/` | Painel da barbearia |
| `server/src/` | API Node.js (Fastify) com SQLite embutido no Node (`node:sqlite`), sem dependências nativas |
| `server/test/` | Testes automáticos da API (`npm test`) |
| `deploy/`, `Dockerfile`, `docker-compose.yml` | Publicação na VPS |

**Por que SQLite?** Uma barbearia faz algumas dezenas de agendamentos por dia. O SQLite aguenta milhares por segundo, é um arquivo só (backup = copiar o arquivo) e não precisa de servidor de banco. Se um dia virar um produto para várias barbearias, a troca para Postgres é localizada em `server/src/db.ts`.

**Modos do app:**

| Comando | Dados vêm de | Uso |
|---|---|---|
| `npm run dev` | servidor local (`npm run servidor`) | desenvolvimento |
| `npm run dev:offline` / `build:offline` | o próprio celular (dados fictícios) | vitrine no GitHub Pages |
| `npm run build` (Docker) | o servidor na VPS | produção |

## Modelo de dados

| Tabela | Conteúdo |
|---|---|
| `barbearia` | Nome, cidade, endereço, WhatsApp, Instagram (chave/valor) |
| `servicos` | Nome, descrição, preço, duração, destaque, ativo |
| `profissionais` | Nome, especialidade, ativo |
| `expediente` | Por profissional e dia da semana: início, fim, intervalo |
| `bloqueios` | Folgas e horários travados |
| `clientes` | Nome, WhatsApp, último aviso de retorno |
| `agendamentos` | Cliente, profissional, serviço, início, fim, preço, status, origem (app/balcão), lembretes enviados |
| `codigos` | Códigos de login (hash, validade, tentativas) |
| `mensagens` | Todo WhatsApp enviado ou simulado |
| `usuarios` | Acesso ao painel: dono ou barbeiro |

## Regras de negócio

- **Horário livre** = expediente − intervalo − bloqueios − agendamentos ativos, respeitando a **duração** do serviço; sem horários no passado (antecedência mínima de 30 min).
- **Sem preferência**: escolhe, entre os livres, o profissional com menos atendimentos no dia.
- **Conflito**: o horário é reconferido dentro de uma transação no momento de gravar.
- **Cancelamento pelo cliente**: até 2 h antes (configurável); depois disso, só pela barbearia.
- **Fidelidade**: cada atendimento marcado como *concluído* gera 1 selo; a cada 10, 1 é grátis.
- **Limites**: no máximo 3 horários futuros por cliente.

Detalhes das rotas em [API.md](API.md). Publicação em [DEPLOY-VPS.md](DEPLOY-VPS.md).

## Custos mensais estimados

| Item | Custo |
|---|---|
| VPS 1 GB (Hostinger, Contabo, Hetzner) | ~R$ 25 a 40 |
| Domínio `.com.br` (registro.br) | ~R$ 40/ano |
| HTTPS (Let's Encrypt) | grátis |
| WhatsApp: Evolution API (na própria VPS) | grátis |
| WhatsApp: Z-API (alternativa mais estável) | ~R$ 100 |

Uma mesma VPS pode atender várias barbearias (um container por cliente).

## Próximos passos possíveis

- Tela para o dono editar **profissionais e expediente** (a API já tem: `/admin/profissionais`)
- Sinal via **Pix** para quem costuma faltar
- Planos de **assinatura** mensal
- **Lista de espera** para horários cancelados
- **Avaliação** pós-atendimento que leva ao Google Maps
- Publicação nas lojas com Capacitor (Play Store: US$ 25 uma vez; App Store: US$ 99/ano)
