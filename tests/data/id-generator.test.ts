import { describe, it, expect } from "vitest";
import { generateId, ID_LENGTH } from "@/lib/id-generator";

describe("id-generator", () => {
  describe("generateId", () => {
    it("generates IDs with correct length", () => {
      const id = generateId();
      expect(id).toHaveLength(ID_LENGTH);
    });

    it("generates unique IDs", () => {
      const ids = new Set<string>();
      const count = 1000;

      for (let i = 0; i < count; i++) {
        ids.add(generateId());
      }

      expect(ids.size).toBe(count);
    });

    it("generates alphanumeric IDs", () => {
      const id = generateId();
      expect(id).toMatch(/^[a-zA-Z0-9_-]+$/);
    });

    it("generates different IDs on each call", () => {
      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });
});
