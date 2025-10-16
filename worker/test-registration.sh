#!/bin/bash

echo "Testing registration endpoint..."
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"SecurePassword123!","deviceName":"Test Device"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "201" ]; then
    echo "✅ Registration successful!"
else
    echo "❌ Registration failed"
    echo ""
    echo "Checking worker logs..."
    npx wrangler tail --format pretty &
    TAIL_PID=$!
    sleep 2

    # Try again to trigger logs
    curl -s -X POST \
      https://gsd-sync-worker.vscarpenter.workers.dev/api/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email":"test2@example.com","password":"SecurePassword123!","deviceName":"Test Device"}' > /dev/null

    sleep 3
    kill $TAIL_PID 2>/dev/null
fi
