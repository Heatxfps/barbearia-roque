# Animação de abertura

**Ideia:** o cliente abre o app e é como se estivesse dentro da Roque. A parede de tijolos está no escuro, as luminárias acendem (com uma leve "piscada", como lâmpada de verdade) e a logo se monta peça por peça **exatamente no lugar onde fica o letreiro** na parede.

## Linha do tempo (~6 s)

| Tempo | O que acontece |
|---|---|
| 0,2 s | Luminárias acendem com piscadas e a parede aparece, com uma leve aproximação de câmera |
| 0,8 s | O escudo se desenha de cima para baixo |
| 1,2 s | As navalhas cruzadas caem girando no topo |
| 1,6 s | As letras de **BARBEARIA** surgem uma a uma |
| 2,3 s | O **R** gótico entra como um carimbo |
| 2,85 s | A faixa vermelha e azul do poste de barbeiro se preenche |
| 3,0 s | A tesoura sobe e se encaixa |
| 3,3 s | As letras de **ROQUE** sobem uma a uma |
| 4,0 s | A logo ganha um brilho quente e uma faixa de luz metálica passa por ela |
| 4,5 s | Aparece "Nova Venécia · ES" |
| 5,8 s | A tela de abertura se dissolve e o app aparece |

- Um **toque** em qualquer lugar pula a animação.
- Ela aparece **uma vez por sessão**: trocar de aba no app não repete.
- Quem ativou "reduzir movimento" no celular vê uma versão rápida.
- A animação só começa **depois que todas as imagens carregaram**, para não falhar em internet lenta (limite de 4 s).

## Como as peças foram feitas

1. **`tools/separar_logo.py`** lê `originais/logo.png` e:
   - troca o preto da logo pelo **creme metálico** do letreiro e mantém o vermelho e azul do poste;
   - torna o fundo branco transparente;
   - identifica cada forma da logo (escudo, navalhas, R, poste, tesoura, cada letra) e salva cada uma como um PNG separado em `public/logo-partes/`, todos do mesmo tamanho, para encaixarem perfeitamente uns sobre os outros;
   - gera os ícones do app (`public/img/icone-192.png` e `icone-512.png`).
2. **`tools/limpar_parede.py`** lê `originais/fachada-interna.png` e apaga o letreiro, preenchendo a área com tijolos clonados da própria parede (`public/img/parede-sem-letreiro.jpg`). Assim a logo animada "acende" no lugar do letreiro, sem duplicar.
3. **`src/components/Splash.tsx`** + **`src/styles.css`** (seção SPLASH) montam a cena com animações CSS.

Para regerar as imagens (por exemplo, com uma logo em alta resolução):

```powershell
python tools/separar_logo.py
```

```powershell
python tools/limpar_parede.py
```

Requer Python com `pillow`, `numpy` e `scipy`.

## Melhorias possíveis

- **Logo em alta resolução / vetor (SVG ou PDF):** a atual tem ~500 px. Com o arquivo original da logo, a animação fica nítida em qualquer tela, e dá para fazer o escudo ser "desenhado" pelo traço de verdade.
- **Foto da parede em alta resolução**, tirada de frente, com as luminárias acesas e (se possível) uma versão sem o letreiro.
- Som opcional de navalha / tesoura ao montar.
- Na versão nas lojas (Android/iOS), a mesma animação roda logo depois da tela de abertura nativa.
