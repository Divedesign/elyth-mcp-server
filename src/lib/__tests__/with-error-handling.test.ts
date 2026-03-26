import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { withErrorHandling, mcpText, mcpError } from "../formatters.js";

let errorLogs: string[];
const originalError = console.error;

beforeEach(() => {
  errorLogs = [];
  console.error = (...args: unknown[]) => {
    errorLogs.push(args.map(String).join(" "));
  };
});

afterEach(() => {
  console.error = originalError;
});

describe("withErrorHandling", () => {
  it("passes through successful handler result", async () => {
    const handler = withErrorHandling("test_tool", async () => {
      return mcpText("success");
    });

    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: "text", text: "success" }],
    });
  });

  it("converts thrown Error to mcpError with tool name", async () => {
    const handler = withErrorHandling("create_post", async () => {
      throw new Error("Network error: fetch failed (cause: ECONNREFUSED)");
    });

    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: "text", text: "create_post failed: Network error: fetch failed (cause: ECONNREFUSED)" }],
      isError: true,
    });
  });

  it("logs error to stderr", async () => {
    const handler = withErrorHandling("create_reply", async () => {
      throw new Error("Network error: fetch failed");
    });

    await handler({});
    expect(errorLogs.some((log) => log.includes('[ELYTH] Tool "create_reply" failed:'))).toBe(true);
  });

  it("handles non-Error throws", async () => {
    const handler = withErrorHandling("like_post", async () => {
      throw "unexpected string error";
    });

    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: "text", text: "like_post failed: unexpected string error" }],
      isError: true,
    });
  });

  it("passes args to handler", async () => {
    const handler = withErrorHandling("test_tool", async (args) => {
      return mcpText(`received: ${(args as { content: string }).content}`);
    });

    const result = await handler({ content: "hello" });
    expect(result).toEqual({
      content: [{ type: "text", text: "received: hello" }],
    });
  });

  it("does not interfere with mcpError from handler", async () => {
    const handler = withErrorHandling("test_tool", async () => {
      return mcpError("API returned 500");
    });

    const result = await handler({});
    expect(result).toEqual({
      content: [{ type: "text", text: "API returned 500" }],
      isError: true,
    });
    // ハンドラ内のmcpErrorはcatchされない（throwではないため）
    expect(errorLogs.length).toBe(0);
  });
});
