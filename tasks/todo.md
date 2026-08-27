# Status — 2026-08-27

## Anonymous opt-in feedback — DONE (committed, not pushed)

Branch `feat/anonymous-feedback`. Tier: **Non-trivial** (new outbound data path,
new PocketBase collection with an unauthenticated write rule, privacy-copy change,
new Settings surface). Spec: `tasks/spec-anonymous-feedback.md`, approved by the
user, so spec → plan → implementation runs in one pass per the standing correction
in the global CLAUDE.md.

**Why:** Vinny has no signal from users today — no analytics by design — so he
can't tell what people think or what to build next. The design answer is to make
the privacy stance the feature's UX: capture locally, show the exact payload,
send only on an explicit tap, attach no identifier at all.

**Decided scope (user-approved):**

- Transport: the existing self-hosted PocketBase at `api.vinny.io`, anonymous.
- Signals: roadmap poll + sentiment + category + free text, unified in one form.
- Identity: **none**. Not even a rotatable device id — vote integrity is
  client-side only, and that's the right fidelity here.
- Roadmap candidates: hardcoded constant, no server read path.
- Deferred: the "earned moment" prompt, and the public privacy-policy page.

### Tasks

- [x] ① Preflight + branch (`feat/anonymous-feedback`)
- [x] ② Write spec (`tasks/spec-anonymous-feedback.md`)
- [x] ③ Red — `tests/data/feedback-payload.test.ts` (the privacy test)
- [x] ④ Green — `lib/feedback/roadmap-items.ts` + `feedback-payload.ts`
- [x] ⑤ Red/green — `lib/feedback/feedback-store.ts` (localStorage draft + votes)
- [x] ⑥ Red/green — `lib/feedback/submit-feedback.ts` (bare fetch, no auth header)
- [x] ⑦ Settings → Feedback section + UI tests
- [x] ⑧ Command palette "Send feedback" entry
- [x] ⑨ About-page privacy copy acknowledges opt-in feedback
- [x] ⑩ `scripts/setup-pocketbase-feedback-collection.sh`
- [x] ⑪ E2E spec with the POST stubbed
- [x] ⑫ Verify: `bun run test`, `typecheck`, `lint`, `quality:shape`
- [x] ⑬ Verify in the running app (`/verify-frontend-change`)
- [x] ⑭ Version bump trio (package.json + README:7 + sw.js CACHE_VERSION), PR

### Assumptions

- The `feedback` collection does not exist on `api.vinny.io` yet; the setup
  script creates it and Vinny runs it against prod himself.
- The roadmap candidate list in the spec is a seed for Vinny to curate, not a
  product commitment.

### Resuming From Here

Feature is complete and committed on `feat/anonymous-feedback` (6 commits).
`bun run test` (2830), `typecheck`, `lint`, and `quality:shape` are all green,
and the surface was verified in the running app (both themes, a11y tree,
success and failure paths).

**Not yet done — needs Vinny:**
1. Push and open the PR. Not done without an explicit go-ahead.
2. Run `scripts/setup-pocketbase-feedback-collection.sh` against prod, then do
   the two manual steps it prints: rate limiting and log retention. Until the
   collection exists, Send will fail with "That wasn't accepted."
3. Curate `lib/feedback/roadmap-items.ts`. The eight candidates are a seed.
4. Update the privacy policy at gsdtaskmanager.com/privacy (separate repo).

**Deferred by design:** the earned-moment prompt after N completed tasks.

### Watch out

- `localStorage.clear()` no-ops under jsdom-in-Bun; remove `gsd:feedback:*` keys
  individually in `beforeEach` (see `.claude/rules/testing.md`).
