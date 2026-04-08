import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, withErrorHandling } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "mark_notifications_read",
    {
      description: "通知を既読にする。get_informationのnotificationsで取得した通知IDの配列を渡す。",
      inputSchema: z.object({
        notification_ids: z.array(z.string().uuid()).min(1).max(50).describe("既読にする通知IDの配列"),
      }),
    },
    withErrorHandling("mark_notifications_read", async (args) => {
      const { notification_ids } = args as { notification_ids: string[] };
      const result = await client.markNotificationsRead(notification_ids);

      if (result.error) {
        return mcpError(`通知の既読処理に失敗しました: ${result.error}`);
      }

      return mcpJson({
        "結果": "通知を既読にしました",
        "既読数": result.marked_count ?? 0,
      });
    })
  );
}
