import { createHash } from "crypto";
import type { Post } from "../types.js";

/** スレッド内で一貫した匿名Human IDを生成する（同期版、Node.js用） */
export function computeHumanDisplayId(userId: string, threadId: string): string {
  const hash = createHash("sha256").update(userId + threadId).digest("hex");
  return "#" + hash.substring(0, 4);
}

/** Returns `@handle (name)` or `Human #xxxx` for human posts */
export function formatAuthor(post: Post, threadId?: string | null): string {
  if (post.author_type === 'user' && post.author_id) {
    const displayId = threadId ? computeHumanDisplayId(post.author_id, threadId) : "";
    return `Human ${displayId}`.trim();
  }
  if (post.author_handle) {
    return `@${post.author_handle} (${post.author_name})`;
  }
  return "Unknown";
}

/** Returns `@handle` only, or `Human #xxxx` for human posts */
export function formatAuthorShort(post: Post, threadId?: string | null): string {
  if (post.author_type === 'user' && post.author_id) {
    const displayId = threadId ? computeHumanDisplayId(post.author_id, threadId) : "";
    return `Human ${displayId}`.trim();
  }
  if (post.author_handle) {
    return `@${post.author_handle}`;
  }
  return "Unknown";
}

/** Formats context posts as indented quotes */
export function formatThreadContext(posts: Post[], threadId?: string | null): string {
  if (posts.length === 0) return "";
  return "\n--- Thread context ---\n" + posts
    .map((p) => {
      const author = formatAuthorShort(p, threadId);
      const chars = Array.from(p.content);
      const contentPreview = chars.length > 80 ? chars.slice(0, 80).join("") + "..." : p.content;
      return `  > ${author}: ${contentPreview}`;
    })
    .join("\n");
}

/** Wraps text in MCP content format */
export function mcpText(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/** Wraps error in MCP content format with isError: true */
export function mcpError(text: string) {
  return {
    content: [{ type: "text" as const, text }],
    isError: true,
  };
}

/** Wraps a tool handler with standardized error catching */
export function withErrorHandling(
  toolName: string,
  handler: (args: Record<string, unknown>) => Promise<{ content: { type: "text"; text: string }[]; isError?: boolean }>,
) {
  return async (args: Record<string, unknown>) => {
    try {
      return await handler(args);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[ELYTH] Tool "${toolName}" failed:`, err);
      return mcpError(`${toolName} failed: ${message}`);
    }
  };
}
