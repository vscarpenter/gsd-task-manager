// docker/pb_hooks/encryption-core.js
// Pure, dependency-injected encryption logic. NO PocketBase globals here so it
// can be unit-tested with Vitest. The PocketBase adapter injects the cipher.
"use strict";

const PREFIX = "enc:v1:";
const ENCRYPTED_TEXT_FIELDS = ["title", "description"];
const ENCRYPTED_JSON_FIELDS = ["tags", "subtasks", "time_entries"];

function isEncrypted(v) {
  return typeof v === "string" && v.indexOf(PREFIX) === 0;
}

function requireValidKey(key) {
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key (fail-closed)");
  }
}

function encryptRecord(record, cipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (v === null || v === undefined || v === "" || isEncrypted(v)) continue;
    record.set(f, PREFIX + cipherFn(String(v)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const raw = record.get(f);
    if (raw === null || raw === undefined) continue;
    const asString = typeof raw === "string" ? raw : JSON.stringify(raw);
    if (isEncrypted(asString)) continue;
    record.set(f, PREFIX + cipherFn(asString));
  }
}

function decryptRecord(record, decipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (!isEncrypted(v)) continue;
    record.set(f, decipherFn(v.slice(PREFIX.length)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const v = record.get(f);
    if (!isEncrypted(v)) continue;
    record.set(f, JSON.parse(decipherFn(v.slice(PREFIX.length))));
  }
}

module.exports = {
  PREFIX,
  ENCRYPTED_TEXT_FIELDS,
  ENCRYPTED_JSON_FIELDS,
  isEncrypted,
  requireValidKey,
  encryptRecord,
  decryptRecord,
};
