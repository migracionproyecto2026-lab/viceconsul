#!/bin/sh
echo "DATABASE_URL: configurado"
npx prisma db push --accept-data-loss || echo "[warning] prisma db push falló — MongoDB crea colecciones automáticamente al primer uso"
node server.js
