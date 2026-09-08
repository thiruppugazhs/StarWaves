#!/usr/bin/env bash
# vm-quick-fix.sh — run from ~ on personal-vm to fix perms and pull latest GHCR image
# Location on VM: ~/vm-quick-fix.sh  (or ~/starwaves/scripts/vm-quick-fix.sh)
# Usage:  bash ~/vm-quick-fix.sh
#   or:   chmod +x ~/vm-quick-fix.sh && ~/vm-quick-fix.sh
set -e
cd ~/starwaves
echo "== Fix perms =="
chmod +x scripts/*.sh
echo "== Pull latest GHCR (no VM build) =="
bash scripts/vm-load-image.sh --tag latest
echo "== Done — health =="
curl -s https://api.starwaves.susindran.in/health | head -c 500; echo
