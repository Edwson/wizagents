#!/bin/sh
set -e
echo "WizAgents · waiting for database…"
# best-effort wait for Postgres to accept connections
for i in $(seq 1 30); do
  if node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().\$queryRaw\`SELECT 1\`.then(()=>process.exit(0)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "database ready"; break
  fi
  echo "  …retry $i"; sleep 2
done

echo "applying schema (prisma db push)…"
./node_modules/.bin/prisma db push --skip-generate --accept-data-loss || ./node_modules/.bin/prisma db push --skip-generate

# seed only when empty (idempotent first-run)
COUNT=$(node -e "const{PrismaClient}=require('@prisma/client');new PrismaClient().agent.count().then(c=>{console.log(c);process.exit(0)}).catch(()=>{console.log(0);process.exit(0)})")
if [ "$COUNT" = "0" ]; then
  echo "seeding initial data…"; ./node_modules/.bin/tsx prisma/seed.ts || echo "seed skipped/failed (continuing)"
else
  echo "data present ($COUNT agents) — skipping seed"
fi

echo "starting WizAgents on :$PORT"
exec node server.js
