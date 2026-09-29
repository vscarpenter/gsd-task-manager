#!/usr/bin/env node
// Eval runner for the Stagehand verify judge: does `goalMet` match the
// labeled truth for a seeded page state? Adapted from the claude-api
// build-eval runner scaffold (the harness section below is kept as shipped).
//
// Each case spawns the real entry point, `bun tools/stagehand/verify.ts`,
// against the static export served on :3100, so the eval exercises the same
// seed, act, and extract path a person runs by hand.
//
//   node scripts/lib/static-export-server.cjs &   # serves out/ on :3100
//   bun --env-file=.env.local tools/stagehand/eval/run-eval.mjs \
//     --flow .claude/hillclimb/stagehand-judge --variant baseline \
//     --model claude-haiku-4-5 --reps 3
//
// Known limit: Stagehand does not surface the served model or stop_reason, so
// the served-model assertion below compares against the configured model only.

import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { spawn } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { summarize } from './summarize.mjs';

const EVAL_DIR = fileURLToPath(new URL('.', import.meta.url));
const APP_URL = process.env.JUDGE_EVAL_URL ?? 'http://127.0.0.1:3100';
const DEFAULT_MODEL = 'claude-haiku-4-5';
const MS_PER_S = 1000;
// Mirrors the extract instruction in tools/stagehand/verify.ts, recorded in
// each trace so a reviewer sees what the judge was asked.
const EXTRACT_PROMPT = (goal) =>
  `Goal under verification: "${goal}". Describe exactly what the page shows that is ` +
  'relevant to this goal (observed), state whether the goal is met (goalMet), and name ' +
  'the specific visible evidence (evidence). Judge only what is visible.';

// JUDGE_EVAL_ONLY=id1,id2 runs a subset (pilots, trimmed iteration runs).
async function loadCases() {
  const only = process.env.JUDGE_EVAL_ONLY?.split(',').map((s) => s.trim()).filter(Boolean);
  const cases = JSON.parse(readFileSync(join(EVAL_DIR, 'cases.json'), 'utf8'))
    .map((c) => ({ ...c, prompt: c.goal }));
  if (!only?.length) return cases;
  const unknown = only.filter((id) => !cases.some((c) => c.id === id));
  if (unknown.length) throw new Error(`JUDGE_EVAL_ONLY names unknown case ids: ${unknown.join(', ')}`);
  return cases.filter((c) => only.includes(c.id));
}

function verifyArgs(input) {
  const args = ['tools/stagehand/verify.ts', '--goal', input.goal,
    '--seed', input.seed, '--path', input.path, '--url', APP_URL];
  for (const act of input.acts) args.push('--act', act);
  return args;
}

function failure(message, failureClass) {
  const e = new Error(message);
  e.failure_class = failureClass;
  return e;
}

// Exit 1 is a normal "goal not met" report, so only exit 2 (or a kill from
// the timeout) counts as a failed attempt.
function runVerify(input, model, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('bun', verifyArgs(input), {
      env: { ...process.env, STAGEHAND_MODEL: `anthropic/${model}` },
      timeout: timeoutMs || undefined,
    });
    let stdout = '', stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0 || code === 1) return resolvePromise(stdout);
      const cls = signal ? 'timeout'
        : /observe\(\) found no action/.test(stderr) ? 'act_failure' : 'harness_error';
      reject(failure(`verify exited ${code ?? signal}: ${stderr.trim().slice(-600)}`, cls));
    });
  });
}

function parseReport(stdout) {
  const at = stdout.lastIndexOf('{\n  "goal":');
  if (at < 0) throw failure(`no verify report in stdout: ${stdout.slice(-300)}`, 'harness_error');
  return JSON.parse(stdout.slice(at));
}

// Screenshots live in the gitignored evidence dir; copy them next to the
// variant so trace attachments stay valid after evidence is cleaned up.
function keepScreenshots(screenshots, input, ctx) {
  const outDir = join(ctx.flow, ctx.variant, 'out');
  mkdirSync(outDir, { recursive: true });
  return screenshots.map((src) => {
    const name = `${pathSafeId(input.id)}_${ctx.rep}_${src.split('/').pop()}`;
    copyFileSync(src, join(outDir, name));
    return { kind: 'image', ref: `${ctx.variant}/out/${name}`, alt: name };
  });
}

async function runCase(input, ctx) {
  const model = ctx.model ?? DEFAULT_MODEL;
  const report = parseReport(await runVerify(input, model, ctx.timeoutS * MS_PER_S));
  const { llm, verdict, pageEvidence } = report;
  if (!llm || !(llm.totalPromptTokens > 0)) {
    throw failure('verify report has no token usage; is the llm field wired?', 'harness_error');
  }
  const setup = [`seed: ${input.seed}`, `path: ${input.path}`,
    ...input.acts.map((a) => `act: ${a}`)].join('\n');
  return {
    output: verdict,
    model: llm.model.replace(/^anthropic\//, ''),
    usage: { input_tokens: llm.totalPromptTokens, output_tokens: llm.totalCompletionTokens },
    stop_reason: null,
    extract_s: llm.extractInferenceTimeMs / MS_PER_S,
    extract_input_tokens: llm.extractPromptTokens,
    page_errors: pageEvidence.consoleErrors.length + pageEvidence.pageErrors.length,
    transcript: [
      { role: 'system', content: EXTRACT_PROMPT(input.goal) },
      { role: 'user', content: `${setup}\n\ngoal: ${input.goal}` },
      { role: 'assistant', content: JSON.stringify(verdict, null, 2),
        attachments: keepScreenshots(report.screenshots, input, ctx) },
    ],
  };
}

async function gradeCase(input, run) {
  const said = run.output?.goalMet;
  if (typeof said !== 'boolean') {
    throw failure(`goalMet is not a boolean: ${JSON.stringify(said)}`, 'harness_error');
  }
  return {
    grade: { correct: said === input.expected ? 1 : 0 },
    explanation: { correct: `expected ${input.expected}, judge said ${said}. Label: ${input.why}` },
  };
}

function perfFrom(run) {
  return { extract_s: run.extract_s, extract_input_tokens: run.extract_input_tokens,
    page_errors: run.page_errors, said_met: run.output.goalMet };
}

// --- harness (you usually won't need to touch below this line) --------------

function parseArgs(argv) {
  const a = { flow: '.claude/hillclimb/flow', variant: 'baseline',
              model: undefined, reps: 1, concurrency: 3, timeoutS: 240,
              approveHarness: false };
  // A flag at the end of argv would otherwise consume undefined - which for
  // --model equals the default and silently disables the served-model check.
  const val = (i) => { if (argv[i] === undefined) { console.error(`missing value for ${argv[i - 1]}`); usage(); process.exit(2); } return argv[i]; };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--flow') a.flow = val(++i);
    else if (k === '--variant') a.variant = val(++i);
    else if (k === '--model') a.model = val(++i);
    else if (k === '--reps') a.reps = +val(++i);
    else if (k === '--concurrency') a.concurrency = +val(++i);
    else if (k === '--timeout-s') a.timeoutS = +val(++i);
    else if (k === '--approve-harness') a.approveHarness = true;
    else if (k === '-h' || k === '--help') { usage(); process.exit(0); }
    else { console.error(`unknown argument: ${k}`); usage(); process.exit(2); }
  }
  if (!/^(baseline|v[1-9]\d*)$/.test(a.variant)) {
    // The report only reads directories named 'baseline' or 'v<N>' - any other
    // name runs to completion but spends the pass into a directory the Summary,
    // trajectory, and budget arithmetic never see.
    console.error(`--variant must be 'baseline' or 'v<N>', got '${a.variant}'`);
    usage(); process.exit(2);
  }
  if (!Number.isFinite(a.timeoutS) || a.timeoutS < 0
      || a.timeoutS * 1000 > 2147483647 // setTimeout clamps >2^31-1 ms to 1 ms - the ceiling would fire instantly
      || !Number.isInteger(a.reps) || a.reps < 1
      || !Number.isInteger(a.concurrency) || a.concurrency < 1) { usage(); process.exit(2); }
  return a;
}
function usage() {
  console.error('usage: node run-eval.mjs --flow DIR --variant ID [--model ID] [--reps N] [--concurrency N] [--timeout-s N (0 = no ceiling)] [--approve-harness]');
}

// Harness integrity gate. The hillclimb loop gets this runner command
// allowlisted for the session and then runs rounds unattended, while the
// per-round change (proposed by an analyzer fed untrusted transcripts) may
// legitimately edit harness code. Without this gate a round that rewrites the
// runner would execute attacker-chosen code on the next unattended run under
// the user's one-time approval. So: sha256 over this file plus every path in
// `_state.json.harness_paths` (relative to the directory the runner is invoked
// from, i.e. the repo root); compare to `_state.json.harness_sha`; refuse on
// absent/mismatch unless a human passes --approve-harness, which records the
// new sha. That write is the one sanctioned exception to "never write
// _state.json".
function checkHarness(statePath, st, approve) {
  const self = fileURLToPath(import.meta.url);
  const listed = Array.isArray(st.harness_paths) ? st.harness_paths.map(String) : [];
  const paths = [...new Set([self, ...listed.map(p => resolve(p))])].sort();
  const h = createHash('sha256');
  const hashed = [];
  for (const p of paths) {
    let buf;
    try { buf = readFileSync(p); }
    catch (e) {
      if (p === self) throw e;
      console.error(`warning: harness path '${relative(process.cwd(), p)}' not readable (${e?.code || 'error'}) - skipped`);
      continue;
    }
    h.update(relative(process.cwd(), p)).update('\0').update(buf).update('\0');
    hashed.push(relative(process.cwd(), p));
  }
  const sha = h.digest('hex');
  if (st.harness_sha === sha) return;
  if (approve) {
    st.harness_sha = sha;
    writeFileSync(statePath, JSON.stringify(st, null, 2) + '\n');
    console.error(`harness approved: sha256 ${sha.slice(0, 12)} over ${hashed.length} file(s) recorded in ${statePath}`);
    return;
  }
  if (st.harness_sha == null) {
    console.error(`no approved harness sha in ${statePath} (computed ${sha.slice(0, 12)} over: ${hashed.join(', ')}).`);
    console.error('Review the harness, then run once with --approve-harness to record it.');
  } else {
    console.error(`harness changed since last approved run (files: ${hashed.join(', ')}); `
      + `approved ${String(st.harness_sha).slice(0, 12)}, now ${sha.slice(0, 12)}.`);
    console.error('Re-run with --approve-harness after reviewing the diff.');
  }
  process.exit(2);
}

// Transient provider errors (429 / overloaded / 5xx) retry with jittered
// exponential backoff - a zero-delay retry loop multiplies cost invisibly
// under rate limits and can turn one transient 429 into a torn-down batch.
// The attempt count lands in the row's meta (or the errors sidecar) so retry
// churn is visible in the data, not just the bill.
async function withBackoff(fn, retry, deadline = Infinity, tries = 5) {
  for (let attempt = 0; ; attempt++) {
    // Checked before every attempt, not just before sleeps: once the case's
    // ceiling has passed, an abandoned chain must not issue another call
    // (e.g. a judge call after the app call consumed the whole ceiling).
    if (Date.now() >= deadline) {
      const e = new Error('wall-clock ceiling exceeded before attempt');
      e.failure_class = 'timeout';
      throw e;
    }
    try { return await fn(); } catch (e) {
      const status = e?.status ?? e?.response?.status;
      const transient = status === 429 || status === 529 || (status >= 500 && status < 600)
        || /overloaded|rate.?limit/i.test(String(e?.message ?? ''));
      if (!transient || attempt >= tries - 1) throw e;
      const delay = Math.min(60_000, 1000 * 2 ** attempt) * (0.5 + Math.random());
      // Never start a retry that would outlive the case's wall-clock ceiling - 
      // otherwise an abandoned chain keeps issuing API calls after the case failed.
      if (Date.now() + delay >= deadline) throw e;
      retry.count++;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// Hard per-case wall-clock ceiling, independent of stream liveness - a hung
// SSE stream can emit keepalives forever, defeating inactivity-based timers.
// The underlying call may keep running; the case fails and the slot is freed.
function withTimeout(promise, seconds, label) {
  if (!(seconds > 0)) return promise;
  let timer;
  const ceiling = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const e = new Error(`${label}: exceeded ${seconds}s wall-clock ceiling`);
      e.failure_class = 'timeout';
      reject(e);
    }, seconds * 1000);
  });
  return Promise.race([promise, ceiling]).finally(() => clearTimeout(timer));
}

// Case ids appear in file paths AND as the row/file join key the report uses,
// so rows, trace filenames, and frozen refs all carry the same path-safe id.
// When sanitization changes the id, a short content hash keeps distinct ids
// distinct ('case/1' vs 'case_1'); the original rides in meta.original_id.
function pathSafeId(id) {
  const raw = String(id);
  const cleaned = raw.replace(/[^\w.-]/g, '_');
  // Idempotent by construction: anything already path-safe and within the
  // length bound - including this function's own truncated+suffixed output - 
  // passes through unchanged. Long ids (URLs, prompt text as id) truncate to
  // 120 chars plus an 8-hex hash of the full original, so they fail here, not
  // at the trace write after the spend, and distinct ids stay distinct.
  if (cleaned === raw && raw.length <= 129) return raw;
  return `${cleaned.slice(0, 120)}-${createHash('sha256').update(raw).digest('hex').slice(0, 8)}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const vdir = join(args.flow, args.variant);
  mkdirSync(join(vdir, 'traces'), { recursive: true });
  // _state.json is READ-ONLY here. The orchestrator owns it. Absent is fine
  // (a baseline-only run has no loop state yet), but present-and-unparsable
  // must not let the id-space gate below pass vacuously over a corrupt file.
  const statePath = join(args.flow, '_state.json');
  let st = {};
  if (existsSync(statePath)) {
    try { st = JSON.parse(readFileSync(statePath, 'utf8')) || {}; }
    catch (e) { console.error(`${statePath} exists but is not valid JSON (${e?.message || e}) - fix it before spending a pass`); process.exit(2); }
  }
  checkHarness(statePath, st, args.approveHarness);
  const ctx = { ...args, state: st };

  // Resume: which (id, rep) pairs already have a row?
  const resultsPath = join(vdir, 'results.jsonl');
  const done = new Set();
  if (existsSync(resultsPath))
    for (const ln of readFileSync(resultsPath, 'utf8').split('\n')) {
      if (!ln.trim()) continue;
      try { const r = JSON.parse(ln); done.add(`${r.prompt_id}\0${r.rep}`); } catch {}
    }
  // Rows key on the path-safe id (see pathSafeId), so resume must too.

  const cases = await loadCases();
  // Validate the id space before spending anything: duplicate path-safe ids - 
  // including case-insensitive twins, which macOS/Windows filesystems collapse - 
  // would silently overwrite traces and frozen refs; and a _state.json split id
  // that matches no case would silently shrink the scored denominator.
  const seen = new Map();
  for (const c of cases) {
    const k = pathSafeId(c.id).toLowerCase();
    if (seen.has(k)) {
      console.error(`duplicate case id after sanitization: '${c.id}' collides with '${seen.get(k)}'`);
      process.exit(2);
    }
    seen.set(k, c.id);
  }
  const safeIds = new Set(cases.map(c => pathSafeId(c.id)));
  for (const sid of [...(st.train_ids ?? []), ...(st.val_ids ?? []), ...(st.test_ids ?? [])]) {
    const s = String(sid); // the adapter joins with String() on both sides - numeric ids are fine
    if (safeIds.has(s)) continue; // matches a loaded case - definitionally valid
    if (s !== pathSafeId(s)) {
      // Can never match a row: rows key on path-safe ids. This is the silent
      // shrunken-denominator bug - fail before anything is spent.
      console.error(`_state.json split id '${s}' is not a path-safe id - record split ids exactly as they appear in results.jsonl's prompt_id`);
      process.exit(2);
    }
    // Well-formed but absent is legitimate (a trimmed top-K subset run) - note it, don't fail.
    console.error(`note: split id '${s}' matches no loaded case (expected for a trimmed subset run)`);
  }
  const refDir = join(args.flow, 'baseline', 'ref');
  const tasks = [];
  for (const c of cases) for (let rep = 0; rep < args.reps; rep++) {
    if (done.has(`${pathSafeId(c.id)}\0${rep}`)) continue;
    tasks.push({ c, rep });
  }
  console.error(`[${args.variant}] ${tasks.length} of ${cases.length * args.reps} (id,rep) to run`);

  let i = 0, ok = 0, fail = 0;
  const errorsPath = join(vdir, 'errors.jsonl');
  // A hard crash (power loss, ENOSPC) can leave a torn final line with no
  // trailing newline; the next append would merge two rows into one permanently
  // unparseable line. Isolate any fragment before appending anything.
  for (const p of [resultsPath, errorsPath]) {
    if (!existsSync(p)) continue;
    const buf = readFileSync(p);
    if (buf.length && buf[buf.length - 1] !== 0x0a) appendFileSync(p, '\n');
  }
  async function worker() {
    while (i < tasks.length) {
      const { c, rep } = tasks[i++];
      const safeId = pathSafeId(c.id);
      const t0 = Date.now();
      let lastRun = null;    // survives into the catch - billed spend on a failed attempt
      let rowWritten = false; // set once the results row lands - the attempt is scored
      const deadline = args.timeoutS > 0 ? t0 + args.timeoutS * 1000 : Infinity;
      const appRetry = { count: 0 }, judgeRetry = { count: 0 };
      try {
        // One ceiling over the whole case - app call, identity check, and grading - 
        // so a hung judge stream can't hold the slot either.
        const { run, g, latency_s } = await withTimeout((async () => {
          let tAttempt = t0;
          const run = await withBackoff(() => { tAttempt = Date.now(); return runCase(c, { ...ctx, rep }); },
            appRetry, deadline);
          lastRun = run;
          // latency_s = the final app attempt only; backoff sleeps, failed
          // attempts, and judge time are excluded (retry counts are in meta).
          const latency_s = (Date.now() - tAttempt) / 1000;
          // Serving identity: fail loudly when the response was served by a model
          // other than the one requested. Accept exact match or a documented
          // alias->snapshot resolution - 'foo-latest'/'foo-0'/'foo' served as
          // 'foo-20250101', 'foo@20250101', or 'foo-2025-01-01'. Anything else - 
          // another snapshot of the requested pin, a sibling model, or the bare
          // base id ('foo-latest' served as 'foo', an unversioned echo that can
          // hide snapshot drift across rounds) - fails the attempt. Non-Anthropic
          // id schemes (e.g. Bedrock's 'anthropic.claude-...-v1:0') need their own
          // rule here.
          if (ctx.model && run.model && run.model !== ctx.model) {
            const base = ctx.model.replace(/-latest$|-0$/, '');
            const rest = String(run.model).startsWith(base)
              ? String(run.model).slice(base.length) : null;
            if (!(rest != null && /^[-@](\d{8}|\d{4}-\d{2}-\d{2})$/.test(rest))) {
              const e = new Error(`served model ${run.model} != requested ${ctx.model}`);
              e.failure_class = 'serving_substitution';
              throw e;
            }
          }
          // Frozen pairwise reference (never regenerated): baseline/ref/<id>.*
          let ref = null;
          if (args.variant !== 'baseline') {
            const p = join(refDir, safeId);
            for (const ext of ['', '.html', '.txt', '.json'])
              if (existsSync(p + ext)) { ref = readFileSync(p + ext, 'utf8'); break; }
          }
          const g = await withBackoff(() => gradeCase(c, run, ref, ctx), judgeRetry, deadline);
          return { run, g, latency_s };
        })(), args.timeoutS, `${c.id} rep${rep}`);
        const row = {
          prompt_id: safeId, rep, prompt: c.prompt ?? c.input ?? c.id,
          tags: c.tags, attachments: c.attachments,
          meta: safeId !== String(c.id) || appRetry.count || judgeRetry.count
            ? { ...(c.meta ?? {}),
                ...(safeId !== String(c.id) ? { original_id: String(c.id) } : {}),
                ...(appRetry.count ? { retries: appRetry.count } : {}),
                ...(judgeRetry.count ? { judge_retries: judgeRetry.count } : {}) }
            : c.meta,
          model: run.model, usage: run.usage, stop_reason: run.stop_reason,
          judge_model: g.judge_model ?? run.judge_model,
          judge_usage: g.judge_usage ?? run.judge_usage,
          latency_s, ...perfFrom(run),
          grade: g.grade, explanation: g.explanation,
        };
        appendFileSync(resultsPath, JSON.stringify(row) + '\n');
        rowWritten = true; // past this point the attempt is scored - a later throw (trace write, ref freeze) must not also append an error row
        if (run.transcript)
          writeFileSync(join(vdir, 'traces', `${safeId}_rep${rep}.json`),
            JSON.stringify(run.transcript, null, 2));
        // For pairwise: on the baseline run, freeze the reference output once.
        if (args.variant === 'baseline' && run.output != null && !existsSync(join(refDir, safeId))) {
          mkdirSync(refDir, { recursive: true });
          writeFileSync(join(refDir, safeId),
            typeof run.output === 'string' ? run.output : JSON.stringify(run.output));
        }
        ok++;
      } catch (e) {
        fail++;
        if (rowWritten) {
          // The attempt scored; only a post-row write (trace, ref) failed. An error
          // row here would double-count the billed usage under the budget rule.
          console.error(`  [${args.variant}] ${c.id} rep${rep} scored, but a post-row write failed: ${e?.message || e}`);
          continue;
        }
        // Failed attempts are data too - but they must not occupy the (case, rep)
        // slot in results.jsonl, or resume would never re-run them.
        appendFileSync(errorsPath, JSON.stringify({
          prompt_id: safeId, rep,
          ...(safeId !== String(c.id) ? { original_id: String(c.id) } : {}),
          failure_class: e?.failure_class ?? 'error',
          error: String(e?.message || e),
          retries: appRetry.count, judge_retries: judgeRetry.count,
          // Billed-but-failed spend stays countable: when the app call completed
          // before the failure (e.g. a served-model mismatch, a judge-stage
          // ceiling), carry its identity and usage on the error row.
          model: lastRun?.model, usage: lastRun?.usage,
          judge_model: e?.judge_model ?? lastRun?.judge_model,
          judge_usage: e?.judge_usage ?? lastRun?.judge_usage,
          latency_s: (Date.now() - t0) / 1000,
        }) + '\n');
        console.error(`  [${args.variant}] ${c.id} rep${rep} FAILED: ${e?.message || e}`);
      }
    }
  }
  // One progress line every 30s (and to <vdir>/progress.txt) so "how far along
  // is it?" is answerable from the background shell's output or one file read,
  // without the orchestrator parsing results.jsonl mid-write. ETA is a plain
  // rate extrapolation from this pass.
  const t0 = Date.now();
  const progress = () => {
    const done = ok + fail, total = tasks.length;
    const el = (Date.now() - t0) / 1000;
    const eta = done ? Math.round((el / done) * (total - done)) : null;
    const line = `[${args.variant}] ${done}/${total} done (${ok} ok, ${fail} failed), `
      + `${Math.round(el)}s elapsed` + (eta != null ? `, ~${eta}s left` : '');
    console.error(line);
    try { writeFileSync(join(vdir, 'progress.txt'), line + '\n'); } catch {}
  };
  const tick = setInterval(progress, 30_000);
  await Promise.all(Array.from({ length: Math.max(1, args.concurrency) }, worker));
  clearInterval(tick); progress();
  console.error(`[${args.variant}] done - ${ok} ok, ${fail} failed -> ${resultsPath}`);
  console.log(summarize(vdir, cases));
  process.exit(fail ? 1 : 0);
}

main();
