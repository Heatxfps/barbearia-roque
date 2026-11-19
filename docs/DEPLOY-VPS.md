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

## Passo a passo

1. **Instale o Docker** na VPS:

   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

2. **Baixe o projeto:**

   ```bash
   git clone https://github.com/Heatxfps/barbearia-roque.git
   cd barbearia-roque
   ```

3. **Configure:**

   ```bash
   cp .env.example .env                 # DOMINIO=...
   cp server/.env.example server/.env   # senha do dono, segredo, WhatsApp
   nano .env
   nano server/.env
   ```

   No `server/.env`, troque **obrigatoriamente** `JWT_SEGREDO`, `ADMIN_EMAIL` e `ADMIN_SENHA`.

4. **Suba:**

   ```bash
   docker compose up -d --build
   ```

   Em ~1 minuto o app está em `https://SEU-DOMINIO`, e o painel em `https://SEU-DOMINIO/#painel`.

5. **(Só para a apresentação) dados de demonstração:**

   ```bash
   docker compose exec roque node --disable-warning=ExperimentalWarning src/seed-demo.ts --limpar
   ```

   ⚠️ Isso **apaga** clientes e agendamentos. Nunca rode depois que a barbearia começar a usar de verdade.

## Atualizar depois de mudanças no código

```bash
cd barbearia-roque
git pull
docker compose up -d --build
```

## Backup do banco

O banco é um arquivo só. Para copiar:

```bash
docker compose exec roque sh -c "cp /dados/roque.db /dados/backup-$(date +%F).db"
docker compose cp roque:/dados/backup-$(date +%F).db ./
```

Sugestão: agende isso diariamente com `crontab -e` e mande a cópia para fora da VPS (Google Drive, outro servidor).

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
| Login do painel não funciona | `ADMIN_SENHA` só vale na **primeira** vez que o banco é criado; para trocar depois, use o painel ou apague o volume `dados` (perde os dados) |
| Horários errados em 3 h | O fuso deve ser `TZ=America/Sao_Paulo` (já vem no Dockerfile) |
| Logs | `docker compose logs -f roque` |
