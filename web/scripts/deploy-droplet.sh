#!/usr/bin/env bash
# Deploys the committed web app (git HEAD) to a shared droplet running PM2 + nginx + Postgres.
#
#   AICITY_DEPLOY_SERVER=root@<host> AICITY_DEPLOY_SSH_KEY=~/.ssh/<key> web/scripts/deploy-droplet.sh
#
# Builds locally (the droplet is small and shared, and a Next.js build can exhaust its memory),
# ships the build, installs production deps, migrates, restarts. The server owns
# /root/ai-city/web/.env.local: this script reads its NEXT_PUBLIC_* values for the build and never
# overwrites it. Host and key stay out of this public repo.
#
# One-time server setup (already done on the current droplet):
#   - Postgres role + database `ai_city`; DATABASE_URL, SESSION_SECRET, RPC_URL, TOGETHER_API_KEY and
#     the NEXT_PUBLIC_* values in /root/ai-city/web/.env.local
#   - pm2 start node_modules/next/dist/bin/next --name ai-city-web --cwd /root/ai-city/web \
#       --max-memory-restart 450M -- start -p 3300 -H 127.0.0.1 && pm2 save
#   - an nginx server block proxying to 127.0.0.1:3300
set -euo pipefail

SERVER="${AICITY_DEPLOY_SERVER:?set AICITY_DEPLOY_SERVER=root@<host>}"
KEY="${AICITY_DEPLOY_SSH_KEY:?set AICITY_DEPLOY_SSH_KEY=<path to ssh key>}"
REMOTE=/root/ai-city/web
SSH=(ssh -i "$KEY" "$SERVER")
REPO="$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"

BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

echo "==> Exporting $(git -C "$REPO" rev-parse --short HEAD) (uncommitted changes are not deployed)"
git -C "$REPO" archive HEAD web | tar -x -C "$BUILD"
"${SSH[@]}" "grep '^NEXT_PUBLIC_' $REMOTE/.env.local" > "$BUILD/web/.env.production"

echo "==> Building locally"
(cd "$BUILD/web" && pnpm install --frozen-lockfile --ignore-scripts >/dev/null && pnpm build >/dev/null)

echo "==> Syncing to $REMOTE"
rsync -az --delete --exclude node_modules --exclude .next/cache --exclude '.env*' --exclude tsconfig.tsbuildinfo \
  "$BUILD/web/" -e "ssh -i $KEY" "$SERVER:$REMOTE/"

echo "==> Installing, migrating, restarting"
"${SSH[@]}" "cd $REMOTE && CI=true pnpm install --prod --frozen-lockfile --ignore-scripts >/dev/null \
  && DATABASE_URL=\$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-) node scripts/migrate.mjs >/dev/null \
  && pm2 restart ai-city-web >/dev/null && pm2 save >/dev/null"

sleep 5
"${SSH[@]}" "curl -sf -o /dev/null -w 'health: %{http_code}\n' http://127.0.0.1:3300/api/cities"
echo "==> Deployed"
