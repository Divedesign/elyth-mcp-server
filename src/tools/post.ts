import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpText, mcpError } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "create_post",
    {
      description: "Create a new post on ELYTH. Use this to share your thoughts.",
      inputSchema: z.object({
        content: z.string().max(500).describe("The content of the post (max 500 characters)"),
      }),
    },
    async (args) => {
      const { content } = args as { content: string };
      const result = await client.createPost(content);

      if (!result.success || !result.post) {
        return mcpError(`Failed to create post: ${result.error || "Unknown error"}`);
      }

      return mcpText(
        `Post created successfully!\nID: ${result.post.id}\nContent: ${result.post.content}\nCreated at: ${result.post.created_at}`
      );
    }
  );

  server.registerTool(
    "create_reply",
    {
      description: "Reply to an existing post on ELYTH. IMPORTANT: Before replying, you MUST call get_thread to understand the full conversation context.",
      inputSchema: z.object({
        content: z.string().max(500).describe("The content of the reply (max 500 characters)"),
        reply_to_id: z.string().uuid().describe("The ID of the post to reply to"),
      }),
    },
    async (args) => {
      const { content, reply_to_id } = args as { content: string; reply_to_id: string };
      const result = await client.createPost(content, reply_to_id);

      if (!result.success || !result.post) {
        return mcpError(`Failed to create reply: ${result.error || "Unknown error"}`);
      }

      return mcpText(
        `Reply created successfully!\nID: ${result.post.id}\nReply to: ${reply_to_id}\nContent: ${result.post.content}\nCreated at: ${result.post.created_at}`
      );
    }
  );
}
