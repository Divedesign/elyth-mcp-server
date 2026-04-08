import { createHash } from "crypto";
import type { Post } from "../types.js";

/** ISO 8601 UTC文字列をJST表示に変換（ミリ秒・秒を排除） */
export function formatJST(isoString: string): string {
  const d = new Date(isoString);
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const yyyy = jst.getUTCFullYear();
  const mm = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(jst.getUTCDate()).padStart(2, "0");
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min} JST`;
}

/** スレッド内で一貫した匿名Human IDを生成する（同期版、Node.js用） */
export function computeHumanDisplayId(userId: string, threadId: string): string {
  const hash = createHash("sha256").update(userId + threadId).digest("hex");
  return "#" + hash.substring(0, 4);
}

/** Returns `@handle (name)` or `Human #xxxx` for human posts */
export function formatAuthor(post: Pick<Post, 'author_type' | 'author_id' | 'author_handle' | 'author_name'>, threadId?: string | null): string {
  if (post.author_type === 'user' && post.author_id) {
    const displayId = threadId ? computeHumanDisplayId(post.author_id, threadId) : "";
    return `Human ${displayId}`.trim();
  }
  if (post.author_handle) {
    return `@${post.author_handle} (${post.author_name})`;
  }
  return "Unknown";
}

/** Wraps text in MCP content format */
export function mcpText(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

/** Wraps a JSON object in MCP content format (日本語キーJSON統一用) */
export function mcpJson(data: Record<string, unknown>) {
  return mcpText(JSON.stringify(data, null, 2));
}

export interface FormatPostOptions {
  threadId?: string | null;
  includeAuthor?: boolean;
  includeReplyInfo?: boolean;
}

/** 投稿データを日本語キーのJSON objectに統一変換 */
export function formatPostJson(post: Omit<Post, 'reply_to_id' | 'thread_id'> & { reply_to_id?: string | null; thread_id?: string | null }, options: FormatPostOptions = {}): Record<string, unknown> {
  const { threadId, includeAuthor = true, includeReplyInfo = false } = options;
  const entry: Record<string, unknown> = { "投稿ID": post.id };
  if (includeAuthor) entry["投稿者"] = formatAuthor(post, threadId);
  entry["内容"] = post.content;
  entry["いいね数"] = post.like_count ?? 0;
  entry["いいね済み"] = post.liked_by_me ?? false;
  entry["リプライ数"] = post.reply_count ?? 0;
  entry["投稿日時"] = formatJST(post.created_at);
  if (includeReplyInfo && post.reply_to_id) entry["返信先ID"] = post.reply_to_id;
  if (post.thread_id) entry["スレッドID"] = post.thread_id;
  return entry;
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
