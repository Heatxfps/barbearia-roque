# Barbearia Roque — Aplicativo

Protótipo do aplicativo da **Barbearia Roque** (Nova Venécia/ES): agendamento online, lembretes, cartão fidelidade e painel do dono, com a identidade visual premium da casa.

> **Status:** protótipo navegável para a apresentação ao dono (v0.1). Os dados (serviços, preços, profissionais e horários) são **exemplos** e precisam ser confirmados. Veja [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

## O que já funciona

| Tela | O que faz |
|---|---|
| **Abertura** | A parede de tijolos da barbearia acende e a logo da Roque se monta peça por peça, no lugar do letreiro real. Um toque pula a animação. |
| **Início** | Saudação, botão de agendar, próximo horário, cartão fidelidade, serviços e equipe. |
| **Agendar** | Serviço → profissional (ou "sem preferência") → dia e horário → nome e WhatsApp → confirmação. |
| **Meus horários** | Próximos horários com opção de remarcar ou cancelar, além do histórico. |
| **Fidelidade** | Cartão de selos (10 cortes = 1 grátis) e convite para indicar amigos. |
| **A Roque** | Foto do espaço, WhatsApp, Instagram, como chegar e horário de funcionamento. |
| **Painel da barbearia** | Visão do dono: agenda do dia por profissional, faturamento previsto, faltas e clientes para chamar de volta (dados de demonstração). |

É um **PWA**: abre por um link e pode ser instalado na tela inicial do celular (Android e iPhone) sem passar pela loja de apps.

## Rodar no computador

Requisito: [Node.js](https://nodejs.org) 20 ou mais novo.

```powershell
npm install
```

```powershell
npm run dev
```

Abra `http://localhost:5173`. Para testar no celular na mesma rede Wi-Fi, use o endereço "Network" que aparece no terminal.

Para gerar a versão final (pasta `dist/`):

```powershell
npm run build
```

## Publicar (link para mostrar ao dono)

O repositório já tem o workflow [.github/workflows/deploy.yml](.github/workflows/deploy.yml), que publica no **GitHub Pages** a cada push na `main`.
Para ativar: **Settings → Pages → Source: GitHub Actions**.

> O GitHub Pages em repositório **privado** exige um plano pago. Alternativas: deixar o repositório público ou publicar na Vercel/Netlify (planos gratuitos, funcionam com repositório privado). Veja [docs/ARQUITETURA.md](docs/ARQUITETURA.md#publicação).

## Estrutura

```
originais/              Imagens originais enviadas (logo e foto da parede)
tools/
  separar_logo.py       Separa a logo em peças para a animação e gera os ícones
  limpar_parede.py      Remove o letreiro da foto (para a logo "acender" no lugar)
public/
  logo-partes/          Peças da logo (geradas)
  img/                  Ícones do app e fotos de fundo
  manifest.webmanifest  Configuração do PWA (nome, ícone, cores)
  sw.js                 Service worker (funciona offline)
src/
  data.ts               ⚠️ Serviços, preços, equipe, horários e contatos (EDITAR AQUI)
  agenda.ts             Cálculo de dias e horários disponíveis
  store.ts              Dados salvos no celular (protótipo)
  App.tsx               Navegação entre as telas
  components/Splash.tsx Animação de abertura
  screens/              Telas do app
  styles.css            Identidade visual e animações
docs/                   Documentação do projeto e da proposta
```

## Documentação

- [docs/PROPOSTA.md](docs/PROPOSTA.md): abordagem, roteiro da apresentação e preços
- [docs/ARQUITETURA.md](docs/ARQUITETURA.md): como o app é construído e o caminho até a versão de produção
- [docs/ANIMACAO.md](docs/ANIMACAO.md): como funciona a abertura com a logo se montando
- [docs/PENDENCIAS.md](docs/PENDENCIAS.md): o que falta confirmar com a barbearia
- [docs/ROTEIRO-DEMO.md](docs/ROTEIRO-DEMO.md): passo a passo para demonstrar o app na reunião

## Identidade visual

| Cor | Uso |
|---|---|
| `#110e0c` | Fundo (parede escura) |
| `#ece6da` | Metal creme do letreiro (textos e logo) |
| `#c8935a` / `#e2b27a` | Cobre da luz das luminárias (botões e destaques) |
| `#d3313a` / `#2f7fd6` | Vermelho e azul do poste de barbeiro (só na logo) |

Fontes: **Cinzel** (títulos, clássica) e **Inter** (textos), ambas do Google Fonts.
