# Pendências: o que confirmar com a Roque

Os dados de exemplo ficam no servidor: valores iniciais em [`server/src/db.ts`](../server/src/db.ts) (função `semear`). Serviços e preços também podem ser editados pelo **painel → Ajustes**. Dá para levantar a maior parte com o profissional que já se interessou, antes da reunião com o dono.

## Dados da barbearia

- [ ] Nome do dono (para a abordagem e a proposta)
- [ ] Endereço completo e link do Google Maps
- [ ] WhatsApp oficial da barbearia
- [ ] Instagram oficial (o app usa `@barbeariaroque` como exemplo)
- [ ] Horário de funcionamento por dia (incluindo almoço/intervalo)
- [ ] Ano de fundação / história curta (para a tela "A Roque")

## Serviços e preços

- [ ] Lista real de serviços, preços e duração de cada um
- [ ] Combos e pacotes
- [ ] Tem plano de assinatura mensal? Teria interesse?

## Equipe

- [ ] Nome, foto e especialidade de cada profissional
- [ ] Cada um tem agenda própria? Dias de folga?
- [ ] Trabalham por comissão? (afeta o painel do dono)
- [ ] Cada barbeiro vai ter acesso próprio ao painel? (e-mail de cada um)

## Regras

- [ ] Antecedência mínima para agendar e para cancelar
- [ ] Cobrar sinal via Pix para evitar faltas? (opcional)
- [ ] Fidelidade: 10 cortes = 1 grátis serve? Vale para barba também?
- [ ] O selo de indicação de amigo faz sentido?
- [ ] "Volte a cortar" depois de quantos dias? (padrão: 20)

## Arquivos de marca

- [ ] **Logo em alta resolução ou vetor** (SVG, PDF, AI ou CDR). Quem fez a logo costuma ter.
- [ ] Fotos de alta qualidade do espaço, dos cortes e da equipe
- [ ] Foto da parede do letreiro de frente, em boa resolução

## Decisões do desenvolvedor

- [ ] Qual VPS contratar (1 GB de RAM basta) e qual sistema (Ubuntu 24.04 recomendado)
- [ ] Endereço: `sslip.io` grátis para a demo, ou `.com.br` no CNPJ da barbearia
- [ ] WhatsApp: Evolution API (grátis, não oficial) ou Z-API (~R$ 100/mês)
- [ ] Qual número de WhatsApp vai enviar as mensagens (ideal: um número só da barbearia)
- [ ] Valores finais da proposta comercial
