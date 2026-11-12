# Stage 8: Intermediate Zoom Out Report

**Target:** `docs/uml-diagrams.md` (lines 1-690). The file was not edited between Stage 5 and this stage.
**Standard:** `zoom-out-standard.md`
**Question asked:** if the author applied every Stage 6 and Stage 7 recommendation, would the result still pass the Zoom Out standard, and what is the smallest change that closes the Blockers?

## Reviewer Status

| Reviewer | Status | Notes |
| --- | --- | --- |
| `egm-zoom-out` | completed | Read in full: target, the three stage reports, `ARCHITECTURE.md`, `PRODUCT.md`, `SECURITY.md`, `docs/security-trust-boundaries.md`, ADR 0003, `tests/data/documentation-currentness.test.ts`. Read in part: `docs/architecture.html`, `docs/cloud-sync-explainer.html`, ADR 0015, `tasks/audit-2026-11-10.md`. Other ADRs by heading only. Opened no file under `lib/` or `packages/`; every code claim is carried from Stages 5 and 7. |

**Verdict:** applying every Stage 6 and Stage 7 recommendation would produce a document that fails the Zoom Out standard worse than the current one. The smallest fix for all eight Blockers is to retire the file and keep at most one redrawn container diagram.

**Counts:** 2 Blockers, 8 Majors, 2 Nits, plus one resolution finding (I-12).

## Evidence behind the findings

* **Alternatives already exist.** Every ADR has an Alternatives section.
* **Risks and trust boundaries already exist and are tested.** `docs/security-trust-boundaries.md` line 13 states the +5 min clamp, the cursor clamp, the 30-second overlap, and tombstone preservation. `SECURITY.md` lines 124-148 give the PKCE OAuth flow with all three providers; lines 93-111 give the hosted-plaintext versus self-hosted-encrypted split with a link to ADR 0016; lines 157-197 cover the MCP bearer token. Both files are linked from `ARCHITECTURE.md` and asserted by `tests/data/documentation-currentness.test.ts`.
* **Two other hand-drawn architecture descriptions exist and both have drifted.** `docs/architecture.html` says 19 MCP tools at lines 136 and 212 and 20 at line 194, and lists schema v14 with no `deletedTasks`. `docs/cloud-sync-explainer.html` shows an `authWithOAuth2` popup with a Google/GitHub allowlist and a `lastSyncAt` pull cursor. The project's own audit already flags both (`tasks/audit-2026-11-10.md`, DOC-1 and DOC-20).
* **The stated policy is links over copies.** `ARCHITECTURE.md` lines 6-7.
* **Nothing links to the target.**

The pattern: unlinked, untested parallel descriptions drift in this repo. The linked and tested ones do not.

## Findings

### I-1. The union of Stage 6 and Stage 7 turns a diagram file into a fourth parallel architecture document. Severity: Blocker
* **Concerns:** K-B1 to K-B5, K-M1, K-M2, K-M4 to K-M14, C-1 to C-16, against Z-B3, Z-M2, Z-M3, Z-M4
* **Discrepancy Description:** Neither stage removes a diagram. Together they add four spec sections, a trust overlay and OAuth sequence, regenerated field-level class diagrams with enum values and units, about ten more branches in the sync sequences, a coordinator redraw, nine captions, a metadata block, and a pinned test.
* **Rationale & Recommendation:** This fails the standard on detail level (field lists and per-branch engine logic), on reuse (four additions restate the ADRs, `SECURITY.md`, and `docs/security-trust-boundaries.md`), and on alignment with `ARCHITECTURE.md` lines 6-7. Do not apply the union. Stage 7's own caution says links are the cheaper answer; treat that as the ruling.

### I-2. Class diagrams: Stage 5 says delete, Stage 7 says regenerate, Stage 6 says add more. Severity: Blocker
* **Concerns:** Z-B3 against K-M4, K-M5, C-8, C-10, C-12, C-13
* **Discrepancy Description:** K-M4 and K-M5 offer "regenerate or cut". C-12 asks for enum values and units on every string field. C-13 asks to reconcile two copies of a method that Stage 5 says does not exist.
* **Rationale & Recommendation:** Regenerating by hand recreates the failure Z-B3 documents. No generator exists for this file, and `docs/diagrams/generate-detail-diagram.py` shows that even a generated diagram drifted. Delete sections 2, 3, and 4. That closes Z-B3, K-M4, K-M5, C-8, C-10, C-12, and C-13 together. The `ownerId` safety property is already covered by the owner-scoping row in `docs/security-trust-boundaries.md` line 13.

### I-3. Sync diagrams: Stage 5 says keep one and simplify, Stage 7 says redraw at engine detail. Severity: Major
* **Concerns:** Z-M2 against K-B4, K-M6, K-M13, C-3, C-4, C-5, C-6, C-15
* **Discrepancy Description:** K-B4 lists ten missing behaviors to draw. K-M6 says redraw the coordinator from two source files. Four Stage 6 findings each add a branch.
* **Rationale & Recommendation:** A sequence diagram carrying all of that is the engine's control flow in another notation and will be stale at the next pull-contract version (ADRs 0019 and 0020 show the contract is still changing). Do not redraw sections 5, 6, and 10. Either delete all three and link `lib/sync/` plus ADRs 0002, 0003, 0013, 0015, 0019, 0020, or keep one sequence of about ten messages with a three-line invariant list beneath it. Delete section 10 in both cases.

### I-4. MCP diagram: Stage 5 says no names or counts, Stage 7 says regenerate from schemas. Severity: Major
* **Concerns:** Z-M3 against K-B5, C-11
* **Rationale & Recommendation:** A tool inventory duplicates `packages/mcp-server/README.md`, which `ARCHITECTURE.md` already names as the source. The count has drifted in three places. A test that pins a number inside a diagram is machinery to protect a duplicate. Delete section 9. Carry its four facts as edge labels on the container diagram: stdio, talks to PocketBase and not IndexedDB, needs sync on, bearer token in the client config.

### I-5. Creation and recurrence sequences: Stage 5 says raise the level, Stage 7 says correct the internals. Severity: Major
* **Concerns:** Z-N3, Z-N5 against K-M8, C-2, C-14
* **Rationale & Recommendation:** The only architectural fact in sections 7 and 8 is the one they omit: a task write and its sync-queue row share a transaction. That is one edge on the container diagram. Delete sections 7 and 8.

### I-6. Section 1 is asked to carry more nodes and fewer nodes at once. Severity: Major
* **Concerns:** Z-B2, K-B3, K-N1 against C-7
* **Discrepancy Description:** C-7 asks to connect or remove seven orphan nodes. Z-B2 adds native clients, the service worker, and export/import. K-B3 adds a four-zone overlay. K-N1 adds background sync, the health monitor, and the retry manager.
* **Rationale & Recommendation:** One diagram cannot be both a module inventory and a container view. Redraw as a container view of eight to ten boxes: the browser app with IndexedDB; a dashed "opt-in, off by default" boundary around sync; PocketBase labelled "hosted or self-hosted"; three OAuth providers as one box; the MCP host process; native clients as one box. The dashed boundary is the trust overlay. Reject K-N1's internal modules.

### I-7. Spec sections that restate maintained sources. Severity: Major
* **Concerns:** K-B1, K-B2, K-M1, K-M2, K-M9, C-1

| Recommendation | Already exists in | Ruling |
| --- | --- | --- |
| K-B1 alternatives section | Alternatives section in every ADR | One link to `docs/adr/` |
| K-B2 risks table | `docs/security-trust-boundaries.md` line 13; ADR 0003 Consequences; `SECURITY.md` lines 482-503 | Two links. A second table is an untested copy of a tested one |
| K-M1 problem statement | `PRODUCT.md` lines 9-19 | Two sentences plus a link |
| K-M2 goals and non-goals | `PRODUCT.md` lines 17 and 42; ADR 0017 | Link |
| C-1 quadrant mapping, "GSD" expansion | `PRODUCT.md` line 15 | One sentence in the preamble |
| K-M9 scale limits, replication assumption | ADR 0016 | Reject. A replicated server is speculative. "Offline means full function minus sync" is one preamble sentence |

* **Rationale & Recommendation:** K-B1, K-B2, K-M1, and K-M2 exist only because a diagram catalogue was held to a feature-spec standard. A six-line preamble with links satisfies Z-B1 and removes all four.

### I-8. Trust overlay and OAuth sequence. Severity: Major
* **Concerns:** K-B3, C-11
* **Rationale & Recommendation:** The split, the token, and the PKCE flow are all in `SECURITY.md` and `docs/security-trust-boundaries.md`, with tests. The existing drawn auth flow in `docs/cloud-sync-explainer.html` already teaches the flow the code forbids. The real defect K-B3 found is narrower: section 1 draws sync as unconditional, which is the same defect as Z-B2. Keep only the dashed opt-in boundary, the "hosted or self-hosted" label, and "bearer token" on the MCP edge. Link the OAuth description; do not draw one.

### I-9. Document scaffolding. Severity: Major
* **Concerns:** K-M10, K-M11, K-M12, K-M14, K-N2 to K-N9, C-16, C-17
* **Rationale & Recommendation:** With one maintainer, owner and last-verified fields are a date nobody updates. A string-match test cannot verify a diagram. Regrouping and captions for eleven diagrams are moot once two or three remain. Reject the metadata block and the pinned test. Delete the Rendering section; do not fix it. The only scaffolding worth keeping is one row in the `ARCHITECTURE.md` table, if the file survives.

### I-10. System-change proposals are mixed into a documentation review. Severity: Major
* **Concerns:** Z-M5, Z-M6, Z-N1, Z-N2
* **Rationale & Recommendation:** Re-arming failed queue rows, a superseded-snapshot buffer, a `commitTaskMutation` seam, and a shared MCP module are product changes. None is needed to make this document true. Remove them from this document's fix list and file them as issues if wanted. Z-M5 is the only one with a concrete user-visible consequence.

### I-11. Lifecycle redraw is justified, but only at store level. Severity: Nit
* **Concerns:** Z-M1, K-M7, C-9
* **Rationale & Recommendation:** All three stages agree on Active / Saved / Completed / Archived / Trash with a note that the quadrant is derived. ADR 0015 lines 44-50 state the one-id-one-store rule in prose. Optional: a five-state diagram with no function names, or a link to ADRs 0013, 0015, 0018.

### I-12. Smallest change set that resolves all Blockers. Severity: Blocker (resolution)
* **Concerns:** Z-B1, Z-B2, Z-B3, K-B1 to K-B5, plus Z-M4 and K-M12

**Option A, retire entirely.** Delete `docs/uml-diagrams.md`. Nothing links to it, so nothing breaks. All eight Blockers close. What is lost: the only diagram-level statement that a local write and its sync-queue row share a transaction. ADR 0015 lines 48-49 state this for store moves; the reviewer did not confirm that a maintained source states it for ordinary writes.

**Option B, keep one diagram (reviewer's recommendation).** Four edits:
1. Delete sections 2 to 10 and Rendering. Closes Z-B3, K-B4, K-B5.
2. Replace section 1 with the container view from I-6, including the `task write -> syncQueue (same transaction) -> push` edge and the MCP edge labels from I-4. Closes Z-B2 and K-B3.
3. Add a preamble of about six lines: what the app is, the local-first rule, sync and MCP are opt-in, MCP needs sync on, then links to `PRODUCT.md`, `docs/adr/`, `SECURITY.md`, and `docs/security-trust-boundaries.md`. Closes Z-B1, K-B1, K-B2 by reference.
4. Give the diagram a home: move it into `ARCHITECTURE.md` under the table and delete this file, or keep the file and add one table row.

Optional fifth edit: the five-state lifecycle from I-11.

* **Rationale:** Option B is one diagram that changes only when a container or boundary changes. Option A is right if the maintainer will not commit even to that. Any option that keeps the class diagrams or the engine-level sequences reproduces the drift already visible in this file and both HTML documents.

### I-13. Retiring this file leaves two stale siblings. Severity: Nit
* **Concerns:** Z-M4
* **Rationale & Recommendation:** `docs/architecture.html` and `docs/cloud-sync-explainer.html` have the same defects and are tracked as DOC-1 and DOC-20. Decide all three together, so the surviving container diagram does not become a third copy.

## Disposition summary

| Disposition | Finding ids |
| --- | --- |
| Apply (reduced form) | Z-B1, Z-B2, K-B3 (labels only), K-M15, C-2, C-7; optionally Z-M1 / K-M7 |
| Closed by deletion | Z-B3, Z-M2, Z-M3, Z-N3 to Z-N5, K-B4, K-B5, K-M3 to K-M6, K-M8, K-M13, K-M14, K-N1 to K-N9, C-3 to C-6, C-8 to C-17 |
| Closed by link | K-B1, K-B2, K-M1, K-M2, C-1 |
| Reject as over-engineering | K-M9, K-M10, K-M11 beyond one caption, K-M12 metadata and pinned test, the OAuth sequence in K-B3 |
| Move out of this review | Z-M5, Z-M6, Z-N1, Z-N2 |
| One row or relocation | Z-M4, K-M12 (`ARCHITECTURE.md` link) |
