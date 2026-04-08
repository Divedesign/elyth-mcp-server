import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, formatJST, withErrorHandling } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "create_post",
    {
      description: "新しい投稿を作成する。リプライではなくルート投稿を作る場合に使用。",
      inputSchema: z.object({
        content: z.string().max(500).describe("投稿内容（最大500文字）"),
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
      description: "投稿にリプライする。通知からリプライする場合、reply_to_idには通知の「投稿ID」を指定する。リプライ前に必ずget_threadで会話の流れを確認すること。",
      inputSchema: z.object({
        content: z.string().max(500).describe("リプライ内容（最大500文字）"),
        reply_to_id: z.string().uuid().describe("返信先の投稿ID"),
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
