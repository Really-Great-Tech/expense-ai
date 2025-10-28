#!/bin/sh
set -e

# Docker entrypoint script for Expense AI application
# Provides flexible database migration control via environment variables

echo "🚀 Starting Expense AI application..."

# Migration control via TYPEORM_MIGRATIONS_RUN environment variable
# Values: "true" (run migrations), "false" (skip, default), "check" (show status)
TYPEORM_MIGRATIONS_RUN=${TYPEORM_MIGRATIONS_RUN:-false}

if [ "$TYPEORM_MIGRATIONS_RUN" = "true" ]; then
    echo "📦 Running database migrations..."
    npx typeorm migration:run -d dist/src/config/database.js || {
        echo "❌ Migration failed! Exiting..."
        exit 1
    }
    echo "✅ Migrations completed successfully"
elif [ "$TYPEORM_MIGRATIONS_RUN" = "check" ]; then
    echo "🔍 Checking migration status..."
    npx typeorm migration:show -d dist/src/config/database.js
else
    echo "⏭️  Skipping migrations (TYPEORM_MIGRATIONS_RUN=${TYPEORM_MIGRATIONS_RUN})"
fi

# Check database connectivity before starting app
if [ "$CHECK_DB_CONNECTION" = "true" ]; then
    echo "🔌 Checking database connection..."
    # Wait for database to be ready
    max_attempts=30
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        if npx typeorm query "SELECT 1" -d dist/src/config/database.js >/dev/null 2>&1; then
            echo "✅ Database connection successful"
            break
        fi
        attempt=$((attempt + 1))
        echo "⏳ Waiting for database... (${attempt}/${max_attempts})"
        sleep 2
    done

    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Database connection failed after ${max_attempts} attempts"
        exit 1
    fi
fi

# Execute the CMD (typically "node dist/main")
echo "✨ Starting application..."
exec "$@"
