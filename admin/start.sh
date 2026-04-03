#!/bin/sh
set -e
echo "DATABASE_URL: configurado"
npx prisma db push --accept-data-loss
node server.js
