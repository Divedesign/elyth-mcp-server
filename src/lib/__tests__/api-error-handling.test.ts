import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElythApiClient } from "../api.js";

// 到達不能なホストでfetch failedを再現
const client = new ElythApiClient({
  baseUrl: "http://192.0.2.1:1", // TEST-NET: 到達不能なアドレス
  apiKey: "test-key",
});

// stderrのconsole.errorをキャプチャ
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

describe("ElythApiClient — fetch failed error handling", () => {
  it("createPost throws enriched error with cause on network failure", async () => {
    await expect(client.createPost("test content")).rejects.toThrow(/Network error/);

    // stderrにログが出力されている
    expect(errorLogs.some((log) => log.includes("[ELYTH] fetch error:"))).toBe(true);
    expect(errorLogs.some((log) => log.includes("POST"))).toBe(true);
  }, 10000);

  it("getTimeline throws enriched error on network failure", async () => {
    await expect(client.getTimeline()).rejects.toThrow(/Network error/);
    expect(errorLogs.some((log) => log.includes("[ELYTH] fetch error:"))).toBe(true);
  }, 10000);

  it("likePost throws enriched error on network failure", async () => {
    await expect(
      client.likePost("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(/Network error/);
    expect(errorLogs.some((log) => log.includes("[ELYTH] fetch error:"))).toBe(true);
  }, 10000);

  it("error message includes cause detail when available", async () => {
    try {
      await client.createPost("test");
      expect.unreachable("should have thrown");
    } catch (err) {
      const message = (err as Error).message;
      // "Network error: fetch failed (cause: ...)" の形式
      expect(message).toMatch(/Network error:/);
      // causeがある場合は含まれる（環境依存だがNode.jsでは通常あり）
      // 少なくとも "fetch failed" という元のメッセージは含まれる
      expect(message.toLowerCase()).toContain("fetch");
    }
  }, 10000);
});

describe("ElythApiClient — mock fetch failure", () => {
  it("extracts err.cause from TypeError", async () => {
    const mockClient = new ElythApiClient({
      baseUrl: "http://localhost:99999",
      apiKey: "test-key",
    });

    // globalThis.fetch をモックして TypeError(cause) を投げる
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(
      Object.assign(new TypeError("fetch failed"), {
        cause: new Error("connect ECONNREFUSED 127.0.0.1:443"),
      })
    );

    try {
      await expect(mockClient.createPost("test")).rejects.toThrow(
        /Network error: fetch failed \(cause: connect ECONNREFUSED 127\.0\.0\.1:443\)/
      );
      expect(errorLogs.some((log) => log.includes("ECONNREFUSED"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles error without cause gracefully", async () => {
    const mockClient = new ElythApiClient({
      baseUrl: "http://localhost:99999",
      apiKey: "test-key",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed"));

    try {
      await expect(mockClient.createPost("test")).rejects.toThrow(
        /Network error: fetch failed$/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("handles non-Error throw gracefully", async () => {
    const mockClient = new ElythApiClient({
      baseUrl: "http://localhost:99999",
      apiKey: "test-key",
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue("string error");

    try {
      await expect(mockClient.createPost("test")).rejects.toThrow(
        /Network error: string error/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
