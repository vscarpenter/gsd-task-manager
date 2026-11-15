# Production monitoring without task content

Date: 2026-11-15. Tier: non-trivial infrastructure change.

## Goal

Implement the owner's request for ongoing production checks and alerts while
preserving ADR 0017: the web app and MCP server ship no error-reporting SDK.
Health checks must run independently of the owner's Mac and SSO session.

## Inputs and outputs

- Check the public app at `https://gsd.vinny.dev` and PocketBase's public health
  endpoint at `https://api.vinny.io/api/health` once a minute.
- Check homepage identity/cache policy, the stamped service worker, and a
  same-origin bootstrap asset's status and content type.
- Emit only bounded timings, binary success values, and fixed failure codes
  under `GSD/Production`. Keep diagnostic logs for seven days.
- Watch native CloudFront errors and the existing PocketBase EC2 instance's
  status, plus probe failures, missing heartbeats and Lambda execution errors.
- Group critical failures into one SNS alert/recovery stream using the existing
  confirmed `account-alerts` email subscription. Group sustained latency separately.
- Provide a CloudWatch dashboard and an operator runbook.
- Add an hourly Codex thread check as a secondary review; native AWS alerts
  remain independent of the desktop app and local credentials.

## Privacy and scope

- No client instrumentation, user sessions, user identifiers, request IPs,
  cookies, authorization tokens, task collection reads, real-user browser logs,
  screenshots, traces, request bodies, response bodies or free-form exceptions
  enter monitoring output.
- Probe requests use fixed public endpoints, omit credentials and reject
  redirects. A bootstrap asset must be HTTPS, same-origin, under
  `/_next/static/`, with no query, fragment or credentials.
- Read only bounded public response bodies needed for validation. Never persist
  their contents. Errors map to an allowlist; discard exception messages.
- The Lambda role can write only its own log streams. It has no PocketBase
  credentials, task-data access or application deployment authority.
- Browser checks use disposable unsigned-in profiles and synthetic local tasks.
  Block backend requests other than the public health check; save no screenshots
  or browser payloads.
- Add monitoring resources in their own CloudFormation stack. Existing app
  deployment, CloudFront configuration, SNS subscriptions and EC2 recovery
  actions remain owned by their current configuration.
- App version stays 14.9.2. Probes accept future semantic build versions and
  discover their bootstrap asset from the current public page.

## Failure behavior

- Two failed one-minute samples out of three alert for availability. Missing
  probe data breaches the heartbeat/availability alarms.
- Native sparse error counters treat absent data as healthy; probe heartbeats
  cover a stopped or broken checker.
- Sustained high tail latency alerts independently. Expected low-traffic periods
  must not page solely because CloudFront has no requests.
- Bootstrap with notifications disabled, observe successful scheduled probes,
  then enable notifications and verify an alarm/recovery through the SNS path.
- No automatic rollback, reboot or application changes are performed by probes.

## Acceptance criteria and test stubs

1. Healthy, malformed, oversized, redirected and failing public responses produce
   the correct fixed outcomes. Network failures and timeouts cannot hang runs.
2. An HTML fallback masquerading as a JavaScript asset fails the probe. External
   URLs, private addresses, paths outside the asset directory and query strings
   cannot become asset requests.
3. Private markers placed in mock bodies, headers, events and exception messages
   never appear in logs, emitted metrics or handler return values.
4. The rendered template has bounded IAM, retention, heartbeat alarms, grouped
   notifications and a schedule. No user-data storage or telemetry collector is
   provisioned.
5. Required repository checks, CloudFormation lint, policy checks and AWS
   pre-deployment validation pass before execution.
6. A scheduled AWS run publishes successful metrics without local credentials;
   normal alarms reach OK. A controlled alarm/recovery executes SNS actions.
7. A committed operator command and hourly heartbeat can recheck production
   without accessing user data. Document availability and delivery limits.

## Implementation plan

1. Write red tests for the probe's failure handling, privacy boundaries and
   CloudFormation permissions; implement the smallest dependency-free probe.
2. Render its source into an inline Node.js 24 Lambda template. Add grouped
   alarms, a dashboard, deployment tooling, ADR and runbook.
3. Validate locally, commit and open a PR; resolve CI and review findings.
4. Review the exact additive change set and deploy the authorized monitoring
   stack. Verify scheduled runs, metrics and email alert/recovery actions.
5. Create the hourly thread heartbeat, save a receipt and report active coverage.

Notification decision: AWS could not send the SMS verification code because no
origination identity is registered. The owner chose the existing confirmed Gmail
channel until SMS is ready. SMS activation requires a registered sender and a
verified destination; no verification code was sent.

## Change report

The release watch was temporary and depended on an operator session. This adds
an independent AWS schedule, public probes, aggregate metrics, grouped alarms
and a dashboard. A separate operator command exercises local task behavior in
a disposable browser profile. App code, task schemas, sync hooks, release
artifacts and production deployment workflows are unaffected.

The probe has no runtime dependencies. CloudFormation embeds the tested source
directly; its only IAM permissions write to its own log group. Existing
CloudFront, EC2 and SNS resources supply metrics and the notification route;
the stack does not manage or replace them. Notifications start disabled to
avoid bootstrap noise. The missing-heartbeat alarm covers a broken schedule
or probe even when no error metric is emitted.

Validation: 47 new regressions; 5,047 passing application tests across 373
files; required type, lint, shape and unused-dependency checks passed. The
deterministic monitoring modules exceed 80% statement, line and function
coverage. The public probes and fresh Chromium operator check passed live.
Rendered CloudFormation passes cfn-lint, all four Guard rules and AWS template
validation. Actual change-set review and deployment verification follow.

### Review questions

1. What alerts if EventBridge stops invoking the function and Lambda emits no
   execution error?
2. Which response fields can leave the validation boundary, and how are
   unexpected exceptions prevented from disclosing response content?
3. Why are notification actions disabled for the initial deployment, and which
   alarm should be forced during the controlled notification test?
4. What coverage remains when the Mac is asleep or local AWS credentials expire,
   and which browser or authenticated sync failures remain outside that coverage?
