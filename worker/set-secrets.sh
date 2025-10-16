#!/bin/bash
# Generate and set secrets for GSD Sync Worker

echo "🔐 Generating secure secrets..."
echo ""

# Generate random secrets
JWT_SECRET=$(openssl rand -base64 32)
ENCRYPTION_SALT=$(openssl rand -base64 32)

echo "Generated secrets:"
echo "─────────────────────────────────────────────────────────"
echo "JWT_SECRET: $JWT_SECRET"
echo "ENCRYPTION_SALT: $ENCRYPTION_SALT"
echo "─────────────────────────────────────────────────────────"
echo ""
echo "⚠️  SAVE THESE SOMEWHERE SECURE (password manager)!"
echo ""
read -p "Press Enter to set JWT_SECRET in Cloudflare..."

# Set JWT_SECRET
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET

echo ""
read -p "Press Enter to set ENCRYPTION_SALT in Cloudflare..."

# Set ENCRYPTION_SALT
echo "$ENCRYPTION_SALT" | npx wrangler secret put ENCRYPTION_SALT

echo ""
echo "✅ Secrets set successfully!"
echo ""
echo "Secrets saved to: ./secrets.txt (DO NOT COMMIT THIS FILE)"
cat > secrets.txt << EOF
# GSD Sync Worker Secrets
# Generated: $(date)
# DO NOT COMMIT TO GIT

JWT_SECRET=$JWT_SECRET
ENCRYPTION_SALT=$ENCRYPTION_SALT
EOF

echo ""
echo "Next step: Redeploy the worker with 'npx wrangler deploy'"
