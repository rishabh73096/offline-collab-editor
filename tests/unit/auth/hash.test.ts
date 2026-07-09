import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";

describe("password hashing", () => {
  it("hashes a password into a bcrypt string distinct from the plaintext", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).not.toBe("correct horse battery staple");
    expect(hash).toMatch(/^\$2[aby]\$/);
  });

  it("verifies a correct password against its hash", async () => {
    const hash = await hashPassword("s3cret-password");
    await expect(verifyPassword("s3cret-password", hash)).resolves.toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("s3cret-password");
    await expect(verifyPassword("wrong-password", hash)).resolves.toBe(false);
  });

  it("salts hashes so the same password produces different hashes each time", async () => {
    const [a, b] = await Promise.all([hashPassword("same-password"), hashPassword("same-password")]);
    expect(a).not.toBe(b);
  });
});
