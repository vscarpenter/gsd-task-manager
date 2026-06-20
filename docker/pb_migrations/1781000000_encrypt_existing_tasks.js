/// <reference path="../pb_data/types.d.ts" />
// One-shot backfill: encrypt existing plaintext task rows in place.
// Idempotent — skips any value already prefixed "enc:v1:".
migrate((app) => {
  const PREFIX = "enc:v1:";
  const TEXT = ["title", "description"];
  const JSONF = ["tags", "subtasks", "time_entries"];
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key");
  }
  const isEnc = (v) => typeof v === "string" && v.indexOf(PREFIX) === 0;
  const records = app.findAllRecords("tasks");
  for (const r of records) {
    for (const f of TEXT) {
      const v = r.get(f);
      if (v === null || v === undefined || v === "" || isEnc(v)) continue;
      r.set(f, PREFIX + $security.encrypt(String(v), key));
    }
    for (const f of JSONF) {
      const raw = r.get(f);
      if (raw === null || raw === undefined) continue;
      const s = typeof raw === "string" ? raw : JSON.stringify(raw);
      if (isEnc(s)) continue;
      r.set(f, PREFIX + $security.encrypt(s, key));
    }
    app.save(r);
  }
}, (app) => {
  // Down migration intentionally a no-op: reversing requires the key and is not
  // part of rollback. Restore from backup if reversal is ever needed.
});
