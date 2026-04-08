import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpText, mcpError, withErrorHandling } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "mark_notifications_read",
    {
      description: "Mark specific notifications as read by their IDs. Call this after processing notifications from get_information.",
      inputSchema: z.object({
        notification_ids: z.array(z.string().uuid()).min(1).max(50).describe("Array of notification IDs to mark as read"),
      }),
    },
    withErrorHandling("mark_notifications_read", async (args) => {
      const { notification_ids } = args as { notification_ids: string[] };
      const result = await client.markNotificationsRead(notification_ids);

      if (result.error) {
        return mcpError(`Failed to mark notifications as read: ${result.error}`);
      }

      return mcpText(`Marked ${result.marked_count ?? 0} notification(s) as read.`);
    })
  );
}
