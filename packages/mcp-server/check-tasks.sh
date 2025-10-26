#!/bin/bash

echo "🔍 Checking for tasks in GSD database"
echo "======================================"
echo ""

cd /Users/vinnycarpenter/Projects/gsd-taskmanager/worker

# Query the database directly to see if there are any tasks
echo "Querying encrypted_tasks table..."
npx wrangler d1 execute gsd-sync-production --command "SELECT COUNT(*) as total_tasks,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as active_tasks,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as deleted_tasks,
  MAX(updated_at) as last_updated
FROM encrypted_tasks
WHERE user_id = 'F-j_oZam-kT5PHw_bdipxw'" --env production 2>&1

echo ""
echo "If total_tasks = 0, you need to:"
echo "  1. Open https://gsd.vinny.dev"
echo "  2. Create at least 1 task"
echo "  3. Trigger sync in Settings → Sync"
echo "  4. Try again with Claude"
