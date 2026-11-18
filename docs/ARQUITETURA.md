# Arquitetura

## Hoje: protótipo (v0.1)

- **React 18 + TypeScript + Vite**: app de página única, leve (~55 KB compactado).
- **PWA**: `manifest.webmanifest` + `sw.js`, instalável na tela inicial e funcionando offline.
- **Dados no próprio celular** (`localStorage`, em `src/store.ts`): cada aparelho vê só os próprios agendamentos. Serve para a demonstração, **não** para uso real.
- **Horários ocupados fictícios** (`src/agenda.ts`): uma parte dos horários aparece como ocupada para a agenda parecer real.
- Sem dependências além de React (ícones em SVG próprio, navegação própria).

### Limitações conhecidas do protótipo

- Agendamentos não chegam à barbearia: não existe servidor ainda.
- A duração do serviço não bloqueia os horários seguintes (um combo de 70 min ocupa só o horário inicial).
- Os lembretes de WhatsApp são apenas texto na tela de confirmação.
- O painel do dono usa números de demonstração.
- Não há login: o cliente é identificado pelo nome e WhatsApp salvos no aparelho.

## Próximo passo: versão de produção (v1)

```
 Celular do cliente (PWA)         Painel da barbearia (PWA, login)
          │                                   │
          └──────────────┬────────────────────┘
                         ▼
                 Backend (Supabase)
     ┌───────────────────┼─────────────────────┐
  Banco Postgres     Autenticação        Funções agendadas
  (agenda, clientes,  (código SMS/        (lembretes 24h e 1h,
   serviços, selos)    WhatsApp)           "volte a cortar")
                                                │
                                                ▼
                                    API do WhatsApp (Z-API / Meta)
```

**Sugestão de tecnologia:** Supabase (banco Postgres + login + funções), plano gratuito no começo. Firebase é uma alternativa equivalente.

### Modelo de dados (v1)

| Tabela | Campos principais |
|---|---|
| `profissionais` | id, nome, foto, especialidade, ativo, comissão % |
| `servicos` | id, nome, descrição, preço, duração, ativo |
| `expediente` | profissional, dia da semana, início, fim, intervalo |
| `bloqueios` | profissional, início, fim, motivo (folga, almoço, férias) |
| `clientes` | id, nome, telefone, aniversário, criado em |
| `agendamentos` | id, cliente, profissional, serviço, início, fim, status (confirmado / concluído / faltou / cancelado), origem (app / balcão) |
| `selos` | cliente, agendamento, data |

### Regras de negócio a implementar

- Horário livre = expediente − bloqueios − agendamentos, respeitando a **duração** do serviço.
- Cancelamento pelo cliente até X horas antes (definir com o dono).
- Selo de fidelidade só quando o atendimento é marcado como **concluído**.
- "Sem preferência" escolhe o profissional com menos atendimentos no dia.
- Lembretes: 24 h e 1 h antes; "faz 20 dias do seu corte" (ajustável).

### Custos mensais estimados (para o preço da proposta)

| Item | Custo |
|---|---|
| Hospedagem do app (Vercel/Netlify/GitHub Pages) | R$ 0 |
| Supabase (plano gratuito; o pago custa ~US$ 25/mês) | R$ 0 a ~R$ 150 |
| WhatsApp (Z-API ~R$ 100/mês, ou API oficial da Meta cobrada por mensagem) | ~R$ 50 a 120 |
| Domínio próprio (ex.: `barbeariaroque.com.br`) | ~R$ 40/ano |

## Publicação

| Opção | Repositório privado? | Observação |
|---|---|---|
| **GitHub Pages** | Só em plano pago | Workflow já pronto em `.github/workflows/deploy.yml` |
| **Vercel** | ✅ grátis | Importar o repositório; build `npm run build`, saída `dist` |
| **Netlify** | ✅ grátis | Mesma configuração |

## Lojas de aplicativos (fase 2, opcional)

O mesmo código pode ser empacotado com **Capacitor** para Play Store (taxa única de US$ 25) e App Store (US$ 99/ano + precisa de um Mac ou serviço de build na nuvem).
