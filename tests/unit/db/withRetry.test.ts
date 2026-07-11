import { describe, it, expect, vi } from "vitest";
import { withDbReadRetry } from "@/lib/db/withRetry";

describe("withDbReadRetry", () => {
  it("returns the result on the first try when nothing fails", async () => {
    const operation = vi.fn().mockResolvedValue("ok");
    await expect(withDbReadRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("recovers when the first attempt fails but the retry succeeds", async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error("terminating connection due to administrator command"))
      .mockResolvedValueOnce("ok");

    await expect(withDbReadRetry(operation)).resolves.toBe("ok");
    expect(operation).toHaveBeenCalledTimes(2);
  });

  it("propagates the error when both attempts fail", async () => {
    const operation = vi.fn().mockRejectedValue(new Error("still down"));
    await expect(withDbReadRetry(operation)).rejects.toThrow("still down");
    expect(operation).toHaveBeenCalledTimes(2);
  });
});
