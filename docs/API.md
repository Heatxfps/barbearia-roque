# API

Base: `/api`. Tudo em JSON. Datas são `YYYY-MM-DD`, horas `HH:MM`, carimbos `YYYY-MM-DD HH:MM` (horário de Brasília).
Erros vêm como `{ "erro": "mensagem para mostrar ao usuário" }`.

Autenticação: `Authorization: Bearer <token>`. Existem dois tipos de token: **cliente** (login por código no WhatsApp) e **painel** (e-mail e senha).

## Públicas

| Método | Rota | O que faz |
|---|---|---|
| GET | `/saude` | `{ ok, whatsapp }`, para monitoramento |
| GET | `/barbearia` | Nome, contatos, horário de funcionamento, serviços, profissionais e regras |
| GET | `/dias?servico=&profissional=` | Próximos dias de expediente com a quantidade de horários livres |
| GET | `/horarios?data=&servico=&profissional=` | Horários livres. `profissional=qualquer` junta todos |
| POST | `/auth/codigo` `{ telefone }` | Manda um código de 6 dígitos no WhatsApp. No modo `demo` devolve `codigoDemo` |
| POST | `/auth/verificar` `{ telefone, codigo, nome? }` | Confere o código e devolve `{ token, cliente }`. `nome` é obrigatório no primeiro acesso |

## Cliente (token de cliente)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/me` | Dados e cartão fidelidade `{ selos, meta, premiosConquistados }` |
| GET | `/me/agendamentos` | Histórico e próximos horários |
| POST | `/me/agendamentos` `{ servicoId, profissionalId, data, hora }` | Agenda (409 se o horário foi ocupado). No máximo 3 futuros |
| POST | `/me/agendamentos/:id/cancelar` | Cancela, respeitando a antecedência mínima |

## Painel (token do painel)

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| POST | `/admin/login` `{ email, senha }` | todos | `{ token, usuario }` |
| GET | `/admin/eu` | todos | Usuário logado |
| GET | `/admin/resumo?data=` | todos* | Números do dia e do mês, ranking, clientes para chamar de volta (só o dono) |
| GET | `/admin/agenda?data=&profissional=` | todos | Agendamentos e bloqueios do dia (`profissional=todos` = agenda da casa) |
| PATCH | `/admin/agendamentos/:id` `{ status }` | todos | `concluido`, `faltou`, `cancelado` ou `confirmado` |
| POST | `/admin/agendamentos` `{ nome, telefone?, servicoId, profissionalId, data, hora }` | todos | Encaixe / cliente de balcão |
| GET/POST/DELETE | `/admin/bloqueios` | todos | Folgas e horários travados (`profissionalId: "todos"` fecha a casa) |
| GET | `/admin/clientes?busca=` | todos | Clientes com visitas, faltas e última visita |
| GET | `/admin/mensagens` | todos | Últimas 60 mensagens de WhatsApp |
| GET/POST/PUT | `/admin/servicos[/:id]` | dono | Serviços e preços |
| GET/POST/PUT | `/admin/profissionais[/:id]` | dono | Profissionais e expediente por dia da semana |
| PUT | `/admin/barbearia` | dono | Nome, cidade, endereço, WhatsApp (com 55 e DDD), Instagram, fundador (`dono`) |
| GET | `/admin/usuarios` | dono | Quem tem acesso ao painel |
| POST | `/admin/usuarios` `{ nome, email, senha, profissionalId }` | dono | Cria acesso de barbeiro |
| DELETE | `/admin/usuarios/:id` | dono | Remove o acesso de um barbeiro |
| PUT | `/admin/senha` `{ atual, nova }` | todos | Troca a própria senha (mínimo 8 caracteres) |

\* A **agenda é conjunta**: os barbeiros veem e mexem na agenda da casa toda (na Roque não há recepcionista). No resumo, o barbeiro vê só os próprios números, sem a lista de clientes para chamar de volta.

## Tarefas automáticas (a cada minuto)

- **Confirmação** logo depois de agendar pelo app
- **Lembrete 24 h antes** (só se o horário foi marcado com mais de 24 h de antecedência)
- **Lembrete 1 h antes**
- **"Volte a cortar"**: clientes há `DIAS_RETORNO` dias sem vir e sem horário marcado (só das 10h às 19h, uma vez por visita)
- **Aviso de cancelamento**
- **Aviso para a barbearia**: cada horário marcado ou cancelado pelo cliente no app gera uma mensagem no WhatsApp da própria barbearia (desligue com `AVISAR_BARBEARIA=0`)

## Segurança

- Código de login com validade de 10 min, máximo de 5 tentativas e intervalo mínimo de 45 s entre pedidos
- Limite de requisições por IP (geral e mais rígido no login)
- Senhas com `scrypt`; códigos guardados só como hash
- Agendamento conferido dentro de uma transação, o que evita dois clientes no mesmo horário
