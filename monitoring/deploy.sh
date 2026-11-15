#!/usr/bin/env bash
set -euo pipefail

MONITOR_REPO=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
MONITOR_MODE=${1:-plan}
MONITOR_TEMP=$(mktemp -d "${TMPDIR:-/tmp}/gsd-monitoring-deploy.XXXXXX")
trap 'rm -r "$MONITOR_TEMP"' EXIT

read_config() {
  node -e 'const c=require(process.argv[1]);process.stdout.write(c[process.argv[2]])' \
    "$MONITOR_REPO/monitoring/production.json" "$1"
}

MONITOR_REGION=$(read_config region)
MONITOR_ACCOUNT=$(read_config accountId)
MONITOR_STACK=$(read_config stackName)

verify_account() {
  local current_account
  current_account=$(aws sts get-caller-identity --query Account --output text --no-cli-pager)
  if [[ "$current_account" != "$MONITOR_ACCOUNT" ]]; then
    echo "Monitoring deployment account does not match production.json" >&2
    exit 1
  fi
}

verify_account

if [[ "$MONITOR_MODE" == execute ]]; then
  MONITOR_CHANGESET=${2:?Usage: monitoring/deploy.sh execute CHANGESET_ARN}
  aws cloudformation describe-change-set --region "$MONITOR_REGION" \
    --change-set-name "$MONITOR_CHANGESET" --output json --no-cli-pager \
    > "$MONITOR_TEMP/change-set.json"
  node - "$MONITOR_TEMP/change-set.json" "$MONITOR_STACK" <<'JS'
const fs = require("node:fs");
const changeSet = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
if (changeSet.StackName !== process.argv[3] || changeSet.Status !== "CREATE_COMPLETE" || changeSet.ExecutionStatus !== "AVAILABLE") {
  throw new Error("Change set is not an available plan for this monitoring stack");
}
JS
  aws cloudformation execute-change-set --region "$MONITOR_REGION" \
    --change-set-name "$MONITOR_CHANGESET" --no-cli-pager
  echo "Executed the reviewed monitoring change set."
  exit 0
fi

if [[ "$MONITOR_MODE" != plan ]]; then
  echo "Usage: monitoring/deploy.sh plan [false|true] | execute CHANGESET_ARN" >&2
  exit 1
fi

MONITOR_NOTIFICATIONS=${2:-false}
if [[ "$MONITOR_NOTIFICATIONS" != false && "$MONITOR_NOTIFICATIONS" != true ]]; then
  echo "Notification setting must be false or true" >&2
  exit 1
fi

if [[ -n "$(git -C "$MONITOR_REPO" status --porcelain -- monitoring)" ]]; then
  echo "Commit monitoring source before creating a deployment plan" >&2
  exit 1
fi

node "$MONITOR_REPO/monitoring/render-template.cjs" > "$MONITOR_TEMP/template.json"
node - "$MONITOR_REPO/monitoring/production.json" "$MONITOR_NOTIFICATIONS" <<'JS' > "$MONITOR_TEMP/parameters.json"
const c = require(process.argv[2]);
const expectedPrefix = `arn:aws:sns:${c.region}:${c.accountId}:`;
if (!c.alarmTopicArn.startsWith(expectedPrefix)) throw new Error("Alert topic must be in the deployment account and region");
process.stdout.write(JSON.stringify([
  { ParameterKey: "AlarmTopicArn", ParameterValue: c.alarmTopicArn },
  { ParameterKey: "DistributionId", ParameterValue: c.distributionId },
  { ParameterKey: "BackendInstanceId", ParameterValue: c.backendInstanceId },
  { ParameterKey: "NotificationsEnabled", ParameterValue: process.argv[3] },
]));
JS

aws cloudformation validate-template --region "$MONITOR_REGION" \
  --template-body "file://$MONITOR_TEMP/template.json" --no-cli-pager >/dev/null

MONITOR_CHANGE_TYPE=UPDATE
if ! aws cloudformation describe-stacks --region "$MONITOR_REGION" \
  --stack-name "$MONITOR_STACK" --no-cli-pager \
  > "$MONITOR_TEMP/stack.json" 2> "$MONITOR_TEMP/stack-error.txt"; then
  if rg -q 'does not exist' "$MONITOR_TEMP/stack-error.txt"; then
    MONITOR_CHANGE_TYPE=CREATE
  else
    cat "$MONITOR_TEMP/stack-error.txt" >&2
    exit 1
  fi
elif [[ "$(node -e 'const s=require(process.argv[1]);process.stdout.write(s.Stacks[0].StackStatus)' "$MONITOR_TEMP/stack.json")" == REVIEW_IN_PROGRESS ]]; then
  MONITOR_CHANGE_TYPE=CREATE
fi

MONITOR_PLAN_NAME="monitoring-$(date -u +%Y%m%dT%H%M%SZ)"
MONITOR_REVISION=$(git -C "$MONITOR_REPO" rev-parse HEAD)
aws cloudformation create-change-set --region "$MONITOR_REGION" \
  --stack-name "$MONITOR_STACK" --change-set-name "$MONITOR_PLAN_NAME" \
  --change-set-type "$MONITOR_CHANGE_TYPE" --capabilities CAPABILITY_IAM \
  --template-body "file://$MONITOR_TEMP/template.json" \
  --parameters "file://$MONITOR_TEMP/parameters.json" \
  --tags Key=Application,Value=GSD Key=Purpose,Value=ProductionMonitoring \
    Key=Privacy,Value=AggregateOnly "Key=SourceRevision,Value=$MONITOR_REVISION" \
  --output json --no-cli-pager

echo "Change set created for review; no monitoring resources have been provisioned by this command."
echo "Inspect describe-change-set and describe-events before executing the returned ARN."
