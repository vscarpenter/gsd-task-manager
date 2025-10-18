#!/bin/bash
# GSD Sync Worker - Quick Setup Script
# Run this in your terminal after authenticating with Cloudflare

set -e  # Exit on error

echo "🚀 GSD Sync Worker Setup"
echo "========================"
echo ""

# Check if wrangler is authenticated
echo "📋 Step 1: Checking Cloudflare authentication..."
if ! npx wrangler whoami > /dev/null 2>&1; then
    echo "❌ Not authenticated. Please run:"
    echo "   npx wrangler login"
    exit 1
fi
echo "✅ Authenticated"
echo ""

# Create D1 Database
echo "📋 Step 2: Creating D1 database..."
echo "Running: npx wrangler d1 create gsd-sync"
echo ""
echo "⚠️  IMPORTANT: Copy the database_id from the output below"
echo "   and update wrangler.toml line 14"
echo ""
npx wrangler d1 create gsd-sync
echo ""
read -p "Press Enter after updating wrangler.toml with database_id..."

# Create KV Namespace
echo ""
echo "📋 Step 3: Creating KV namespace..."
echo "Running: npx wrangler kv namespace create KV"
echo ""
echo "⚠️  IMPORTANT: Copy the 'id' from the output below"
echo "   and update wrangler.toml line 29"
echo ""
npx wrangler kv namespace create "KV"
echo ""
read -p "Press Enter after updating wrangler.toml with KV id..."

# Create R2 Bucket
echo ""
echo "📋 Step 4: Creating R2 bucket..."
npx wrangler r2 bucket create gsd-backups
echo "✅ R2 bucket created"
echo ""

# Set secrets
echo "📋 Step 5: Setting secrets..."
echo ""
echo "Generating secure random secrets..."
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_SALT=$(openssl rand -base64 32)

echo ""
echo "⚠️  SAVE THESE SECRETS IN A SECURE LOCATION:"
echo "   JWT_SECRET: $JWT_SECRET"
echo "   ENCRYPTION_SALT: $ENCRYPTION_SALT"
echo ""
read -p "Press Enter to set JWT_SECRET..."
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET

echo ""
read -p "Press Enter to set ENCRYPTION_SALT..."
echo "$ENCRYPTION_SALT" | npx wrangler secret put ENCRYPTION_SALT

echo "✅ Secrets configured"
echo ""

# Apply database schema
echo "📋 Step 6: Applying database schema..."
echo "Applying to local database..."
npx wrangler d1 execute gsd-sync --local --file=./schema.sql
echo ""
echo "Applying to remote database..."
npx wrangler d1 execute gsd-sync --remote --file=./schema.sql
echo "✅ Schema applied"
echo ""

# Deploy
echo "📋 Step 7: Deploying to Cloudflare..."
npx wrangler deploy
echo "✅ Deployed!"
echo ""

echo "🎉 Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Note your Worker URL from the output above"
echo "2. Update src/middleware/cors.ts with your domain"
echo "3. Redeploy with: npx wrangler deploy"
echo "4. Test with: curl https://your-worker-url/health"
echo ""
echo "📚 See SETUP.md for detailed documentation"
