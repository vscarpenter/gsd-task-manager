# 0016: Hosted sync defers field encryption

| Field | Value |
|---|---|
| Date | 2026-09-19 |
| Status | Accepted |
| Deciders | Vinny Carpenter |
| Related | ADR 0002 (PocketBase cloud sync), `docs/superpowers/specs/2026-06-20-server-side-encryption-design.md` |

## Context

Release v9.12.0 (2026-06-20) shipped field-level encryption for synced tasks.
PocketBase hooks in `docker/pb_hooks/` encrypt `title`, `description`, `tags`,
`subtasks`, and `time_entries` before each write and decrypt them after each
read. Stored values carry an `enc:v1:` prefix. The key is a 32-character
`GSD_TASKS_ENC_KEY`.

The Docker image enforces this. `docker/docker-entrypoint.sh` exits at boot
without a valid key, and a system test proves ciphertext at rest.

The hosted service at `https://api.vinny.io` does not run that image. It runs a
PocketBase binary on an EC2 instance, with no hooks directory and no key, so
the hooks never load there. Task content on the hosted service is plaintext in
the database.

The implementation plan gated every public at-rest claim on a confirmed
production deploy. The About page honored that gate. `SECURITY.md` did not: it
described the hooks as if they protected every sync user. A codebase audit on
2026-09-19 flagged the mismatch as finding SEC-1.

## Decision

**The hosted service keeps running without the field encryption hooks, and
`SECURITY.md` says so.**

`SECURITY.md` now describes two deployments. The hosted service stores task
content as plaintext, protected by TLS in transit and owner-scoped API rules.
The self-hosted Docker image encrypts the five content fields at rest. The
hosted section also states that I, as the operator, have technical access to
synced task content.

A test in `tests/data/documentation-currentness.test.ts` pins that wording and
this ADR's path, so the claim cannot drift back without a red test.

## Consequences

**Easier.** The security document matches production. A reader deciding whether
to enable sync gets an accurate answer, and the self-host path shows what it
adds.

**Harder.** The hooks stay in the repo without a production deployment. Only
the Docker system test exercises them, so a PocketBase upgrade on the hosted
service tells me nothing about hook compatibility.

**Unchanged.** Sync behavior, the wire model, and both native clients. The
hooks are transparent at the API boundary, so deploying them later changes no
client.

## What would change this decision

Deploying the hooks to the hosted service reverses it. That deploy is a manual
change to a live server:

1. Dry-run the hooks and the backfill migration against a copy of `pb_data`.
2. Install the hooks and migrations, add the key to the service environment,
   and point PocketBase at both directories.
3. Back up the key off the host first. A lost key makes every encrypted field
   unrecoverable for every user.
4. Expect a one-time re-pull on every device, because the backfill touches
   each row.

After a confirmed deploy, update the hosted section of `SECURITY.md` and apply
the gated About-page copy from the plan. Then update the pinned test and
supersede this ADR.

## Alternatives considered

**Deploy the hooks now.** This makes the original `SECURITY.md` wording true.
Deferred, not rejected. The key would sit on the same host as the database.
The hooks would protect a leaked database file or backup, and they would not
protect a compromised host. That benefit is real but narrower than "encrypted at rest"
suggests, and the deploy carries the key-custody risk above.

**Leave `SECURITY.md` alone because the server is private and hardened.**
Rejected. Access control and encryption at rest are different claims. A
privacy-first product cannot publish the second while delivering only the
first.

**Remove the hooks from the repo.** Rejected. Self-hosters use them today
through the Docker image, and the hosted deploy remains an option.

**Disk-level volume encryption on the host.** A separate infrastructure
control that covers a lost disk or snapshot with no application change. It is
tracked outside this repo and does not change what `SECURITY.md` says about
field encryption.
