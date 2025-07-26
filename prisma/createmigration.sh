#!/usr/bin/env bash
set -e

# Usage: ./create-migration.sh migration_name
name="$1"
if [[ -z "$name" ]]; then
  echo "Usage: $0 <migration_name>"
  exit 1
fi

# Generate timestamp (YYYYMMDDHHMMSS)
ts=$(date +"%Y%m%d%H%M%S")
dir="prisma/migrations/${ts}_${name}"

# Create migration folder
mkdir -p "$dir"

# 1️⃣ Generate up migration
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$dir/up.sql"

# 2️⃣ Generate down migration comparing current migrations to schema
npx prisma migrate diff \
  --from-schema-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --script > "$dir/down.sql"

echo "Created migration in $dir"
