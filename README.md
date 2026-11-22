# Barbearia Roque — Aplicativo

Aplicativo da **Barbearia Roque** (Nova Venécia/ES): agendamento online, login pelo WhatsApp, lembretes automáticos, cartão fidelidade e painel completo para o dono, com a identidade visual premium da casa.

> **Status:** v1.2 premium, com app, painel e servidor completos e testados. Equipe real (Daniel Andrade e Guilherme Moreira) e fundador (Luciano Roque). Serviços e preços ainda são **exemplos**, editáveis pelo painel. Veja [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

**Vitrine (modo offline, sem servidor):** https://heatxfps.github.io/barbearia-roque/ · painel da equipe: [`painel.html`](https://heatxfps.github.io/barbearia-roque/painel.html) (demo: `dono@roque.local` / `roque123`)

## O que tem

**Para o cliente (app)**
- Abertura animada: a parede da barbearia acende e a logo se monta no lugar do letreiro, e a tela inicial continua na mesma parede
- Visual editorial premium: retratos dos barbeiros, serviços em formato de cardápio, detalhes em dourado
- Agendamento: serviço → barbeiro (ou "sem preferência") → dia → horário, ou direto pela foto do barbeiro. Respeita duração, almoço, folgas e horários ocupados
- Login **sem senha**: código de 6 dígitos no WhatsApp
- Meus horários: remarcar, cancelar (até 2 h antes) e histórico
- Cartão fidelidade com selos reais (10 atendimentos = 1 grátis)
- **Dia do Noivo**: página com o vídeo do making of atrás do título e pedido de orçamento pronto no WhatsApp
- **Loja**: o cliente reserva pomada, óleo etc. e retira (e paga) na barbearia
- **Lista de espera**: dia lotado → entra na fila e é avisado no WhatsApp se abrir vaga
- **Avaliação** depois do atendimento (estrelas + comentário) com convite para avaliar no Google
- **Aniversário**: cadastra o dia e ganha um desconto que entra sozinho no próximo horário
- A Roque: fundador, horário de funcionamento, WhatsApp, Instagram e mapa

**Para a barbearia (painel da equipe, fora do app do cliente)**

O painel é uma página própria: `painel.SEU-DOMINIO` na VPS, `localhost:3333/painel` no computador. Pode ser instalado no celular dos barbeiros ou num tablet do balcão como um app à parte ("Roque · Painel"). O app do cliente não tem botão nem código do painel.

- **Mensagens:** canvas com a jornada do cliente (da marcação à volta); cada mensagem do WhatsApp tem texto editável com variáveis, tempo ajustável e liga/desliga, e dá para **criar mensagens automáticas novas** (antes do horário, depois do atendimento, dias depois, 1ª visita). Abas de *Próximas* (o que vai sair nos próximos 7 dias), *Enviadas* e *Falharam*
- **Fotos:** ao escolher a foto de um barbeiro ou produto, abre um enquadramento (arrastar e zoom)
- **Seções:** *Dia a dia* (Agenda, Loja) · *Clientes* (Clientes, Avaliações, Mensagens) · *Gestão* (Resultados, Divulgação, Ajustes). Menu lateral no computador; barra inferior + "Mais" no celular
- **Quem vê o quê:** a equipe toda vê tudo, menos **Resultados** (financeiro), que é só do dono. Em Ajustes o barbeiro só troca a própria senha
- **Segurança:** acesso expira em 12 h (ou 30 dias com "manter conectado neste aparelho"); barbeiro novo troca a senha no 1º acesso; o dono pode exigir um **código no WhatsApp** ao entrar
- **Agenda conjunta**: uma coluna por barbeiro, com foto, e ações **concluído**, **faltou**, **cancelar** e WhatsApp do cliente; lista de espera do dia
- **Avaliações**: média geral, por barbeiro e os últimos comentários
- **Loja**: pedidos para separar ("separado" avisa o cliente) e cadastro de produtos com foto
- Encaixe de cliente de balcão e **bloqueio** de horários (folga, médico, casa fechada)
- Números: atendimentos, previsto do dia, faturado no mês, taxa de falta, % marcado pelo app, ranking por profissional e serviço
- **Clientes para chamar de volta** (20+ dias sem vir)
- Histórico de todas as mensagens de WhatsApp
- **Divulgação**: link e QR code do app, cartaz para imprimir e textos prontos para a saudação do WhatsApp Business e a bio do Instagram
- **Ajustes**: dados da barbearia (link do Google, % do aniversário), serviços e preços, **adicionar e excluir barbeiro com foto**, horários de cada um, acessos e troca de senha (o app atualiza na hora)
- Acesso de barbeiro: veem e mexem na agenda da casa toda, mas não no faturamento nem nos ajustes

**Automático (servidor)**
- Para o cliente: confirmação, lembrete 24 h antes, lembrete 1 h antes, aviso de cancelamento e "volte a cortar" pelo WhatsApp
- Para o cliente: convite para avaliar (1 h depois do atendimento), cupom no aniversário e aviso de vaga da lista de espera
- Para a barbearia: aviso no WhatsApp da casa a cada horário marcado ou cancelado e a cada pedido da loja

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
- Painel da equipe: `http://localhost:5173/painel.html` (no modo `npm run local`: `http://localhost:3333/painel`). Demonstração: `dono@roque.local` / `roque123`
- No celular, na mesma rede Wi-Fi: use o endereço "Network" que o Vite mostra

### Servidor local no modo produção

Um terminal só, igual vai rodar na VPS: o servidor entrega o app pronto e a API no mesmo endereço.

```powershell
npm run local
```

Ele mostra os endereços para abrir no computador e no celular (mesmo Wi-Fi), por exemplo `http://192.168.1.15:3333`. Na primeira vez o Windows pode pedir para liberar o Node no firewall: aceite para **redes privadas**.

Para ter senha e segredo próprios em vez dos de demonstração, gere o `server/.env` uma vez:

```powershell
npm --prefix server run configurar -- --email dono@roque.local
```

> No celular, pelo IP local, o app abre e agenda normalmente, mas não dá para "instalar" na tela inicial: isso exige HTTPS, que vem com a VPS e o domínio.

Testes automáticos da API:

```powershell
npm test
```

## Publicar

- **VPS (produção):** um script instala tudo (Docker, HTTPS automático, backup diário): `sudo bash deploy/instalar.sh`. Passo a passo em [docs/DEPLOY-VPS.md](docs/DEPLOY-VPS.md)
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
  src/configurar.ts      Gera o server/.env com segredos novos
  test/                  Testes automáticos
deploy/instalar.sh      Instalação completa na VPS
deploy/backup.sh         Backup do banco (roda todo dia pelo cron)
Dockerfile docker-compose.yml deploy/Caddyfile   Contêineres e HTTPS
tools/                   Scripts das peças da logo e das fotos da equipe
originais/               Logo, fotos da parede (e da equipe, fora do Git)
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

Fontes: **Cormorant Garamond** (títulos editoriais e preços), **Cinzel** (rótulos em caixa alta) e **Inter** (textos).
