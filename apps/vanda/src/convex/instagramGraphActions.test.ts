import { afterEach, describe, expect, it, vi } from "vitest";
import * as Effect from "effect/Effect";
import { exchangeLongLivedToken } from "./instagramGraphActions";

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("exchangeLongLivedToken", () => {
  it("uses the long-lived token when Meta upgrades it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ access_token: "long-token", expires_in: 5_184_000 }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await Effect.runPromise(
      exchangeLongLivedToken("short-token", "client-id", "client-secret"),
    );

    expect(result).toEqual({ accessToken: "long-token", expiresIn: 5_184_000 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries and falls back to the short token with structured diagnostics", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse(
          {
            error: {
              message: "Unsupported request - method type: get",
              type: "IGApiException",
              code: 100,
              error_subcode: 33,
              fbtrace_id: "trace-123",
            },
          },
          400,
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await Effect.runPromise(
      exchangeLongLivedToken("short-token", "client-id", "client-secret"),
    );

    expect(result.accessToken).toBe("short-token");
    expect(result.warning).toContain('"operation":"exchange_long_lived_token"');
    expect(result.warning).toContain('"status":400');
    expect(result.warning).toContain('"code":100');
    expect(result.warning).toContain('"subcode":33');
    expect(result.warning).toContain('"traceId":"trace-123"');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
