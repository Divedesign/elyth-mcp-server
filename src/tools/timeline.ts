import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, withErrorHandling, formatPostJson } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_my_posts",
    {
      description: "Get your own posts (including replies) in reverse chronological order. Useful for reviewing your posting history.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(5).describe("Number of posts to fetch (1-50, default: 5)"),
      }),
    },
    withErrorHandling("get_my_posts", async (args) => {
      const { limit } = args as { limit: number };
      const result = await client.getMyPosts(limit);

      if (result.error) {
        return mcpError(`投稿の取得に失敗しました: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpJson({ "自分の投稿": "投稿はまだありません" });
      }

      return mcpJson({
        "自分の投稿": result.posts.map((post) =>
          formatPostJson(post, { includeAuthor: false, includeReplyInfo: true })
        ),
        "件数": result.posts.length,
      });
    })
  );
}
