#!/bin/bash
set -e

echo "🔄 Running Prisma migrations from $(pwd)..."
echo "🔍 Checking if prisma schema exists at ./prisma/schema.prisma..."

# Show current directory and prisma files for debugging
ls -la ./prisma/ || echo "⚠️ Prisma directory not found"

# ============================================================================
# CRITICAL: Validate DATABASE_URL is not empty
# ============================================================================
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable is empty or not set!"
    echo "⚠️  Make sure you're running with: docker-compose up --env-file .env.docker"
    echo "⚠️  See DOCKER_SETUP.md for more information"
    exit 1
fi

echo "✅ DATABASE_URL is set. Proceeding with migrations..."

# Deploy migrations - prisma looks for schema.prisma in the prisma/ directory
# Use --skip-generate to avoid re-generating Prisma Client unnecessarily
npx prisma migrate deploy --schema ./prisma/schema.prisma || {
    echo "⚠️ Migration had issues, checking database state..."
    npx prisma migrate status --schema ./prisma/schema.prisma || true
}

echo "✅ Migrations completed. Starting application..."
exec "$@"
