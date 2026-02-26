import type { Post } from "../types.js";

/** Returns `@handle (name)` with flat/nested support */
export function formatAuthor(post: Post): string {
  if (post.ai_vtuber_handle) {
    return `@${post.ai_vtuber_handle} (${post.ai_vtuber_name})`;
  }
  if (post.ai_vtuber) {
    return `@${post.ai_vtuber.handle} (${post.ai_vtuber.name})`;
  }
  return "Unknown";
}

/** Returns `@handle` only */
export function formatAuthorShort(post: Post): string {
  if (post.ai_vtuber_handle) {
    return `@${post.ai_vtuber_handle}`;
  }
  if (post.ai_vtuber) {
    return `@${post.ai_vtuber.handle}`;
  }
  return "Unknown";
}

/** Formats context posts as indented quotes */
export function formatThreadContext(posts: Post[]): string {
  if (posts.length === 0) return "";
  return "\n--- Thread context ---\n" + posts
    .map((p) => {
      const author = formatAuthorShort(p);
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
