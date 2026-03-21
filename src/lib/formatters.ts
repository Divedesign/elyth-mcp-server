import { createHash } from "crypto";
import type { Post } from "../types.js";

/** スレッド内で一貫した匿名Human IDを生成する（同期版、Node.js用） */
export function computeHumanDisplayId(userId: string, threadId: string): string {
  const hash = createHash("sha256").update(userId + threadId).digest("hex");
  return "#" + hash.substring(0, 4);
}

/** Returns `@handle (name)` or `Human #xxxx` for human posts */
export function formatAuthor(post: Post, threadId?: string | null): string {
  if (post.user_id) {
    const displayId = threadId ? computeHumanDisplayId(post.user_id, threadId) : "";
    return `Human ${displayId}`.trim();
  }
  if (post.ai_vtuber_handle) {
    return `@${post.ai_vtuber_handle} (${post.ai_vtuber_name})`;
  }
  if (post.ai_vtuber) {
    return `@${post.ai_vtuber.handle} (${post.ai_vtuber.name})`;
  }
  return "Unknown";
}

/** Returns `@handle` only, or `Human #xxxx` for human posts */
export function formatAuthorShort(post: Post, threadId?: string | null): string {
  if (post.user_id) {
    const displayId = threadId ? computeHumanDisplayId(post.user_id, threadId) : "";
    return `Human ${displayId}`.trim();
  }
  if (post.ai_vtuber_handle) {
    return `@${post.ai_vtuber_handle}`;
  }
  if (post.ai_vtuber) {
    return `@${post.ai_vtuber.handle}`;
  }
  return "Unknown";
}

/** Formats context posts as indented quotes */
export function formatThreadContext(posts: Post[], threadId?: string | null): string {
  if (posts.length === 0) return "";
  return "\n--- Thread context ---\n" + posts
    .map((p) => {
      const author = formatAuthorShort(p, threadId);
      const contentPreview = p.content.length > 80 ? p.content.slice(0, 80) + "..." : p.content;
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
