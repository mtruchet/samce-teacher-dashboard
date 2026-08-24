import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchPing } from "./pingService";

describe("fetchPing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the parsed response when the backend responds ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ status: "ok", database: "ok" }),
      }),
    );

    const result = await fetchPing();

    expect(result).toEqual({ status: "ok", database: "ok" });
  });

  it("throws when the backend responds with a non-ok status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    await expect(fetchPing()).rejects.toThrow("ping request failed with status 500");
  });
});
