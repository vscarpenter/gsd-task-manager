# Status — 2026-08-27

## Anonymous opt-in feedback — IN PROGRESS

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
- [ ] ③ Red — `tests/data/feedback-payload.test.ts` (the privacy test)
- [ ] ④ Green — `lib/feedback/roadmap-items.ts` + `feedback-payload.ts`
- [ ] ⑤ Red/green — `lib/feedback/feedback-store.ts` (localStorage draft + votes)
- [ ] ⑥ Red/green — `lib/feedback/submit-feedback.ts` (bare fetch, no auth header)
- [ ] ⑦ Settings → Feedback section + UI tests
- [ ] ⑧ Command palette "Send feedback" entry
- [ ] ⑨ About-page privacy copy acknowledges opt-in feedback
- [ ] ⑩ `scripts/setup-pocketbase-feedback-collection.sh`
- [ ] ⑪ E2E spec with the POST stubbed
- [ ] ⑫ Verify: `bun run test`, `typecheck`, `lint`, `quality:shape`
- [ ] ⑬ Verify in the running app (`/verify-frontend-change`)
- [ ] ⑭ Version bump trio (package.json + README:7 + sw.js CACHE_VERSION), PR

### Assumptions

- The `feedback` collection does not exist on `api.vinny.io` yet; the setup
  script creates it and Vinny runs it against prod himself.
- The roadmap candidate list in the spec is a seed for Vinny to curate, not a
  product commitment.

### Resuming From Here

Spec is written and approved. Next: task ③, the red privacy test.

### Watch out

- `public/sw.js` carries a stray build-generated `CACHE_VERSION` bump to
  `12.3.2` that predates this branch. Don't commit it on its own — fold it into
  the deliberate version bump at task ⑭.
- `localStorage.clear()` no-ops under jsdom-in-Bun; remove `gsd:feedback:*` keys
  individually in `beforeEach` (see `.claude/rules/testing.md`).
