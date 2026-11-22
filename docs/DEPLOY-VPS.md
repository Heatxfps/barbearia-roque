# Publicar na VPS

Tudo roda em **um único servidor** com Docker: o app, a API, o banco (SQLite) e o HTTPS automático (Caddy + Let's Encrypt).

```
Celular ──HTTPS──▶ Caddy (porta 443) ──▶ roque (porta 3333: app + API) ──▶ /dados/roque.db
```

## Requisitos

- VPS com Ubuntu 22.04/24.04, **1 GB de RAM** já basta (Hostinger, Contabo, Hetzner, Oracle Free…)
- Portas **80 e 443** liberadas no firewall da VPS
- Um endereço apontando para o IP da VPS:
  - **grátis**: `roque.SEU-IP-COM-HIFENS.sslip.io` (ex.: `roque.203-0-113-10.sslip.io`), sem configurar nada
  - **próprio**: `barbeariaroque.com.br` no registro.br (~R$ 40/ano), com um registro **A** apontando para o IP

> O HTTPS é obrigatório: sem ele o celular não deixa instalar o app (PWA).

## Instalação (um comando)

Na VPS, logado por SSH:

```bash
git clone https://github.com/Heatxfps/barbearia-roque.git
cd barbearia-roque
sudo bash deploy/instalar.sh
```

O script:

1. instala o Docker;
2. pergunta o **domínio**. Se você ainda não tem um, é só apertar Enter: ele usa o `sslip.io` grátis, que já aponta para o IP da VPS;
3. pergunta o **e-mail do dono** e gera o `server/.env` com segredo e senha fortes. A senha aparece **uma vez** na tela: anote;
4. libera as portas 80 e 443 (se o firewall `ufw` estiver ativo);
5. sobe o app com HTTPS automático;
6. agenda o **backup diário** do banco às 3h30.

Em ~1 minuto o app está em `https://SEU-DOMINIO`, e o painel da equipe em `https://painel.SEU-DOMINIO` (endereço separado, só para a equipe; quem abrir `/painel` no endereço do app é mandado para lá).

Pode rodar o script de novo sem medo: ele não sobrescreve o `.env` nem o banco.

### Primeiros passos no painel

1. **Ajustes → A barbearia**: endereço e **WhatsApp da barbearia** (com 55 e DDD). É para esse número que vai o aviso de cada horário marcado pelo app.
2. **Ajustes → Equipe e horários**: o horário de cada barbeiro.
3. **Ajustes → Serviços e preços**: a tabela real.
4. **Ajustes → Acessos**: um login para o Daniel e outro para o Guilherme.
5. **Divulgação**: imprima o cartaz e cole a mensagem de saudação no WhatsApp Business.

### (Só para a apresentação) dados de demonstração

```bash
docker compose exec roque node --disable-warning=ExperimentalWarning src/seed-demo.ts --limpar
```

⚠️ Isso **apaga** clientes e agendamentos. Nunca rode depois que a barbearia começar a usar de verdade.

## Trocar o sslip.io por um domínio próprio

1. Registre o domínio (ex.: `barbeariaroque.com.br` no registro.br, ~R$ 40/ano, no CNPJ da barbearia).
2. No painel do registro.br, em **DNS**, crie um registro **A** apontando para o IP da VPS e **outro registro A chamado `painel`** (o painel da equipe fica em `painel.seudominio`). Um para `www` é opcional.
3. Espere o DNS propagar (de minutos a algumas horas). Confira com `ping barbeariaroque.com.br`: tem que responder o IP da VPS.
4. Na VPS:

   ```bash
   cd barbearia-roque
   nano .env                 # DOMINIO=barbeariaroque.com.br
   docker compose up -d
   ```

O Caddy pede o certificado novo sozinho, e os links das mensagens (avaliação, lista de espera, aniversário) passam a usar o domínio novo, porque o `docker-compose.yml` monta o `URL_APP` a partir do `DOMINIO`. O link e o QR code da aba **Divulgação** passam a usar o domínio novo automaticamente: **reimprima o cartaz**.

## Atualizar depois de mudanças no código

```bash
cd barbearia-roque
git pull
docker compose up -d --build
```

## Backup do banco

O banco é um arquivo SQLite só. As fotos enviadas pelo painel (barbeiros e produtos) ficam ao lado dele, em `/dados/fotos`, no mesmo volume. O backup diário já fica agendado pelo `instalar.sh` e guarda 14 dias em `barbearia-roque/backups/`. Para fazer um na hora:

```bash
bash deploy/backup.sh
```

O backup é seguro com o app no ar. Ainda assim, copie a pasta `backups/` para fora da VPS de vez em quando (Google Drive, seu computador): se a VPS sumir, os backups somem junto.

**Restaurar** um backup:

```bash
docker compose stop roque
docker compose cp backups/roque-AAAA-MM-DD-HHMM.db roque:/dados/roque.db
docker compose run --rm roque sh -c "rm -f /dados/roque.db-wal /dados/roque.db-shm"
docker compose start roque
```

## Conectar o WhatsApp de verdade

### Opção A: Evolution API (grátis, na própria VPS)

Ela usa o WhatsApp da barbearia, conectado por QR code como no WhatsApp Web.

1. Acrescente ao `docker-compose.yml`:

   ```yaml
     evolution:
       image: atendai/evolution-api:latest   # fixe uma versão estável depois de testar
       restart: unless-stopped
       environment:
         AUTHENTICATION_API_KEY: troque-esta-chave
       volumes:
         - evolution:/evolution/instances
   ```

   E inclua `evolution:` em `volumes:` no fim do arquivo.
2. No `server/.env`:

   ```env
   WHATSAPP_MODO=evolution
   EVOLUTION_URL=http://evolution:8080
   EVOLUTION_INSTANCIA=roque
   EVOLUTION_CHAVE=troque-esta-chave
   ```

3. Crie a instância `roque` e leia o QR code com o celular da barbearia (veja a documentação da Evolution API).
4. Rode `docker compose up -d`.

> É uma integração **não oficial**. Use um número dedicado e não mande mensagens em massa, para não ser bloqueado.

### Opção B: Z-API (paga, ~R$ 100/mês)

1. Crie a conta em z-api.io e conecte o número.
2. No `server/.env`, preencha `WHATSAPP_MODO=zapi`, `ZAPI_INSTANCIA`, `ZAPI_TOKEN` e `ZAPI_CLIENT_TOKEN`.
3. Rode `docker compose up -d`.

Em qualquer modo, todas as mensagens aparecem no painel, na aba **WhatsApp**, com status *enviado* ou *erro*.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Certificado não sai | Portas 80/443 fechadas, ou o domínio ainda não aponta para o IP |
| Login do painel não funciona | `ADMIN_SENHA` só vale na **primeira** vez que o banco é criado; para trocar depois, use **Ajustes → Minha senha** |
| Script falha com `$'\r': command not found` | O arquivo foi salvo com quebra de linha do Windows; rode `git pull` (o repositório força LF) ou `sed -i 's/\r$//' deploy/*.sh` |
| Aviso de agendamento não chega no WhatsApp da casa | Confira o número em **Ajustes → A barbearia** e o `WHATSAPP_MODO` (em `demo`, só aparece na aba WhatsApp) |
| Horários errados em 3 h | O fuso deve ser `TZ=America/Sao_Paulo` (já vem no Dockerfile) |
| Logs | `docker compose logs -f roque` |
