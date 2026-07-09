import { describe, it, expect } from "vitest";
import { roleAtLeast, canEdit, canManageMembers } from "@/lib/authz/roles";

describe("roleAtLeast", () => {
  it.each([
    ["OWNER", "VIEWER", true],
    ["OWNER", "EDITOR", true],
    ["OWNER", "OWNER", true],
    ["EDITOR", "OWNER", false],
    ["EDITOR", "EDITOR", true],
    ["EDITOR", "VIEWER", true],
    ["VIEWER", "EDITOR", false],
    ["VIEWER", "VIEWER", true],
  ] as const)("roleAtLeast(%s, %s) === %s", (role, minimum, expected) => {
    expect(roleAtLeast(role, minimum)).toBe(expected);
  });
});

describe("canEdit", () => {
  it("is false for VIEWER", () => {
    expect(canEdit("VIEWER")).toBe(false);
  });

  it("is true for EDITOR and OWNER", () => {
    expect(canEdit("EDITOR")).toBe(true);
    expect(canEdit("OWNER")).toBe(true);
  });
});

describe("canManageMembers", () => {
  it("is true only for OWNER", () => {
    expect(canManageMembers("VIEWER")).toBe(false);
    expect(canManageMembers("EDITOR")).toBe(false);
    expect(canManageMembers("OWNER")).toBe(true);
  });
});
