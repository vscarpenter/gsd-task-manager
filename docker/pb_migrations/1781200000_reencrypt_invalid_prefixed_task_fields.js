/// <reference path="../pb_data/types.d.ts" />
// Forward-only remediation for rows whose user-supplied content starts with the
// encryption marker but is not authenticated ciphertext. Historical migrations
// remain immutable because deployed databases record their filenames.
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

  const isValidCiphertext = (value, requireJson) => {
    if (typeof value !== "string" || value.indexOf(PREFIX) !== 0) return false;
    try {
      const plaintext = $security.decrypt(value.slice(PREFIX.length), key);
      if (requireJson) JSON.parse(plaintext);
      return true;
    } catch {
      return false;
    }
  };
  // Read a JSON column as the logical string it holds. PocketBase hands JSON
  // columns to the JSVM byte-backed rather than as strings, and a value written
  // through record.set() arrives JSON-quoted while one written through raw SQL
  // does not. Both unwrap to the same text.
  const jsonFieldText = (record, field) => {
    const raw = record.get(field);
    let value = typeof raw === "string" ? raw : record.getString(field);
    if (typeof value !== "string" || value === "") value = JSON.stringify(raw);
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === "string") value = parsed;
    } catch {
      // Array/object JSON text is already the desired encryption input.
    }
    return value;
  };
  // Quote a bare string so the encrypted plaintext round-trips through
  // JSON.parse on read. Applied only when a value is actually being encrypted:
  // quoting before the already-encrypted check would move the "enc:v1:" marker
  // off the front and re-encrypt ciphertext that was already good.
  const serializableJson = (value) => {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  };

  const records = app.findAllRecords("tasks");
  for (const record of records) {
    const assignments = [];
    const params = { id: record.getString("id") };
    for (const field of TEXT) {
      const value = record.get(field);
      if (value === null || value === undefined || value === "" || isValidCiphertext(value, false)) continue;
      params[field] = PREFIX + $security.encrypt(String(value), key);
      assignments.push(field + " = {:" + field + "}");
    }
    for (const field of JSONF) {
      const raw = record.get(field);
      if (raw === null || raw === undefined) continue;
      const value = jsonFieldText(record, field);
      if (isValidCiphertext(value, true)) continue;
      params[field] = PREFIX + $security.encrypt(serializableJson(value), key);
      assignments.push(field + " = {:" + field + "}");
    }
    if (assignments.length === 0) continue;
    app.db()
      .newQuery("UPDATE tasks SET " + assignments.join(", ") + " WHERE id = {:id}")
      .bind(params)
      .execute();
  }
}, (_app) => {
  // Down migration intentionally does not decrypt data.
});
