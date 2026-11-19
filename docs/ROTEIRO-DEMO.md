# Roteiro da demonstração (~8 minutos)

O ideal é ter **dois aparelhos**: o seu celular (cliente) e um notebook ou tablet com o **painel** aberto. O dono vê o agendamento cair no painel na hora.

## Antes da reunião

1. Suba o servidor com os dados de demonstração (na VPS, ou no notebook: veja o [README](../README.md#rodar-no-computador)):
   - VPS: `docker compose exec roque node --disable-warning=ExperimentalWarning src/seed-demo.ts --limpar`
   - Notebook: `npm run servidor:demo` e `npm run servidor`
2. No celular, abra o link e **instale o app** (iPhone: Compartilhar → Adicionar à Tela de Início; Android: ⋮ → Instalar app).
3. No notebook, abra `SEU-LINK/#painel` e entre com o login do dono.
4. Brilho alto e notificações desligadas.

> Sem internet ou sem servidor? A vitrine https://heatxfps.github.io/barbearia-roque/ funciona sozinha, com dados fictícios no próprio celular.

## Na reunião

1. **Abra o app pelo ícone e fique em silêncio.** A parede acende e a logo se monta. É o momento "uau".
2. **"Esse é o app da Roque, não de uma plataforma genérica."**
3. **Entregue o celular ao dono** e peça para ele marcar um corte:
   serviço → profissional → dia → horário → WhatsApp → código → confirmar.
   *"Sem senha, sem baixar nada da loja, e ninguém precisou responder WhatsApp."*
4. **Vire o notebook:** o horário apareceu na agenda do painel. Na aba **WhatsApp**, a mensagem de confirmação que o cliente recebeu.
5. **Painel, aba Agenda:**
   - Números do dia e do mês, faltas e quanto vem pelo app
   - Marque um atendimento como **✓ Concluído**: *"o selo de fidelidade entra sozinho no app do cliente."*
   - **Bloquear horário**: *"folga do barbeiro? Bloqueia aqui e some da agenda dos clientes."*
   - **Encaixe** para o cliente que chegou sem marcar
6. **Clientes para chamar de volta:** *"quem sumiu há 20 dias recebe lembrete automático. Isso é dinheiro voltando sozinho."*
7. **Ajustes:** mude o preço de um serviço e mostre no celular que já mudou.
8. **No celular, Meus horários:** remarcar e cancelar; o horário volta a ficar livre.
9. Pare e pergunte: **"O que mais te ajudaria no dia a dia?"** Anote e coloque na proposta.

## Depois

Para limpar tudo e deixar pronto para uso real, rode o `seed-demo` de novo **sem** dados fictícios: apague o volume `dados` antes de colocar clientes reais (veja [DEPLOY-VPS.md](DEPLOY-VPS.md)).
