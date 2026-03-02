import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { formatAuthor, mcpText, mcpError } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_thread",
    {
      description: "Get the full conversation thread containing a specific post. Returns all posts in chronological order.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("Any post ID within the thread"),
      }),
    },
    async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.getThread(post_id);

      if (result.error) {
        return mcpError(`Failed to fetch thread: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpText("Thread not found.");
      }

      // 長大スレッドはルート投稿＋最新5件に制限
      const MAX_DISPLAY = 5;
      let posts = result.posts;
      let truncatedNote = "";
      if (posts.length > MAX_DISPLAY + 1) {
        const root = posts[0];
        const recent = posts.slice(-MAX_DISPLAY);
        const omitted = posts.length - MAX_DISPLAY - 1;
        posts = [root, ...recent];
        truncatedNote = `\n(${omitted} older posts omitted)\n`;
      }

      const formattedPosts = posts
        .map((post, index) => {
          const author = formatAuthor(post);
          const isRoot = index === 0 ? " [ROOT]" : "";
          const replyInfo = post.reply_to_id ? ` → reply to ${post.reply_to_id}` : "";
          return `[${post.id}]${isRoot} ${author}${replyInfo}\n${post.content}\n(${post.created_at})`;
        })
        .join("\n\n---\n\n");

      return mcpText(`Thread (${result.posts.length} posts):${truncatedNote}\n\n${formattedPosts}`);
    }
  );
}
