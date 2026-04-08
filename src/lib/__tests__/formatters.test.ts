import { describe, it, expect, vi } from "vitest";
import {
  computeHumanDisplayId,
  formatAuthor,
  formatPostJson,
  mcpText,
  mcpJson,
  mcpError,
  withErrorHandling,
} from "../formatters.js";
import type { Post } from "../../types.js";

function makePost(overrides: Partial<Post> = {}): Post {
  return {
    id: "post-1",
    content: "Hello world",
    reply_to_id: null,
    thread_id: null,
    created_at: "2026-03-21T00:00:00Z",
    ...overrides,
  };
}

// ─── computeHumanDisplayId ───

describe("computeHumanDisplayId", () => {
  it("returns #xxxx format (4 hex chars)", () => {
    expect(computeHumanDisplayId("user-1", "thread-1")).toMatch(/^#[0-9a-f]{4}$/);
  });

  it("is deterministic for same user+thread", () => {
    const a = computeHumanDisplayId("user-1", "thread-1");
    const b = computeHumanDisplayId("user-1", "thread-1");
    expect(a).toBe(b);
  });

  it("differs across users in the same thread", () => {
    const a = computeHumanDisplayId("user-1", "thread-1");
    const b = computeHumanDisplayId("user-2", "thread-1");
    expect(a).not.toBe(b);
  });

  it("differs across threads for the same user", () => {
    const a = computeHumanDisplayId("user-1", "thread-1");
    const b = computeHumanDisplayId("user-1", "thread-2");
    expect(a).not.toBe(b);
  });
});

// ─── formatAuthor ───

describe("formatAuthor", () => {
  it("returns @handle (name) for aituber post", () => {
    const post = makePost({ author_handle: "alice", author_name: "Alice", author_type: "aituber" });
    expect(formatAuthor(post)).toBe("@alice (Alice)");
  });

  it("returns Human #xxxx for user post with threadId", () => {
    const post = makePost({ author_id: "user-abc", author_type: "user" });
    expect(formatAuthor(post, "thread-123")).toMatch(/^Human #[0-9a-f]{4}$/);
  });

  it("returns Human for user post without threadId", () => {
    const post = makePost({ author_id: "user-abc", author_type: "user" });
    expect(formatAuthor(post)).toBe("Human");
  });

  it("prioritizes author_type=user over handle", () => {
    const post = makePost({ author_id: "u1", author_type: "user", author_handle: "bot", author_name: "Bot" });
    expect(formatAuthor(post)).toBe("Human");
  });

  it("returns Unknown when no identity present", () => {
    expect(formatAuthor(makePost())).toBe("Unknown");
  });
});

// ─── mcpText / mcpJson / mcpError ───

describe("mcpText", () => {
  it("wraps text in MCP content format", () => {
    expect(mcpText("hello")).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });
});

describe("mcpJson", () => {
  it("wraps JSON object as pretty-printed MCP text", () => {
    const result = mcpJson({ "結果": "成功", "件数": 3 });
    expect(result).toEqual({
      content: [{ type: "text", text: JSON.stringify({ "結果": "成功", "件数": 3 }, null, 2) }],
    });
  });
});

describe("mcpError", () => {
  it("wraps text with isError flag", () => {
    expect(mcpError("fail")).toEqual({
      content: [{ type: "text", text: "fail" }],
      isError: true,
    });
  });
});

// ─── formatPostJson ───

describe("formatPostJson", () => {
  it("returns full post data with author by default", () => {
    const post = makePost({
      author_handle: "alice",
      author_name: "Alice",
      author_type: "aituber",
      like_count: 5,
      liked_by_me: true,
      reply_count: 2,
      thread_id: "thread-1",
    });
    const result = formatPostJson(post);
    expect(result).toEqual({
      "投稿ID": "post-1",
      "投稿者": "@alice (Alice)",
      "内容": "Hello world",
      "いいね数": 5,
      "いいね済み": true,
      "リプライ数": 2,
      "投稿日時": "2026-03-21T00:00:00Z",
      "スレッドID": "thread-1",
    });
  });

  it("omits author when includeAuthor is false", () => {
    const post = makePost({ author_handle: "bob", author_name: "Bob", author_type: "aituber" });
    const result = formatPostJson(post, { includeAuthor: false });
    expect(result).not.toHaveProperty("投稿者");
  });

  it("includes reply info when includeReplyInfo is true", () => {
    const post = makePost({ reply_to_id: "parent-1" });
    const result = formatPostJson(post, { includeReplyInfo: true });
    expect(result["返信先ID"]).toBe("parent-1");
  });

  it("omits reply info when reply_to_id is null", () => {
    const post = makePost({ reply_to_id: null });
    const result = formatPostJson(post, { includeReplyInfo: true });
    expect(result).not.toHaveProperty("返信先ID");
  });

  it("uses threadId for human display ID", () => {
    const post = makePost({ author_id: "user-abc", author_type: "user" });
    const result = formatPostJson(post, { threadId: "thread-1" });
    expect(result["投稿者"]).toMatch(/^Human #[0-9a-f]{4}$/);
  });

  it("defaults like_count and reply_count to 0", () => {
    const post = makePost();
    const result = formatPostJson(post);
    expect(result["いいね数"]).toBe(0);
    expect(result["リプライ数"]).toBe(0);
  });

  it("omits thread_id when null", () => {
    const post = makePost({ thread_id: null });
    const result = formatPostJson(post);
    expect(result).not.toHaveProperty("スレッドID");
  });
});

// ─── withErrorHandling ───

describe("withErrorHandling", () => {
  it("passes through successful result", async () => {
    const handler = withErrorHandling("test", async () => mcpText("ok"));
    expect(await handler({})).toEqual(mcpText("ok"));
  });

  it("converts Error to mcpError with tool name prefix", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling("create_post", async () => {
      throw new Error("Network error: fetch failed");
    });
    expect(await handler({})).toEqual(mcpError("create_post failed: Network error: fetch failed"));
  });

  it("converts non-Error throw to mcpError", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling("like_post", async () => {
      throw "unexpected";
    });
    expect(await handler({})).toEqual(mcpError("like_post failed: unexpected"));
  });

  it("logs to stderr with tool name", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling("create_reply", async () => {
      throw new Error("boom");
    });
    await handler({});
    expect(spy).toHaveBeenCalledWith('[ELYTH] Tool "create_reply" failed:', expect.any(Error));
  });

  it("forwards args to handler", async () => {
    const handler = withErrorHandling("test", async (args) => {
      return mcpText(`got: ${(args as { v: string }).v}`);
    });
    expect(await handler({ v: "hello" })).toEqual(mcpText("got: hello"));
  });

  it("does not re-catch mcpError returned by handler", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = withErrorHandling("test", async () => mcpError("API 500"));
    expect(await handler({})).toEqual(mcpError("API 500"));
    expect(spy).not.toHaveBeenCalled();
  });
});
