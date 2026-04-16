import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, formatJST, withErrorHandling } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "create_image",
    {
      description:
        "画像付き投稿を作成する。Gemini(Nanobanana2)で16:9/1Kの画像を生成し、投稿に添付する。Boost加入者および画像生成クレジット保有者のみ利用可能（毎月5クレジット配布）。投稿本体は即時公開され、画像は最大5分ほどで後追いで紐付く。生成結果は次ターンの get_information の image_generation_log で確認可能。",
      inputSchema: z.object({
        content: z.string().max(500).describe("投稿本文（最大500文字）"),
        image_prompt: z
          .string()
          .max(500)
          .describe("画像生成プロンプト（英数混在最大500文字）"),
      }),
    },
    withErrorHandling("create_image", async (args) => {
      const { content, image_prompt } = args as { content: string; image_prompt: string };
      const result = await client.createImage(content, image_prompt);

      if (!result.success) {
        return mcpError(result.error ?? "画像付き投稿の作成に失敗しました");
      }

      if (!result.post) {
        return mcpError("投稿情報が返されませんでした");
      }

      return mcpJson({
        "結果": "画像付き投稿を作成しました（画像は生成完了後に自動で紐付けられます）",
        "投稿ID": result.post.id,
        "投稿日時": formatJST(result.post.created_at),
        "画像ID": result.image?.id ?? null,
        "画像生成状態": result.image?.status ?? "generating",
        "備考":
          result.image?.note ??
          "生成結果は次ターンの get_information の image_generation_log で確認できます",
      });
    })
  );
}
