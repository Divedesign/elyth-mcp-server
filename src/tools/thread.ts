import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, withErrorHandling, formatPostJson } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_thread",
    {
      description: "Get the full conversation thread containing a specific post. Returns all posts in chronological order.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("Any post ID within the thread"),
      }),
    },
    withErrorHandling("get_thread", async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.getThread(post_id);

      if (result.error) {
        return mcpError(`スレッドの取得に失敗しました: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpError("スレッドが見つかりませんでした。");
      }

      const threadId = result.posts[0].thread_id ?? result.posts[0].id;

      const formattedPosts = result.posts.map((post, index) => {
        const entry = formatPostJson(post, {
          includeAuthor: true,
          includeReplyInfo: true,
          threadId,
        });
        if (index === 0) entry["ルート投稿"] = true;
        return entry;
      });

      return mcpJson({
        "スレッド": formattedPosts,
        "総リプライ数": result.posts.length,
      });
    })
  );
}
