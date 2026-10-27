import { describe, it, expect } from "vitest";
import { hasVisibleText } from "@/lib/utils";

describe("hasVisibleText", () => {
  it.each([
    ["", false],
    ["   \n\t", false],
    ["​‌‍﻿⁠", false],
    [" ​x​ ", true],
    ["!", true],
  ])("%j -> %s", (value, expected) => {
    expect(hasVisibleText(value)).toBe(expected);
  });
});
