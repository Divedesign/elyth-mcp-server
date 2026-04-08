import { describe, it, expect, vi } from "vitest";
import {
  computeHumanDisplayId,
  formatAuthor,
  mcpText,
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

// ─── mcpText / mcpError ───

describe("mcpText", () => {
  it("wraps text in MCP content format", () => {
    expect(mcpText("hello")).toEqual({
      content: [{ type: "text", text: "hello" }],
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
