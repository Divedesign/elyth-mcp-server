import { describe, it, expect, vi, beforeEach } from "vitest";
import { ElythApiClient } from "../api.js";

const BASE = "https://test.elyth.dev";
const KEY = "test-api-key";

let client: ElythApiClient;
let fetchSpy: ReturnType<typeof vi.spyOn>;

function mockFetchOk(body: unknown = {}) {
  fetchSpy.mockResolvedValue(new Response(JSON.stringify(body), { status: 200 }));
}

beforeEach(() => {
  client = new ElythApiClient({ baseUrl: BASE, apiKey: KEY });
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("{}", { status: 200 }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// ─── request — エラーハンドリング ───

describe("request error handling", () => {
  it("wraps TypeError with cause", async () => {
    fetchSpy.mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: new Error("connect ECONNREFUSED 127.0.0.1:443"),
      }),
    );
    await expect(client.createPost("x")).rejects.toThrow(
      "Network error: fetch failed (cause: connect ECONNREFUSED 127.0.0.1:443)",
    );
  });

  it("wraps TypeError without cause", async () => {
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    await expect(client.createPost("x")).rejects.toThrow("Network error: fetch failed");
  });

  it("wraps non-Error throw", async () => {
    fetchSpy.mockRejectedValue("string error");
    await expect(client.createPost("x")).rejects.toThrow("Network error: string error");
  });

  it("logs method and URL to stderr", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockRejectedValue(new TypeError("fetch failed"));
    await expect(client.createPost("x")).rejects.toThrow();
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining(`POST ${BASE}/api/mcp/posts`),
    );
  });
});

// ─── リクエスト構築 ───

describe("request construction", () => {
  it("sets x-api-key header", async () => {
    mockFetchOk();
    await client.getTimeline();
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(KEY);
  });

  it("createPost sends POST with body", async () => {
    mockFetchOk({ success: true });
    await client.createPost("hello", "reply-id");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/posts`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ content: "hello", reply_to_id: "reply-id" });
  });

  it("getTimeline sends GET with limit", async () => {
    mockFetchOk();
    await client.getTimeline(10);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/posts?limit=10`);
    expect(init.method).toBe("GET");
  });

  it("getMyPosts sends GET /posts/mine", async () => {
    mockFetchOk();
    await client.getMyPosts(5);
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/posts/mine?limit=5`);
  });

  it("likePost sends POST /posts/{id}/like", async () => {
    mockFetchOk();
    await client.likePost("post-1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/posts/post-1/like`);
    expect(init.method).toBe("POST");
  });

  it("unlikePost sends DELETE /posts/{id}/like", async () => {
    mockFetchOk();
    await client.unlikePost("post-1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/posts/post-1/like`);
    expect(init.method).toBe("DELETE");
  });

  it("followAituber sends POST /aitubers/{id}/follow", async () => {
    mockFetchOk();
    await client.followAituber("aituber-1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/aitubers/aituber-1/follow`);
    expect(init.method).toBe("POST");
  });

  it("unfollowAituber sends DELETE /aitubers/{id}/follow", async () => {
    mockFetchOk();
    await client.unfollowAituber("aituber-1");
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/aitubers/aituber-1/follow`);
    expect(init.method).toBe("DELETE");
  });

  it("getInformation builds query string from include and limits", async () => {
    mockFetchOk();
    await client.getInformation({
      include: ["timeline", "trends"],
      timeline_limit: 5,
      trends_limit: 3,
    });
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const params = new URL(url).searchParams;
    expect(params.get("include")).toBe("timeline,trends");
    expect(params.get("timeline_limit")).toBe("5");
    expect(params.get("trends_limit")).toBe("3");
  });

  it("getInformation omits query string when no params", async () => {
    mockFetchOk();
    await client.getInformation({});
    const [url] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/information`);
  });

  it("markNotificationsRead sends POST with notification_ids", async () => {
    mockFetchOk();
    await client.markNotificationsRead(["n1", "n2"]);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/notifications/read`);
    expect(JSON.parse(init.body as string)).toEqual({ notification_ids: ["n1", "n2"] });
  });

  it("getBatchThreadContext sends POST with post_ids and context_count", async () => {
    mockFetchOk();
    await client.getBatchThreadContext(["p1", "p2"], 5);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${BASE}/api/mcp/thread-context`);
    expect(JSON.parse(init.body as string)).toEqual({ post_ids: ["p1", "p2"], context_count: 5 });
  });
});
