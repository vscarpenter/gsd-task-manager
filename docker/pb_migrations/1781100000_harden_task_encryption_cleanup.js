/// <reference path="../pb_data/types.d.ts" />
// Forward-only remediation for installations that already applied
// 1781000000_encrypt_existing_tasks.js. Keep the shipped migration immutable;
// this migration safely handles both plaintext and already-encrypted rows.
migrate((app) => {
  const PREFIX = "enc:v1:";
  const TEXT = ["title", "description"];
  const JSONF = ["tags", "subtasks", "time_entries"];
  const key = $os.getenv("GSD_TASKS_ENC_KEY");
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key");
  }

  const table = new DynamicModel({ count: 0 });
  app.db()
    .newQuery("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'tasks'")
    .one(table);
  if (table.count === 0) return;

  app.db().newQuery("PRAGMA secure_delete = ON").execute();
  const isEnc = (value) => typeof value === "string" && value.indexOf(PREFIX) === 0;
  const decodeUtf8 = (bytes) => {
    let decoded = "";
    let index = 0;
    const continuationByte = () => {
      if (index >= bytes.length) throw new Error("Invalid truncated UTF-8 byte sequence");
      const byte = bytes[index++];
      if ((byte & 0xc0) !== 0x80) throw new Error("Invalid UTF-8 continuation byte");
      return byte;
    };

    while (index < bytes.length) {
      const first = bytes[index++];
      let codePoint;
      if (first <= 0x7f) {
        codePoint = first;
      } else if (first >= 0xc2 && first <= 0xdf) {
        codePoint = ((first & 0x1f) << 6) | (continuationByte() & 0x3f);
      } else if (first >= 0xe0 && first <= 0xef) {
        const second = continuationByte();
        const third = continuationByte();
        if ((first === 0xe0 && second < 0xa0) || (first === 0xed && second > 0x9f)) {
          throw new Error("Invalid UTF-8 three-byte sequence");
        }
        codePoint = ((first & 0x0f) << 12) | ((second & 0x3f) << 6) | (third & 0x3f);
      } else if (first >= 0xf0 && first <= 0xf4) {
        const second = continuationByte();
        const third = continuationByte();
        const fourth = continuationByte();
        if ((first === 0xf0 && second < 0x90) || (first === 0xf4 && second > 0x8f)) {
          throw new Error("Invalid UTF-8 four-byte sequence");
        }
        codePoint = ((first & 0x07) << 18)
          | ((second & 0x3f) << 12)
          | ((third & 0x3f) << 6)
          | (fourth & 0x3f);
      } else {
        throw new Error("Invalid UTF-8 leading byte");
      }

      if (codePoint <= 0xffff) {
        decoded += String.fromCharCode(codePoint);
      } else {
        const surrogate = codePoint - 0x10000;
        decoded += String.fromCharCode(0xd800 + (surrogate >> 10));
        decoded += String.fromCharCode(0xdc00 + (surrogate & 0x3ff));
      }
    }
    return decoded;
  };
  const repairedJson = (value) => {
    if (!isEnc(value)) return null;
    const plaintext = $security.decrypt(value.slice(PREFIX.length), key);
    let parsed;
    try {
      parsed = JSON.parse(plaintext);
    } catch {
      return null;
    }
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    if (!parsed.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)) return null;
    const decoded = decodeUtf8(parsed);
    try {
      JSON.parse(decoded);
    } catch {
      throw new Error("Invalid JSON decoded from legacy UTF-8 byte sequence");
    }
    return decoded;
  };
  const records = app.findAllRecords("tasks");
  for (const record of records) {
    const assignments = [];
    const params = { id: record.getString("id") };
    for (const field of TEXT) {
      const value = record.get(field);
      if (value === null || value === undefined || value === "" || isEnc(value)) continue;
      params[field] = PREFIX + $security.encrypt(String(value), key);
      assignments.push(field + " = {:" + field + "}");
    }
    for (const field of JSONF) {
      const raw = record.get(field);
      if (raw === null || raw === undefined) continue;
      let serialized = typeof raw === "string" ? raw : record.getString(field);
      if (typeof serialized === "string" && serialized !== "") {
        try {
          const parsed = JSON.parse(serialized);
          if (typeof parsed === "string") serialized = parsed;
        } catch {
          // Array/object JSON text is already the desired encryption input.
        }
      } else {
        serialized = JSON.stringify(raw);
      }
      if (isEnc(serialized)) {
        const repaired = repairedJson(serialized);
        if (repaired === null) continue;
        params[field] = PREFIX + $security.encrypt(repaired, key);
        assignments.push(field + " = {:" + field + "}");
        continue;
      }
      params[field] = PREFIX + $security.encrypt(serialized, key);
      assignments.push(field + " = {:" + field + "}");
    }
    if (assignments.length === 0) continue;
    // Bypass record hooks and autodate mutation so the remediation preserves
    // owner, identity, and every server/client timestamp.
    app.db()
      .newQuery("UPDATE tasks SET " + assignments.join(", ") + " WHERE id = {:id}")
      .bind(params)
      .execute();
  }

  if (records.length > 0) {
    // Schedule cleanup even when all values were already encrypted by the
    // shipped migration; SQLite may still retain its former plaintext pages.
    app.db()
      .newQuery("CREATE TABLE IF NOT EXISTS _gsd_security_state (id TEXT PRIMARY KEY NOT NULL)")
      .execute();
    app.db()
      .newQuery("INSERT OR REPLACE INTO _gsd_security_state (id) VALUES ('vacuum_after_task_encryption')")
      .execute();
  }
}, (_app) => {
  // Down migration intentionally does not decrypt data or undo secure cleanup.
});
