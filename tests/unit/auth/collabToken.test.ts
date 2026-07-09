import { describe, it, expect, beforeAll } from "vitest";
import { SignJWT } from "jose";
import { signCollabToken, verifyCollabToken } from "@/lib/auth/collabToken";

beforeAll(() => {
  process.env.COLLAB_JWT_SECRET = "test-secret-at-least-32-bytes-long-xxxxx";
});

describe("collab token", () => {
  it("round-trips a signed payload", async () => {
    const token = await signCollabToken({ userId: "u1", documentId: "d1", role: "EDITOR" });
    const payload = await verifyCollabToken(token);
    expect(payload).toEqual({ userId: "u1", documentId: "d1", role: "EDITOR" });
  });

  it("rejects a tampered token", async () => {
    const token = await signCollabToken({ userId: "u1", documentId: "d1", role: "VIEWER" });
    const flippedChar = token.at(-1) === "a" ? "b" : "a";
    const tampered = token.slice(0, -1) + flippedChar;
    await expect(verifyCollabToken(tampered)).rejects.toThrow();
  });

  it("rejects a token signed with a different secret", async () => {
    const badToken = await new SignJWT({ userId: "u1", documentId: "d1", role: "OWNER" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode("a-completely-different-secret-value"));
    await expect(verifyCollabToken(badToken)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const expiredToken = await new SignJWT({ userId: "u1", documentId: "d1", role: "OWNER" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(new TextEncoder().encode(process.env.COLLAB_JWT_SECRET as string));
    await expect(verifyCollabToken(expiredToken)).rejects.toThrow();
  });

  it("rejects a payload missing required fields", async () => {
    const incompleteToken = await new SignJWT({ userId: "u1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("60s")
      .sign(new TextEncoder().encode(process.env.COLLAB_JWT_SECRET as string));
    await expect(verifyCollabToken(incompleteToken)).rejects.toThrow();
  });
});
