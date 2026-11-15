# 0023: Monitor production with independent probes and aggregate metrics

| Field | Value |
|---|---|
| Date | 2026-11-15 |
| Status | Accepted |
| Deciders | Vinny Carpenter (privacy requirement), Codex (implementation) |
| Related | ADR 0017, `docs/ops/production-monitoring.md` |

## Context

The 14.9.2 release passed a manual production watch. CloudFront had no GSD
distribution alarms, and the app deliberately ships no error-reporting SDK.
An unattended outage needed an alert path independent of a desktop session.

## Decision

Run a small AWS Lambda every minute against fixed public endpoints. Validate
the homepage, service worker, a same-origin bootstrap asset and PocketBase
health. Emit only fixed check names, success values, bounded durations and
allowlisted failure codes. Keep the aggregate logs for seven days.

CloudWatch groups probe failures, missing heartbeats, execution failures,
CloudFront 5xx and host status into a critical alarm. Sustained tail latency
and high 4xx rates form a warning alarm. Use the owner's existing confirmed
email subscription until an AWS SMS sender and destination are verified.

The function role writes only its own log streams. It has no application
credentials or data-store permissions. Monitoring adds no client SDK,
collector endpoint, access logs, user identifiers, screenshots or payload
storage. Public response bodies are bounded, validated in memory and discarded;
exceptions are replaced by fixed failure codes before logging.

The hourly desktop review uses a fresh Chromium profile and synthetic local
tasks. Regular browser requests are restricted to the public app and backend
health. Results contain counters and fixed check names, with no task text,
console messages, screenshots or network payloads.

## Consequences

Infrastructure and public-surface failures can alert while the owner's Mac is
asleep. A stopped probe is itself an alarm. Operator browser checks add coverage
for focus, editing and offline persistence when the desktop task runs.

There is still no aggregate view of real users' browser errors or authenticated
sync operations. Those rely on user reports and explicit integration tests.
Hourly desktop checks depend on the Codex app and installed browser runtimes;
the native AWS probes and notifications do not.

Async probe invocations use no dead-letter queue: checks are stateless and the
next scheduled run retries, while missing heartbeats and native Lambda errors
detect persistent failures. No task or event payload requires recovery.

## Alternatives

- A replacement client telemetry SDK would change ADR 0017's privacy contract.
- A desktop-only watch would depend on local credentials and wake state.
- Managed browser canaries would add runtime and artifact-storage management
  for the frequent availability checks; existing release CI and the isolated
  desktop check provide browser coverage alongside the small native probe.
