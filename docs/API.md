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

### Públicas (v1.2)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/produtos` | Produtos à venda na loja |
| GET | `/avaliacao/:id` | Dados do atendimento para a página de avaliação (o id vai no link do WhatsApp) |
| POST | `/avaliacao/:id` `{ nota 1-5, comentario? }` | Registra a avaliação (uma por atendimento) |

## Cliente (token de cliente)

| Método | Rota | O que faz |
|---|---|---|
| GET | `/me` | Dados e cartão fidelidade `{ selos, meta, premiosConquistados }` |
| GET | `/me/agendamentos` | Histórico e próximos horários |
| POST | `/me/agendamentos` `{ servicoId, profissionalId, data, hora }` | Agenda (409 se o horário foi ocupado). No máximo 3 futuros |
| POST | `/me/agendamentos/:id/cancelar` | Cancela, respeitando a antecedência mínima |

### Cliente (v1.2)

| Método | Rota | O que faz |
|---|---|---|
| PUT | `/me` `{ nome?, aniversario? "MM-DD" }` | Atualiza nome e aniversário (o `GET /me` traz o cupom ativo) |
| GET/POST/DELETE | `/me/espera[/:id]` `{ servicoId, profissionalId, data }` | Lista de espera (só para dia sem vaga; até 3) |
| GET/POST | `/me/pedidos` `{ itens: [{ produtoId, qtd }], observacao? }` | Pedidos da loja (retirada na barbearia) |
| POST | `/me/pedidos/:id/cancelar` | Cancela enquanto ainda não foi separado |

## Painel (token do painel)

| Método | Rota | Quem | O que faz |
|---|---|---|---|
| POST | `/admin/login` `{ email, senha, lembrar? }` | todos | `{ token, usuario }` (12 h; 30 dias com `lembrar`). Dono com WhatsApp cadastrado recebe `{ etapa: "codigo", desafio }` |
| POST | `/admin/login/codigo` `{ desafio, codigo }` | dono | Confirma o código do WhatsApp e devolve `{ token, usuario }` |
| GET | `/admin/eu` | todos | Usuário logado |
| GET | `/admin/resumo?data=` | dono | Resultados financeiros do dia e do mês, ranking |
| GET | `/admin/retorno` | todos | Clientes para chamar de volta |
| GET | `/admin/aniversariantes` | todos | Aniversários dos próximos 7 dias |
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
| PUT | `/admin/senha` `{ atual, nova }` | todos | Troca a própria senha (mínimo 8) e devolve um token novo. Barbeiro novo é obrigado a fazer isso no 1º acesso (antes disso só `/eu` e `/senha` respondem) |
| PUT | `/admin/seguranca` `{ senha, telefone \| null }` | dono | Liga/desliga o código no WhatsApp para entrar como dono |
| GET | `/admin/avaliacoes` | todos | Média, por barbeiro e últimos comentários |
| DELETE | `/admin/espera/:id` | todos | Tira alguém da lista de espera (a agenda do dia traz `espera`) |
| GET/PATCH | `/admin/pedidos[/:id]` `{ status }` | todos | Pedidos da loja: `novo`, `separado` (avisa o cliente), `retirado`, `cancelado` |
| GET/POST/PUT/DELETE | `/admin/produtos[/:id]` | dono | Produtos da loja |
| DELETE | `/admin/profissionais/:id` | dono | Exclui barbeiro (recusa se tiver horário futuro; mantém o histórico) |
| POST | `/admin/fotos` `{ imagem: dataURL }` | dono | Envia foto (JPG/PNG/WebP até 4 MB) → `{ url: "/fotos/..." }` |

\* A **agenda é conjunta**: os barbeiros veem e mexem na agenda da casa toda (na Roque não há recepcionista). No resumo, o barbeiro vê só os próprios números, sem a lista de clientes para chamar de volta.

## Tarefas automáticas (a cada minuto)

- **Confirmação** logo depois de agendar pelo app
- **Lembrete 24 h antes** (só se o horário foi marcado com mais de 24 h de antecedência)
- **Lembrete 1 h antes**
- **"Volte a cortar"**: clientes há `DIAS_RETORNO` dias sem vir e sem horário marcado (só das 10h às 19h, uma vez por visita)
- **Aviso de cancelamento**
- **Convite para avaliar**: 1 h depois do atendimento concluído (das 9h às 21h), link `/#avaliar/ID`
- **Aniversário**: no dia (a partir das 9h), cria o cupom (% em Ajustes, vale `DIAS_CUPOM` = 30 dias) e avisa; o desconto entra sozinho no próximo agendamento
- **Lista de espera**: quando abre vaga num dia, avisa o primeiro da fila; se em 30 min a vaga continuar livre, avisa o próximo
- **Aviso para a barbearia**: cada horário marcado ou cancelado pelo cliente no app gera uma mensagem no WhatsApp da própria barbearia (desligue com `AVISAR_BARBEARIA=0`)

## Segurança

- Código de login com validade de 10 min, máximo de 5 tentativas e intervalo mínimo de 45 s entre pedidos
- Limite de requisições por IP (geral e mais rígido no login)
- Senhas com `scrypt`; códigos guardados só como hash
- Agendamento conferido dentro de uma transação, o que evita dois clientes no mesmo horário
