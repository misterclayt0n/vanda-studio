import * as Effect from "effect/Effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { igCommentsAdapter, igMentionsAdapter } from "./liveObserve";

const config = { igUserId: "ig1", token: "tok" };

describe("igCommentsAdapter (fetch-mocked)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flattens comments across recent media into raw signals", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const request = String(url);
      if (request === "https://next/comments") {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "k2",
                text: "quero um",
                timestamp: "2024-01-02T00:00:00+0000",
                username: "bob",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (request === "https://next/media") {
        return new Response(
          JSON.stringify({
            data: [
              {
                id: "m4",
                permalink: "https://p/4",
                comments: { data: [{ id: "k3", text: "quanto custa?" }] },
              },
            ],
          }),
          { status: 200 },
        );
      }
      expect(request).toContain("/ig1/media");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "m1",
              caption: "new phone",
              media_type: "IMAGE",
              timestamp: "2023-12-30T00:00:00+0000",
              permalink: "https://p/1",
              comments: {
                data: [
                  {
                    id: "k1",
                    text: "love",
                    timestamp: "2024-01-01T00:00:00+0000",
                    username: "alice",
                  },
                ],
                paging: { next: "https://next/comments" },
              },
            },
            { id: "m2", permalink: "https://p/2", comments: { data: [] } },
            { id: "m3", permalink: "https://p/3" },
          ],
          paging: { next: "https://next/media" },
        }),
        { status: 200 },
      );
    });

    const signals = await Effect.runPromise(igCommentsAdapter(config).fetch());
    expect(signals).toHaveLength(3);
    expect(signals[0]).toMatchObject({
      source: "comments",
      externalId: "k1",
      text: "love",
      authorHandle: "alice",
      permalink: "https://p/1",
      mediaExternalId: "m1",
      mediaCaption: "new phone",
      mediaType: "IMAGE",
      syncKind: "reconciliation",
    });
    expect(signals[0]!.observedAt).toBe(Date.parse("2024-01-01T00:00:00+0000"));
    expect(signals.map((signal) => signal.externalId)).toEqual(["k1", "k2", "k3"]);
  });

  it("fails SourceFetchFailed on a non-2xx response", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    const error = await Effect.runPromise(igCommentsAdapter(config).fetch().pipe(Effect.flip));
    expect(error._tag).toBe("SourceFetchFailed");
  });
});

describe("igMentionsAdapter (fetch-mocked)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("maps tagged media into mention signals", async () => {
    vi.stubGlobal("fetch", async (url: string | URL) => {
      const request = String(url);
      if (request === "https://next/tags")
        return new Response(JSON.stringify({ data: [{ id: "t2", caption: "outra marcação" }] }), {
          status: 200,
        });
      expect(request).toContain("/ig1/tags");
      return new Response(
        JSON.stringify({
          data: [
            {
              id: "t1",
              caption: "nice spot",
              timestamp: "2024-02-02T00:00:00+0000",
              username: "bob",
            },
          ],
          paging: { next: "https://next/tags" },
        }),
        { status: 200 },
      );
    });

    const signals = await Effect.runPromise(igMentionsAdapter(config).fetch());
    expect(signals).toHaveLength(2);
    expect(signals[0]).toMatchObject({
      source: "mentions",
      externalId: "t1",
      text: "nice spot",
      authorHandle: "bob",
    });
  });
});
