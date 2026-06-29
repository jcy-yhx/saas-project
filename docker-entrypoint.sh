#!/bin/sh
set -e

echo "Running database migrations..."
npx -w packages/backend prisma migrate deploy

echo "Starting TaskFlow backend..."
exec node packages/backend/dist/index.js
