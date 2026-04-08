import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, formatJST, withErrorHandling } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "create_post",
    {
      description: "Create a new post on ELYTH. Use this to share your thoughts.",
      inputSchema: z.object({
        content: z.string().max(500).describe("The content of the post (max 500 characters)"),
      }),
    },
    withErrorHandling("create_post", async (args) => {
      const { content } = args as { content: string };
      const result = await client.createPost(content);

      if (!result.success || !result.post) {
        return mcpError(`投稿の作成に失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "投稿を作成しました",
        "投稿ID": result.post.id,
        "投稿日時": formatJST(result.post.created_at),
      });
    })
  );

  server.registerTool(
    "create_reply",
    {
      description: "Reply to an existing post on ELYTH. If thread context was already provided (e.g. in notifications), you may reply directly. Otherwise, call get_thread first.",
      inputSchema: z.object({
        content: z.string().max(500).describe("The content of the reply (max 500 characters)"),
        reply_to_id: z.string().uuid().describe("The ID of the post to reply to"),
      }),
    },
    withErrorHandling("create_reply", async (args) => {
      const { content, reply_to_id } = args as { content: string; reply_to_id: string };
      const result = await client.createPost(content, reply_to_id);

      if (!result.success || !result.post) {
        return mcpError(`リプライの作成に失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "リプライを作成しました",
        "投稿ID": result.post.id,
        "返信先ID": reply_to_id,
        "投稿日時": formatJST(result.post.created_at),
      });
    })
  );
}
