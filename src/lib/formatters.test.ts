import { describe, it, expect } from "vitest";
import { formatThreadContext } from "./formatters.js";
import type { Post } from "../types.js";

function makePost(content: string, overrides?: Partial<Post>): Post {
  return {
    id: "test-id",
    content,
    reply_to_id: null,
    thread_id: null,
    created_at: "2026-01-01T00:00:00Z",
    ai_vtuber_handle: "testbot",
    ai_vtuber_name: "TestBot",
    ...overrides,
  };
}

/** Verify no lone surrogates exist in a string */
function assertNoLoneSurrogates(str: string): void {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate must be followed by low surrogate
      const next = str.charCodeAt(i + 1);
      expect(next).toBeGreaterThanOrEqual(0xdc00);
      expect(next).toBeLessThanOrEqual(0xdfff);
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      // Low surrogate must be preceded by high surrogate
      const prev = str.charCodeAt(i - 1);
      expect(prev).toBeGreaterThanOrEqual(0xd800);
      expect(prev).toBeLessThanOrEqual(0xdbff);
    }
  }
}

describe("formatThreadContext - surrogate pair safety", () => {
  it("does not split emoji at truncation boundary (80 chars)", () => {
    // 79 ASCII + 👍 + extra = 82 graphemes, emoji at position 79
    // Old .slice(0, 80) would split 👍's surrogate pair at UTF-16 position 80
    const content = "a".repeat(79) + "👍xx";
    const result = formatThreadContext([makePost(content)]);

    expect(() => JSON.stringify(result)).not.toThrow();
    assertNoLoneSurrogates(result);
  });

  it("handles content that is all emoji", () => {
    // 100 emoji = 200 UTF-16 code units, exceeds 80 grapheme limit
    const content = "🎉🎊🎈🎁🎂🔥💯✨🌟🎯".repeat(10);
    const result = formatThreadContext([makePost(content)]);

    expect(() => JSON.stringify(result)).not.toThrow();
    assertNoLoneSurrogates(result);
    expect(result).toContain("...");
  });

  it("handles emoji exactly at position 80", () => {
    // 80th character is emoji - truncation must not split it
    const content = "a".repeat(80) + "🔥";
    const result = formatThreadContext([makePost(content)]);

    expect(() => JSON.stringify(result)).not.toThrow();
    assertNoLoneSurrogates(result);
  });

  it("preserves short content with emoji unchanged", () => {
    const content = "Hello 👋 World";
    const result = formatThreadContext([makePost(content)]);

    expect(result).toContain("Hello 👋 World");
    expect(result).not.toContain("...");
  });

  it("handles multiple posts with emoji at boundaries", () => {
    const posts = [
      makePost("x".repeat(79) + "😀extra"),
      makePost("y".repeat(78) + "🇯🇵more"), // flag emoji (4 UTF-16 code units)
      makePost("z".repeat(79) + "👨‍👩‍👧‍👦tail"), // family emoji (ZWJ sequence)
    ];
    const result = formatThreadContext(posts);

    expect(() => JSON.stringify(result)).not.toThrow();
    assertNoLoneSurrogates(result);
  });

  it("old .slice() would have produced lone surrogate (proof)", () => {
    const text = "a".repeat(79) + "👍";
    // Simulate old broken behavior
    const broken = text.slice(0, 80);
    const lastCode = broken.charCodeAt(79);

    // Prove the old approach produces a lone high surrogate
    expect(lastCode).toBeGreaterThanOrEqual(0xd800);
    expect(lastCode).toBeLessThanOrEqual(0xdbff);
    // The low surrogate is missing - this is the bug

    // Our fix avoids this
    const result = formatThreadContext([makePost(text + "x")]);
    assertNoLoneSurrogates(result);
  });
});
