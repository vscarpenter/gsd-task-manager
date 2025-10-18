#!/bin/bash
# GSD Sync Worker - Deploy to All Environments
# Sequentially deploys to development, staging, and production

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track deployment status (indexed arrays for Bash 3.2 compatibility)
DEPLOY_STATUS_DEV=""
DEPLOY_STATUS_STAGING=""
DEPLOY_STATUS_PROD=""
DEPLOY_URL_DEV=""
DEPLOY_URL_STAGING=""
DEPLOY_URL_PROD=""

ENVIRONMENTS=("development" "staging" "production")

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  GSD Sync Worker - Deploy All Environments                ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

# ========================================
# Pre-flight Checks
# ========================================
echo -e "${BLUE}[Pre-flight]${NC} Running checks..."
echo ""

# Check authentication
echo -e "  ${BLUE}→${NC} Checking Cloudflare authentication..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo -e "  ${RED}✗ Not authenticated${NC}"
    echo ""
    echo "Please run: npx wrangler login"
    exit 1
fi
echo -e "  ${GREEN}✓${NC} Authenticated"

# Check TypeScript compilation
echo -e "  ${BLUE}→${NC} Running TypeScript type check..."
if npm run typecheck > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} TypeScript compilation successful"
else
    echo -e "  ${RED}✗ TypeScript errors found${NC}"
    echo ""
    echo "Please fix TypeScript errors before deploying:"
    npm run typecheck
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Pre-flight checks passed${NC}"
echo ""

# ========================================
# Deploy to Each Environment
# ========================================
for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    ENV_NUM=$((i + 1))
    ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')

    echo ""
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}[${ENV_NUM}/3] Deploying to ${ENV_UPPER}${NC}"
    echo -e "${YELLOW}════════════════════════════════════════════════════════${NC}"
    echo ""

    # Deploy (show output in real-time)
    echo -e "  ${BLUE}→${NC} Running wrangler deploy..."
    echo ""

    if [ "$ENV" = "development" ]; then
        # Development uses default env
        npx wrangler deploy --env development
        DEPLOY_EXIT_CODE=$?
    else
        npx wrangler deploy --env "$ENV"
        DEPLOY_EXIT_CODE=$?
    fi

    echo ""

    # Check if deployment succeeded
    if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
        WORKER_URL="N/A"  # We'll show success without trying to extract URL for now

        # Store status and URL based on environment
        case "$ENV" in
            "development")
                DEPLOY_STATUS_DEV="✓"
                DEPLOY_URL_DEV="$WORKER_URL"
                ;;
            "staging")
                DEPLOY_STATUS_STAGING="✓"
                DEPLOY_URL_STAGING="$WORKER_URL"
                ;;
            "production")
                DEPLOY_STATUS_PROD="✓"
                DEPLOY_URL_PROD="$WORKER_URL"
                ;;
        esac

        echo -e "${GREEN}✓ Deployed successfully to ${ENV}${NC}"
        echo -e "  URL: ${WORKER_URL}"
    else
        # Store failure status
        case "$ENV" in
            "development")
                DEPLOY_STATUS_DEV="✗"
                DEPLOY_URL_DEV="Failed"
                ;;
            "staging")
                DEPLOY_STATUS_STAGING="✗"
                DEPLOY_URL_STAGING="Failed"
                ;;
            "production")
                DEPLOY_STATUS_PROD="✗"
                DEPLOY_URL_PROD="Failed"
                ;;
        esac

        echo -e "${RED}✗ Deployment to ${ENV} failed${NC}"
        echo ""
        echo "See error output above."
        echo ""

        # Ask if user wants to continue
        read -p "Continue with remaining environments? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo ""
            echo -e "${RED}Deployment aborted${NC}"
            exit 1
        fi
    fi
    echo ""
done

# ========================================
# Summary
# ========================================
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deployment Summary                                        ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo ""

ALL_SUCCESS=true

for i in 0 1 2; do
    ENV="${ENVIRONMENTS[$i]}"
    ENV_UPPER=$(echo "$ENV" | tr '[:lower:]' '[:upper:]')

    # Get status and URL based on environment
    case "$ENV" in
        "development")
            STATUS="$DEPLOY_STATUS_DEV"
            URL="$DEPLOY_URL_DEV"
            ;;
        "staging")
            STATUS="$DEPLOY_STATUS_STAGING"
            URL="$DEPLOY_URL_STAGING"
            ;;
        "production")
            STATUS="$DEPLOY_STATUS_PROD"
            URL="$DEPLOY_URL_PROD"
            ;;
    esac

    if [ "$STATUS" = "✓" ]; then
        echo -e "${GREEN}${STATUS}${NC} ${ENV_UPPER}"
        echo -e "   ${URL}"
    else
        echo -e "${RED}${STATUS}${NC} ${ENV_UPPER}"
        echo -e "   Deployment failed"
        ALL_SUCCESS=false
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$ALL_SUCCESS" = true ]; then
    echo -e "${GREEN}✓ All environments deployed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Check the worker URLs in the Cloudflare dashboard"
    echo "  2. Test each environment's /health endpoint"
    echo "  3. Verify OAuth configuration"
    echo "  4. Test sync functionality in each environment"
    echo ""
    echo -e "${BLUE}View workers:${NC}"
    echo "  https://dash.cloudflare.com/workers"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠ Some deployments failed${NC}"
    echo ""
    echo "Please check the errors above and redeploy failed environments individually:"

    # Check each environment
    if [ "$DEPLOY_STATUS_DEV" != "✓" ]; then
        echo "  npm run deploy              # development"
    fi
    if [ "$DEPLOY_STATUS_STAGING" != "✓" ]; then
        echo "  npm run deploy:staging      # staging"
    fi
    if [ "$DEPLOY_STATUS_PROD" != "✓" ]; then
        echo "  npm run deploy:production   # production"
    fi

    echo ""
    exit 1
fi
