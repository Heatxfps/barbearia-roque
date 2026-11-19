# Barbearia Roque — Aplicativo

Aplicativo da **Barbearia Roque** (Nova Venécia/ES): agendamento online, login pelo WhatsApp, lembretes automáticos, cartão fidelidade e painel completo para o dono, com a identidade visual premium da casa.

> **Status:** v1.0, com app e servidor completos e testados. Serviços, preços e equipe são **exemplos** (editáveis pelo painel). Veja [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

**Vitrine (modo offline, sem servidor):** https://heatxfps.github.io/barbearia-roque/ · painel: [`/#painel`](https://heatxfps.github.io/barbearia-roque/#painel) (demo: `dono@roque.local` / `roque123`)

## O que tem

**Para o cliente (app)**
- Abertura animada: a parede da barbearia acende e a logo se monta no lugar do letreiro
- Agendamento: serviço → profissional (ou "sem preferência") → dia → horário. Respeita duração, almoço, folgas e horários ocupados
- Login **sem senha**: código de 6 dígitos no WhatsApp
- Meus horários: remarcar, cancelar (até 2 h antes) e histórico
- Cartão fidelidade com selos reais (10 atendimentos = 1 grátis)
- Informações da casa, horário de funcionamento, WhatsApp, Instagram e mapa

**Para a barbearia (painel em `/#painel`)**
- Agenda do dia por profissional, com ações: **concluído**, **faltou**, **cancelar** e WhatsApp do cliente
- Encaixe de cliente de balcão e **bloqueio** de horários (folga, médico, casa fechada)
- Números: atendimentos, previsto do dia, faturado no mês, taxa de falta, % marcado pelo app, ranking por profissional e serviço
- **Clientes para chamar de volta** (20+ dias sem vir)
- Histórico de todas as mensagens de WhatsApp
- Edição de serviços e preços (o app atualiza na hora)
- Acesso de barbeiro: cada um vê só a própria agenda

**Automático (servidor)**
- Confirmação, lembrete 24 h antes, lembrete 1 h antes, aviso de cancelamento e "volte a cortar" pelo WhatsApp

## Rodar no computador

Requisito: [Node.js](https://nodejs.org) **22.18+** (recomendado 24).

```powershell
npm install
```

```powershell
npm --prefix server install
```

Em um terminal, o servidor (com dados de demonstração):

```powershell
npm run servidor:demo
```

```powershell
npm run servidor
```

Em outro terminal, o app:

```powershell
npm run dev
```

- App: `http://localhost:5173`
- Painel: `http://localhost:5173/#painel` (padrão: `dono@roque.local` / `roque123`; troque em `server/.env`)
- No celular, na mesma rede Wi-Fi: use o endereço "Network" que o Vite mostra

Testes automáticos da API:

```powershell
npm test
```

## Publicar

- **VPS (produção):** Docker + HTTPS automático. Passo a passo em [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md)
- **GitHub Pages (vitrine):** automático a cada push na `main`, em modo offline (dados fictícios no próprio celular)

> O material comercial (proposta e preços) fica na pasta local `privado/`, que está no `.gitignore` e nunca vai para o GitHub.

## Estrutura

```
src/                     App (React + TypeScript + Vite, PWA)
  api/                   Camada de dados: http.ts (servidor) e local.ts (offline)
  screens/               Telas do cliente
  screens/painel/        Painel da barbearia
  components/Splash.tsx  Animação de abertura
server/                  API (Node.js + Fastify + SQLite)
  src/rotas/             Rotas públicas, do cliente e do painel
  src/agenda.ts          Cálculo de horários livres
  src/jobs.ts            Lembretes e "volte a cortar"
  src/whatsapp.ts        Envio (demo, Evolution API, Z-API)
  src/seed-demo.ts       Dados fictícios para apresentação
  test/                  Testes automáticos
deploy/ Dockerfile docker-compose.yml   Publicação na VPS
tools/                   Scripts que geraram as peças da logo e o fundo
originais/               Logo e foto originais
docs/                    Documentação
```

## Documentação

- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como tudo se conecta, modelo de dados, regras e custos
- [docs/API.md](docs/API.md): rotas da API
- [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md): publicar na VPS, backup e conexão do WhatsApp
- [docs/ROTEIRO-DEMO.md](docs/ROTEIRO-DEMO.md): roteiro da apresentação
- [docs/PENDENCIAS.md](docs/PENDENCIAS.md): o que confirmar com a barbearia
- [docs/ANIMACAO.md](docs/ANIMACAO.md): como funciona a abertura

## Identidade visual

| Cor | Uso |
|---|---|
| `#110e0c` | Fundo (parede escura) |
| `#ece6da` | Metal creme do letreiro (textos e logo) |
| `#c8935a` / `#e2b27a` | Cobre da luz das luminárias (botões e destaques) |
| `#d3313a` / `#2f7fd6` | Vermelho e azul do poste de barbeiro (só na logo) |

Fontes: **Cinzel** (títulos) e **Inter** (textos).
