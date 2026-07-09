import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  it("accepts a valid payload and normalizes the email", () => {
    const result = registerSchema.safeParse({
      name: "Ada Lovelace",
      email: "ADA@Example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("rejects a password shorter than 8 characters", () => {
    const result = registerSchema.safeParse({ name: "Ada", email: "ada@example.com", password: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({ name: "Ada", email: "not-an-email", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = registerSchema.safeParse({ name: "   ", email: "ada@example.com", password: "password123" });
    expect(result.success).toBe(false);
  });

  it("rejects a password over the bcrypt-safe 72 character cap", () => {
    const result = registerSchema.safeParse({
      name: "Ada",
      email: "ada@example.com",
      password: "a".repeat(73),
    });
    expect(result.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty password (login must not leak complexity rules)", () => {
    const result = loginSchema.safeParse({ email: "ada@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects a missing password", () => {
    const result = loginSchema.safeParse({ email: "ada@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
