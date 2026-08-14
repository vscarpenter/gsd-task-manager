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

function isValidCiphertext(value, decipherFn, json = false) {
  if (!isEncrypted(value) || typeof decipherFn !== "function") return false;
  try {
    const plaintext = decipherFn(value.slice(PREFIX.length));
    if (json) JSON.parse(plaintext);
    return true;
  } catch {
    return false;
  }
}

function serializableJson(value) {
  try {
    JSON.parse(value);
    return value;
  } catch {
    return JSON.stringify(value);
  }
}

function requireValidKey(key) {
  if (typeof key !== "string" || key.length !== 32) {
    throw new Error("GSD_TASKS_ENC_KEY must be a 32-character AES-256 key (fail-closed)");
  }
}

function jsonFieldString(record, field) {
  const raw = record.get(field);
  if (typeof raw === "string") return raw;

  // PocketBase exposes JSON columns to JSVM as raw byte arrays. getString()
  // returns their JSON representation without lossy array-of-byte stringifying.
  if (typeof record.getString === "function") {
    const coerced = record.getString(field);
    if (typeof coerced === "string" && coerced !== "") {
      try {
        const parsed = JSON.parse(coerced);
        if (typeof parsed === "string") return parsed;
      } catch {
        // Plain JSON text (for example an array) is already the desired input.
      }
      return coerced;
    }
  }

  return JSON.stringify(raw);
}

function encryptRecord(record, cipherFn, decipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (v === null || v === undefined || v === "" || isValidCiphertext(v, decipherFn)) continue;
    record.set(f, PREFIX + cipherFn(String(v)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const raw = record.get(f);
    if (raw === null || raw === undefined) continue;
    const asString = jsonFieldString(record, f);
    if (isValidCiphertext(asString, decipherFn, true)) continue;
    record.set(f, PREFIX + cipherFn(serializableJson(asString)));
  }
}

function decryptRecord(record, decipherFn) {
  for (const f of ENCRYPTED_TEXT_FIELDS) {
    const v = record.get(f);
    if (!isEncrypted(v)) continue;
    record.set(f, decipherFn(v.slice(PREFIX.length)));
  }
  for (const f of ENCRYPTED_JSON_FIELDS) {
    const raw = record.get(f);
    if (raw === null || raw === undefined) continue;
    const v = jsonFieldString(record, f);
    if (!isEncrypted(v)) continue;
    record.set(f, JSON.parse(decipherFn(v.slice(PREFIX.length))));
  }
}

module.exports = {
  PREFIX,
  ENCRYPTED_TEXT_FIELDS,
  ENCRYPTED_JSON_FIELDS,
  isEncrypted,
  isValidCiphertext,
  requireValidKey,
  jsonFieldString,
  encryptRecord,
  decryptRecord,
};
