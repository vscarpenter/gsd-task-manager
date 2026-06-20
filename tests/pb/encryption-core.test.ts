// tests/pb/encryption-core.test.ts
import { describe, it, expect } from "vitest";
import core from "../../docker/pb_hooks/encryption-core.js";

// Reversible fake cipher (NOT real crypto — just for roundtrip assertions)
const enc = (s: string) => Buffer.from(s, "utf8").toString("base64");
const dec = (s: string) => Buffer.from(s, "base64").toString("utf8");

// Minimal stand-in for PocketBase's e.record (get/set over a backing map)
function fakeRecord(initial: Record<string, unknown>) {
  const data = { ...initial };
  return {
    get: (f: string) => data[f],
    set: (f: string, v: unknown) => { data[f] = v; },
    _data: data,
  };
}

describe("encryption-core", () => {
  it("should_detect_the_enc_v1_prefix", () => {
    expect(core.isEncrypted("enc:v1:abc")).toBe(true);
    expect(core.isEncrypted("plain")).toBe(false);
    expect(core.isEncrypted(null)).toBe(false);
  });

  it("should_fail_closed_when_encryption_key_missing_or_wrong_length", () => {
    expect(() => core.requireValidKey(undefined)).toThrow();
    expect(() => core.requireValidKey("short")).toThrow();
    expect(() => core.requireValidKey("x".repeat(32))).not.toThrow();
  });

  it("should_encrypt_text_fields_and_roundtrip", () => {
    const r = fakeRecord({ title: "Buy milk", description: "2%" });
    core.encryptRecord(r, enc);
    expect(r._data.title).toMatch(/^enc:v1:/);
    expect(r._data.description).toMatch(/^enc:v1:/);
    core.decryptRecord(r, dec);
    expect(r._data.title).toBe("Buy milk");
    expect(r._data.description).toBe("2%");
  });

  it("should_roundtrip_json_fields_tags_and_subtasks", () => {
    const r = fakeRecord({
      title: "t",
      tags: ["work", "urgent"],
      subtasks: [{ id: "s1", title: "step", completed: false }],
    });
    core.encryptRecord(r, enc);
    expect(typeof r._data.tags).toBe("string");
    expect(r._data.tags).toMatch(/^enc:v1:/);
    core.decryptRecord(r, dec);
    expect(r._data.tags).toEqual(["work", "urgent"]);
    expect(r._data.subtasks).toEqual([{ id: "s1", title: "step", completed: false }]);
  });

  it("should_be_idempotent_on_double_encrypt", () => {
    const r = fakeRecord({ title: "x", description: "", tags: [] });
    core.encryptRecord(r, enc);
    const once = { ...r._data };
    core.encryptRecord(r, enc); // second pass must not double-wrap
    expect(r._data.title).toBe(once.title);
    expect(r._data.tags).toBe(once.tags);
  });

  it("should_pass_through_legacy_plaintext_rows_on_read", () => {
    const r = fakeRecord({ title: "legacy plaintext", tags: ["a"] });
    core.decryptRecord(r, dec); // no enc:v1: prefix anywhere
    expect(r._data.title).toBe("legacy plaintext");
    expect(r._data.tags).toEqual(["a"]);
  });

  it("should_leave_empty_text_fields_unencrypted", () => {
    const r = fakeRecord({ title: "x", description: "" });
    core.encryptRecord(r, enc);
    expect(r._data.description).toBe("");
  });
});
