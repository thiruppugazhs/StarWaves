#!/usr/bin/env bash
# init-letsencrypt.sh — one-time TLS for api.starwaves.susindran.in on the VM
# Run on personal-vm after DNS A record propagates.
# Requires: docker compose stack up (http), ports 80/443 open.
set -euo pipefail

DOMAIN="api.starwaves.susindran.in"
EMAIL="${EMAIL:-}" # export EMAIL=you@susindran.in before running, or pass as arg1
if [ -n "${1:-}" ]; then EMAIL="$1"; fi
if [ -z "$EMAIL" ]; then
  echo "Usage: EMAIL=you@susindran.in ./scripts/init-letsencrypt.sh  (or ./scripts/init-letsencrypt.sh you@susindran.in)"
  exit 1
fi

cd "$(dirname "$0")/.."
mkdir -p certbot/www certbot/certs

echo "==> 1) Ensure nginx is up (http only, 443 block still commented)"
docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d nginx
sleep 3
docker logs starwaves-nginx --tail 20 || true

echo "==> 2) Issue cert via webroot (needs port 80 + DNS A ${DOMAIN} -> this VM)"
# Use certbot container so host doesn't need pip install
docker run --rm \
  -v "$PWD/certbot/www:/var/www/certbot" \
  -v "$PWD/certbot/certs:/etc/letsencrypt" \
  certbot/certbot certonly --webroot \
  -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$EMAIL" --agree-tos --no-eff-email \
  --preferred-challenges http

echo "==> 3) Certs at certbot/certs/live/${DOMAIN}/ — wiring to nginx path /etc/nginx/certs (primary: api.starwaves.susindran.in)"
# nginx expects /etc/nginx/certs/live/<domain>/ — certbot writes to /etc/letsencrypt/live
# Bind mount is certbot/certs:/etc/nginx/certs, so create the expected layout
if [ -d "certbot/certs/live/$DOMAIN" ]; then
  echo "Already at expected path."
elif [ -d "certbot/certs/live" ]; then
  ls -R certbot/certs/live || true
else
  # certbot container used /etc/letsencrypt inside; host path is certbot/certs
  # Check alternate location if old runs used different volume
  echo "Check certbot/certs contents:"
  ls -R certbot/certs || true
fi

echo "==> 4) Uncomment the 443 server block in nginx/conf.d/default.backend.conf"
echo "    Edit the file and uncomment the second 'server { listen 443 ssl' block."
echo "    Then:"
echo "      docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d --force-recreate nginx"
echo "      curl -k https://${DOMAIN}/health"
echo "      curl https://${DOMAIN}/health  # after DNS + cert valid"

echo "==> 5) Auto-renew (cron)"
echo "    Add to crontab (crontab -e):"
echo "    0 3 * * * cd $PWD && docker run --rm -v $PWD/certbot/www:/var/www/certbot -v $PWD/certbot/certs:/etc/letsencrypt certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml exec nginx nginx -s reload"
