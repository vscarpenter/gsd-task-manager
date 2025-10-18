#!/bin/bash
# GSD Sync Worker - Multi-Environment Setup Script
# Creates resources for development, staging, and production environments

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GSD Sync Worker - Multi-Environment Setup                ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# ========================================
# Step 1: Check Authentication
# ========================================
echo -e "${BLUE}[1/4]${NC} Checking Cloudflare authentication..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo -e "${RED}✗ Not authenticated${NC}"
    echo ""
    echo "Please run: npx wrangler login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# ========================================
# Step 2: Create Resources for All Environments
# ========================================
echo -e "${BLUE}[2/4]${NC} Creating resources for all environments..."
echo ""

# Variables to store created resource IDs
DB_ID_DEV=""
DB_ID_STAGING=""
DB_ID_PROD=""
KV_ID_DEV=""
KV_ID_STAGING=""
KV_ID_PROD=""

ENVIRONMENTS=("development" "staging" "production")
ENV_SUFFIXES=("dev" "staging" "production")

for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    SUFFIX="${ENV_SUFFIXES[$i]}"

    echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
    echo -e "${YELLOW}Setting up ${ENV} environment${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
    echo ""

    # Create D1 Database
    echo -e "  ${BLUE}→${NC} Creating D1 database: gsd-sync-${SUFFIX}"
    DB_OUTPUT=$(npx wrangler d1 create "gsd-sync-${SUFFIX}" 2>&1 || true)

    # Extract database ID from output
    if echo "$DB_OUTPUT" | grep -q "already exists"; then
        echo -e "  ${YELLOW}⚠${NC}  Database already exists, fetching ID..."
        DB_ID=$(npx wrangler d1 list | grep "gsd-sync-${SUFFIX}" | awk '{print $2}' || echo "")
    else
        DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed -E 's/.*database_id = "([^"]+)".*/\1/')
    fi

    if [ -n "$DB_ID" ]; then
        # Store in environment-specific variable
        case "$SUFFIX" in
            "dev")
                DB_ID_DEV="$DB_ID"
                ;;
            "staging")
                DB_ID_STAGING="$DB_ID"
                ;;
            "production")
                DB_ID_PROD="$DB_ID"
                ;;
        esac
        echo -e "  ${GREEN}✓${NC} Database ID: ${DB_ID}"
    else
        echo -e "  ${RED}✗${NC} Failed to create/find database"
        exit 1
    fi
    echo ""

    # Create KV Namespace
    echo -e "  ${BLUE}→${NC} Creating KV namespace for ${ENV}"
    KV_OUTPUT=$(npx wrangler kv namespace create "KV" --env "${ENV}" 2>&1 || true)

    # Extract KV ID from output
    if echo "$KV_OUTPUT" | grep -q "already exists"; then
        echo -e "  ${YELLOW}⚠${NC}  KV namespace already exists, fetching ID..."
        # KV namespaces are named as "{env}-KV" (e.g., "development-KV", "staging-KV", "production-KV")
        KV_LIST=$(npx wrangler kv namespace list 2>/dev/null || echo "[]")
        KV_ID=$(echo "$KV_LIST" | grep -B 1 "\"title\": \"${ENV}-KV\"" | grep '"id"' | sed -E 's/.*"id": "([^"]+)".*/\1/' | head -1)
    else
        KV_ID=$(echo "$KV_OUTPUT" | grep -oE 'id = "[^"]+"' | sed 's/id = "\(.*\)"/\1/')
    fi

    if [ -n "$KV_ID" ]; then
        # Store in environment-specific variable
        case "$SUFFIX" in
            "dev")
                KV_ID_DEV="$KV_ID"
                ;;
            "staging")
                KV_ID_STAGING="$KV_ID"
                ;;
            "production")
                KV_ID_PROD="$KV_ID"
                ;;
        esac
        echo -e "  ${GREEN}✓${NC} KV ID: ${KV_ID}"
    else
        echo -e "  ${RED}✗${NC} Failed to create/find KV namespace"
        exit 1
    fi
    echo ""

    # Create R2 Bucket
    echo -e "  ${BLUE}→${NC} Creating R2 bucket: gsd-backups-${SUFFIX}"
    if npx wrangler r2 bucket create "gsd-backups-${SUFFIX}" 2>&1 | grep -q "already exists"; then
        echo -e "  ${YELLOW}⚠${NC}  R2 bucket already exists"
    else
        echo -e "  ${GREEN}✓${NC} R2 bucket created"
    fi
    echo ""
done

# ========================================
# Step 3: Update wrangler.toml
# ========================================
echo ""
echo -e "${BLUE}[3/4]${NC} Updating wrangler.toml with resource IDs..."
echo ""

# Update each environment in wrangler.toml
for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    SUFFIX="${ENV_SUFFIXES[$i]}"

    # Get the appropriate IDs based on suffix
    case "$SUFFIX" in
        "dev")
            DB_ID="$DB_ID_DEV"
            KV_ID="$KV_ID_DEV"
            ;;
        "staging")
            DB_ID="$DB_ID_STAGING"
            KV_ID="$KV_ID_STAGING"
            ;;
        "production")
            DB_ID="$DB_ID_PROD"
            KV_ID="$KV_ID_PROD"
            ;;
    esac

    echo -e "  ${BLUE}→${NC} Updating ${ENV} environment..."

    # Convert ENV to uppercase for placeholder matching
    ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')

    # Update database_id and KV_id
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/REPLACE_WITH_${ENV_UPPER}_DB_ID/${DB_ID}/" wrangler.toml
        sed -i '' "s/REPLACE_WITH_${ENV_UPPER}_KV_ID/${KV_ID}/" wrangler.toml
    else
        # Linux
        sed -i "s/REPLACE_WITH_${ENV_UPPER}_DB_ID/${DB_ID}/" wrangler.toml
        sed -i "s/REPLACE_WITH_${ENV_UPPER}_KV_ID/${KV_ID}/" wrangler.toml
    fi

    echo -e "  ${GREEN}✓${NC} Updated wrangler.toml for ${ENV}"
done

echo -e "${GREEN}✓ wrangler.toml updated${NC}"
echo ""

# ========================================
# Step 4: Set Secrets & Apply Schema
# ========================================
echo -e "${BLUE}[4/4]${NC} Setting secrets and applying database schema..."
echo ""

for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    SUFFIX="${ENV_SUFFIXES[$i]}"

    echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
    echo -e "${YELLOW}Configuring ${ENV} environment${NC}"
    echo -e "${YELLOW}────────────────────────────────────────────────────────${NC}"
    echo ""

    # Generate unique secrets for each environment
    echo -e "  ${BLUE}→${NC} Generating secrets for ${ENV}..."
    JWT_SECRET=$(openssl rand -base64 32)
    ENCRYPTION_SALT=$(openssl rand -base64 32)

    echo -e "  ${GREEN}✓${NC} Generated JWT_SECRET and ENCRYPTION_SALT"
    echo ""

    # Save secrets to environment-specific file
    SECRETS_FILE="secrets-${SUFFIX}.txt"
    ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')
    cat > "$SECRETS_FILE" << EOF
# GSD Sync Worker Secrets - ${ENV_UPPER} ENVIRONMENT
# Generated: $(date)
# DO NOT COMMIT TO GIT

JWT_SECRET=${JWT_SECRET}
ENCRYPTION_SALT=${ENCRYPTION_SALT}

# Set these manually via Cloudflare dashboard or wrangler CLI:
# GOOGLE_CLIENT_SECRET=your_google_client_secret
# APPLE_CLIENT_ID=your_apple_client_id
# APPLE_TEAM_ID=your_apple_team_id
# APPLE_KEY_ID=your_apple_key_id
# APPLE_PRIVATE_KEY=your_apple_private_key
EOF

    echo -e "  ${GREEN}✓${NC} Secrets saved to: ${SECRETS_FILE}"
    echo ""

    # Set secrets via wrangler
    echo -e "  ${BLUE}→${NC} Setting JWT_SECRET for ${ENV}..."
    echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET --env "${ENV}" > /dev/null
    echo -e "  ${GREEN}✓${NC} JWT_SECRET set"

    echo -e "  ${BLUE}→${NC} Setting ENCRYPTION_SALT for ${ENV}..."
    echo "$ENCRYPTION_SALT" | npx wrangler secret put ENCRYPTION_SALT --env "${ENV}" > /dev/null
    echo -e "  ${GREEN}✓${NC} ENCRYPTION_SALT set"
    echo ""

    # Apply database schema
    echo -e "  ${BLUE}→${NC} Applying database schema to ${ENV}..."

    # Apply migrations if migrations folder exists, otherwise use schema.sql
    if [ -d "migrations" ] && [ "$(ls -A migrations)" ]; then
        echo -e "  ${BLUE}→${NC} Applying migrations to gsd-sync-${SUFFIX}..."
        npx wrangler d1 migrations apply "gsd-sync-${SUFFIX}" --remote > /dev/null 2>&1
    elif [ -f "schema.sql" ]; then
        echo -e "  ${BLUE}→${NC} Applying schema.sql to gsd-sync-${SUFFIX}..."
        npx wrangler d1 execute "gsd-sync-${SUFFIX}" --remote --file=./schema.sql > /dev/null 2>&1
    fi

    echo -e "  ${GREEN}✓${NC} Database schema applied"
    echo ""
done

# ========================================
# Summary
# ========================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Multi-Environment Setup Complete!                      ║${NC}"
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""
echo -e "${BLUE}Resources Created:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    SUFFIX="${ENV_SUFFIXES[$i]}"

    # Get the appropriate IDs based on suffix
    case "$SUFFIX" in
        "dev")
            DB_ID="$DB_ID_DEV"
            KV_ID="$KV_ID_DEV"
            ;;
        "staging")
            DB_ID="$DB_ID_STAGING"
            KV_ID="$KV_ID_STAGING"
            ;;
        "production")
            DB_ID="$DB_ID_PROD"
            KV_ID="$KV_ID_PROD"
            ;;
    esac

    ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')
    echo ""
    echo -e "${YELLOW}${ENV_UPPER} Environment:${NC}"
    echo -e "  Worker: gsd-sync-worker-${SUFFIX}"
    echo -e "  D1 Database: gsd-sync-${SUFFIX} (${DB_ID})"
    echo -e "  KV Namespace: ${KV_ID}"
    echo -e "  R2 Bucket: gsd-backups-${SUFFIX}"
    echo -e "  Secrets: See secrets-${SUFFIX}.txt"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Review and commit the updated wrangler.toml"
echo "  2. Store the secrets files in a secure location (DO NOT commit)"
echo "  3. Deploy all environments:"
echo "     npm run deploy:all"
echo ""
echo "  Or deploy individually:"
echo "     npm run deploy              # Development"
echo "     npm run deploy:staging      # Staging"
echo "     npm run deploy:production   # Production"
echo ""
echo -e "${YELLOW}⚠  Remember to set OAuth secrets manually:${NC}"
echo "   wrangler secret put GOOGLE_CLIENT_SECRET --env <environment>"
echo ""
