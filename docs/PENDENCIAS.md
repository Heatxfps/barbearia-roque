# Pendências: o que confirmar com a Roque

Os dados de exemplo ficam no servidor: valores iniciais em [`server/src/db.ts`](../server/src/db.ts) (função `semear`). Serviços e preços também podem ser editados pelo **painel → Ajustes**. Dá para levantar a maior parte com o profissional que já se interessou, antes da reunião com o dono.

## Dados da barbearia

- [x] Nome do dono: **Luciano Roque** (foto em `originais/equipe/`)
- [ ] Endereço completo e link do Google Maps
- [ ] WhatsApp oficial da barbearia
- [x] Instagram oficial: [@barbearia_roque](https://www.instagram.com/barbearia_roque/)
- [ ] Horário de funcionamento por dia (incluindo almoço/intervalo)
- [ ] Ano de fundação / história curta (para a tela "A Roque")

## Serviços e preços

- [ ] Lista real de serviços, preços e duração de cada um
- [ ] Combos e pacotes
- [ ] Tem plano de assinatura mensal? Teria interesse?

## Equipe

- [x] Nome e foto: **Daniel Andrade** e **Guilherme Moreira** (fotos em `originais/equipe/`, recortes gerados por `tools/preparar_fotos.py`)
- [ ] Especialidade de cada um (hoje aparece só "Barbeiro")
- [x] Agenda: conjunta, cuidada pelos próprios barbeiros (não há recepcionista)
- [ ] Dias de folga de cada um
- [ ] Texto sobre o Luciano e a história da casa (o da tela "A Roque" é provisório)
- [ ] Trabalham por comissão? (afeta o painel do dono)
- [ ] Cada barbeiro vai ter acesso próprio ao painel? (e-mail de cada um)

## Dia do Noivo

- [ ] O que entra no pacote (a tela traz uma sugestão: making of, corte e barba, padrinhos, ritual completo)
- [ ] Fotos ou vídeos de making of anteriores para a galeria
- [ ] Faixa de preço, ou manter "sob consulta"

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
