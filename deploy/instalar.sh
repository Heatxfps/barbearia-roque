#!/usr/bin/env bash
# =============================================================================
#  Barbearia Roque: instalação numa VPS Ubuntu (22.04 / 24.04) do zero.
#
#    git clone https://github.com/Heatxfps/barbearia-roque.git
#    cd barbearia-roque
#    sudo bash deploy/instalar.sh
#
#  O que faz: instala o Docker, pergunta o domínio e o e-mail do dono, gera os
#  segredos (server/.env), libera as portas 80/443, sobe o app com HTTPS
#  automático e agenda o backup diário do banco às 3h30.
#  Pode rodar de novo sem medo: não sobrescreve .env nem o banco.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."
PASTA="$(pwd)"

[ "$(id -u)" = 0 ] || { echo "Rode com sudo: sudo bash deploy/instalar.sh"; exit 1; }

echo "==> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null

echo "==> Endereço"
if [ ! -f .env ]; then
  IP="$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
  SUGESTAO="roque.${IP//./-}.sslip.io"
  echo "Sem domínio próprio ainda? Use o sugerido (grátis, já aponta para esta VPS)."
  read -rp "Domínio do app [$SUGESTAO]: " DOMINIO
  echo "DOMINIO=${DOMINIO:-$SUGESTAO}" > .env
fi
DOMINIO="$(grep -E '^DOMINIO=' .env | cut -d= -f2-)"
echo "    $DOMINIO"

echo "==> Segredos e login do painel"
if [ ! -f server/.env ]; then
  read -rp "E-mail do dono para entrar no painel: " EMAIL
  docker run --rm -v "$PASTA/server:/s" -w /s node:24-alpine \
    node --disable-warning=ExperimentalWarning src/configurar.ts --email "$EMAIL"
  read -rp "Anotou a senha acima? Enter para continuar… " _
else
  echo "    server/.env já existe (mantido)"
fi

echo "==> Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp && ufw allow 443/tcp
fi

echo "==> Subindo (a primeira vez leva alguns minutos)"
docker compose up -d --build

echo "==> Backup diário"
chmod +x deploy/backup.sh
cat > /etc/cron.d/barbearia-roque <<CRON
# backup do banco da Barbearia Roque, todo dia às 3h30
30 3 * * * root cd $PASTA && bash deploy/backup.sh >> /var/log/barbearia-roque-backup.log 2>&1
CRON

echo "==> Conferindo"
for _ in $(seq 1 30); do
  if docker compose exec -T roque wget -qO- http://127.0.0.1:3333/api/saude >/dev/null 2>&1; then OK=1; break; fi
  sleep 2
done
[ "${OK:-}" = 1 ] && echo "    API no ar" || echo "    A API ainda não respondeu: veja  docker compose logs roque"

cat <<FIM

✂️  Pronto!
    App:     https://$DOMINIO
    Painel:  https://$DOMINIO/#painel

    O certificado HTTPS sai sozinho em até 1 minuto (o domínio precisa apontar para este IP).
    Atualizar depois:  git pull && docker compose up -d --build
    Backup na hora:    bash deploy/backup.sh
FIM
