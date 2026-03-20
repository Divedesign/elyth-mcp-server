import { describe, it, expect } from "vitest";
import { formatAuthor, formatAuthorShort, formatThreadContext, mcpText, mcpError } from "../formatters.js";
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

// ─── formatAuthor ───

describe("formatAuthor", () => {
  it("returns @handle (name) for flat structure", () => {
    const post = makePost({ ai_vtuber_handle: "alice", ai_vtuber_name: "Alice" });
    expect(formatAuthor(post)).toBe("@alice (Alice)");
  });

  it("returns @handle (name) for nested structure", () => {
    const post = makePost({ ai_vtuber: { id: "v1", name: "Bob", handle: "bob" } });
    expect(formatAuthor(post)).toBe("@bob (Bob)");
  });

  it("prefers flat structure over nested", () => {
    const post = makePost({
      ai_vtuber_handle: "flat",
      ai_vtuber_name: "Flat",
      ai_vtuber: { id: "v1", name: "Nested", handle: "nested" },
    });
    expect(formatAuthor(post)).toBe("@flat (Flat)");
  });

  it("returns Unknown when neither structure present", () => {
    expect(formatAuthor(makePost())).toBe("Unknown");
  });
});

// ─── formatAuthorShort ───

describe("formatAuthorShort", () => {
  it("returns @handle for flat structure", () => {
    const post = makePost({ ai_vtuber_handle: "alice" });
    expect(formatAuthorShort(post)).toBe("@alice");
  });

  it("returns @handle for nested structure", () => {
    const post = makePost({ ai_vtuber: { id: "v1", name: "Bob", handle: "bob" } });
    expect(formatAuthorShort(post)).toBe("@bob");
  });

  it("returns Unknown when neither structure present", () => {
    expect(formatAuthorShort(makePost())).toBe("Unknown");
  });
});

// ─── formatThreadContext ───

describe("formatThreadContext", () => {
  it("returns empty string for empty array", () => {
    expect(formatThreadContext([])).toBe("");
  });

  it("formats a single post", () => {
    const posts = [makePost({ ai_vtuber_handle: "alice", content: "Hi there" })];
    const result = formatThreadContext(posts);
    expect(result).toContain("--- Thread context ---");
    expect(result).toContain("> @alice: Hi there");
  });

  it("truncates content over 80 chars with ...", () => {
    const longContent = "a".repeat(100);
    const posts = [makePost({ ai_vtuber_handle: "alice", content: longContent })];
    const result = formatThreadContext(posts);
    expect(result).toContain("a".repeat(80) + "...");
    expect(result).not.toContain("a".repeat(81));
  });

  it("does not truncate content at exactly 80 chars", () => {
    const exactContent = "b".repeat(80);
    const posts = [makePost({ ai_vtuber_handle: "alice", content: exactContent })];
    const result = formatThreadContext(posts);
    expect(result).toContain(exactContent);
    expect(result).not.toContain("...");
  });

  it("formats multiple posts", () => {
    const posts = [
      makePost({ ai_vtuber_handle: "alice", content: "First" }),
      makePost({ ai_vtuber_handle: "bob", content: "Second" }),
    ];
    const result = formatThreadContext(posts);
    expect(result).toContain("> @alice: First");
    expect(result).toContain("> @bob: Second");
  });
});

// ─── mcpText ───

describe("mcpText", () => {
  it("wraps text in MCP content format", () => {
    expect(mcpText("hello")).toEqual({
      content: [{ type: "text", text: "hello" }],
    });
  });
});

// ─── mcpError ───

describe("mcpError", () => {
  it("wraps text in MCP content format with isError", () => {
    expect(mcpError("fail")).toEqual({
      content: [{ type: "text", text: "fail" }],
      isError: true,
    });
  });
});
