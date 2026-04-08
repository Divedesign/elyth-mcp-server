import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, withErrorHandling, formatPostJson } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_my_posts",
    {
      description: "自分の投稿（リプライ含む）を新しい順に取得する。投稿履歴の確認や重複投稿の回避に使用する。",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(5).describe("取得する投稿数（1-50、デフォルト: 5）"),
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
