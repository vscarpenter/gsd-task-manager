# GSD production monitoring

The `gsd-production-monitoring` stack in us-east-1 runs public health checks once
a minute. CloudWatch sends grouped failure and recovery notifications through
the existing `account-alerts` email subscription. `monitoring/production.json`
contains the deployment targets. Infrastructure is independent of app releases.

## What is checked

| Signal | Alert condition |
|---|---|
| Homepage, service worker, bootstrap JavaScript, PocketBase health | Two failures or missing samples out of three one-minute periods |
| Probe completion heartbeat | Two missing one-minute periods out of three |
| Lambda execution errors | Errors in two of three one-minute periods |
| CloudFront 5xx | At least 1% in two of three one-minute periods |
| Backend EC2 status | Failed checks in two of three one-minute periods |
| Probe latency | p95 at least 2,500 ms in two of three five-minute periods |
| CloudFront 4xx | At least 20% in two of three five-minute periods |

Availability signals feed one critical alarm. Latency and 4xx feed a warning
alarm, suppressed while the critical alarm is active. Both send recovery
notifications. Metric publication and CloudWatch evaluation can add delay.

## Privacy boundary

The monitor sends unauthenticated GET/HEAD requests to fixed public URLs. The
asset check permits only HTTPS scripts under the app's own `/_next/static/`
directory, without credentials, queries or fragments. It rejects redirects and
HTML error fallbacks. It never requests a task collection or an account API.

CloudWatch receives binary success values, bounded timings, fixed check names
and fixed failure codes. Seven-day logs contain those same aggregate records.
There are no response bodies, headers, cookies, tokens, task text, user IDs,
IP addresses or free-form exceptions in monitoring output. The Lambda role can
write only its own logs. CloudFront access logging remains outside this setup.

Browser checks create only synthetic local tasks in a disposable unsigned-in
Chromium profile, discard the profile and output fixed result names/counters.
Browser request interception restricts public reads and blocks backend task
access. Service workers still use the isolated profile's storage. No screenshots,
traces, videos or console payloads are saved. Real-user browser errors and
authenticated sync activity are not centrally collected; see ADR 0017.

## Operator checks

```bash
bun run monitoring:check
bun run monitoring:browser
aws cloudwatch describe-alarms --region us-east-1 \
  --alarm-name-prefix gsd-production-monitoring \
  --alarm-types MetricAlarm CompositeAlarm
```

The first command checks the four public surfaces. The second also verifies
capture focus, pending subtasks, the running version and release notes, offline
persistence, completion/deletion and browser diagnostics. Browser transport
errors during the intentional offline phase and canceled navigations are
counted separately from unexpected runtime failures.

The AWS CLI defaults to metric alarms. Include both types to see the grouped
notification alarms. For their action history, use `describe-alarm-history`
with `--alarm-types CompositeAlarm`.

The hourly Codex thread check is supplementary. Its public checks need no AWS
credentials; alarm inspection requires a valid local AWS session. It must not
sign in to a real GSD account, fetch task records, install telemetry, modify
production or automatically refresh an expired interactive login.

## Deploy or update

Commit monitoring source and run its tests before planning. Rendered templates
include the exact `probe.cjs` source inline, so no artifact bucket is needed.

```bash
bun run monitoring:template > /tmp/gsd-monitoring.json
cfn-lint --regions us-east-1 --template /tmp/gsd-monitoring.json
cfn-guard validate --rules monitoring/privacy.guard --data /tmp/gsd-monitoring.json
bash monitoring/deploy.sh plan false
```

Inspect the returned change set with `describe-change-set` and `describe-events`.
The initial plan adds monitoring resources only. Then execute its exact ARN:

```bash
bash monitoring/deploy.sh execute CHANGESET_ARN
```

Wait for stack completion and scheduled successful runs. Confirm all normal
alarm states are OK. Run `bash monitoring/deploy.sh plan true`, review and
execute that update to enable notifications. Use the dashboard URL in the stack
outputs to inspect the child alarms when an alert fires.

Validate the notification path with a controlled `set-alarm-state` on the
website child alarm, clearly labeled as a test. The composite sends ALARM, then
the next healthy metric evaluation restores OK and sends recovery. Verify the
SNS actions in alarm history. An accepted SNS action does not prove that a
recipient has read the email. Do not force the composite alarm itself: composite
alarms may stay in a manually-set state until a child changes state.

## SMS follow-up

The existing SMS subscription cannot receive alerts while the AWS SMS account
has no verified sandbox destination or registered origination number.
AWS rejected its verification request with `No origination entities available
to send`. No OTP was sent. The owner chose confirmed email until SMS is ready.

After a suitable sender is registered and the destination is verified, change
`alarmTopicArn` to the existing `vinny-text-notify` topic, review an update plan
and retest failure/recovery delivery. Follow [AWS's sandbox setup](https://docs.aws.amazon.com/sns/latest/dg/sns-sms-sandbox-verifying-phone-numbers.html)
and [origination identity registration](https://docs.aws.amazon.com/sms-voice/latest/userguide/registrations.html).

## Updating and removing monitoring

Future semantic app build versions and bootstrap filenames are discovered from
the public deployment. UI selector changes may require updating the browser
check. For infrastructure drift, compare the stack with the rendered template
before applying a new plan. Do not change application data or roll back a release
in response to a single synthetic failure.

Deleting this stack stops its schedule, probe, dashboard and alarms. The log
group is retained with its seven-day retention policy. Existing SNS topics,
subscriptions, CloudFront and EC2 resources are not owned by this stack.

## Activation record — 2026-11-15

The stack was created from committed monitoring source `3fc2c3c4`. The installed
Lambda source was downloaded and matched byte for byte. Scheduled runs passed
all four public checks; CloudWatch received their metrics and heartbeat. All
15 alarms reached OK before notification actions were enabled.

A controlled website-child alarm triggered the critical email at 19:41:40 UTC.
Normal healthy metric evaluation restored OK and sent recovery at 19:42:10 UTC.
Both SNS actions succeeded, and both messages were verified in Gmail. All 15
alarms returned to OK with critical and warning email actions enabled.

The hourly `GSD production health` Codex heartbeat is active as a secondary
check. The live app remains 14.9.2; this setup did not deploy an app artifact.
