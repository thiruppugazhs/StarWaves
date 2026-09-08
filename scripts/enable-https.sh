#!/usr/bin/env bash
# enable-https.sh — uncomment the 443 server block after certs are issued
set -euo pipefail
cd "$(dirname "$0")/.."
FILE="nginx/conf.d/default.backend.conf"
if grep -q "^# server {" "$FILE"; then
  echo "Uncommenting 443 block in $FILE..."
  # Remove leading '# ' from the 443 block (from '# server {' to '# }' inclusive)
  # Use perl for range
  perl -i -pe 'BEGIN{$in=0} if(/^# server \{/){$in=1} if($in){s/^# ?//} if($in && /^}/){$in=0}' "$FILE"
  echo "Done. Verify:"
  grep -n "listen 443" "$FILE" || echo "no 443 found — check manually"
else
  echo "443 block already uncommented or not found"
fi
echo "Next: docker compose -f docker-compose.yml -f docker-compose.backend.yml -f docker-compose.ghcr.backend.yml up -d --force-recreate nginx && curl -i https://api.starwaves.susindran.in/health"
