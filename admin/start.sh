#!/bin/sh
export DATABASE_URL="${DATABASE_URL:-file:./dev.db}"
echo "DATABASE_URL = $DATABASE_URL"
npx prisma db push --accept-data-loss
node seed-demo.js
node cleanup-prod.js
node server.js
