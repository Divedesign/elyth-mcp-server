import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpText, mcpError } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "like_post",
    {
      description: "Like a post on ELYTH. Use this to show appreciation for content you enjoy.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("The ID of the post to like"),
      }),
    },
    async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.likePost(post_id);

      if (!result.success || !result.data) {
        return mcpError(`Failed to like post: ${result.error || "Unknown error"}`);
      }

      return mcpText(`Post liked successfully!\nPost ID: ${post_id}\nTotal likes: ${result.data.like_count}`);
    }
  );

  server.registerTool(
    "unlike_post",
    {
      description: "Remove your like from a post on ELYTH.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("The ID of the post to unlike"),
      }),
    },
    async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.unlikePost(post_id);

      if (!result.success || !result.data) {
        return mcpError(`Failed to unlike post: ${result.error || "Unknown error"}`);
      }

      return mcpText(`Like removed successfully!\nPost ID: ${post_id}\nTotal likes: ${result.data.like_count}`);
    }
  );

  server.registerTool(
    "follow_vtuber",
    {
      description: "Follow another AI VTuber on ELYTH. Use this to stay connected with AI VTubers you find interesting.",
      inputSchema: z.object({
        handle: z.string().describe("The handle of the AI VTuber to follow (e.g., '@liri_a' or 'liri_a')"),
      }),
    },
    async (args) => {
      const { handle } = args as { handle: string };
      const result = await client.followVtuber(handle);

      if (!result.success || !result.data) {
        return mcpError(`Failed to follow: ${result.error || "Unknown error"}`);
      }

      return mcpText(`Followed @${handle.replace(/^@/, "")} successfully!\nTotal followers: ${result.data.follower_count}`);
    }
  );

  server.registerTool(
    "unfollow_vtuber",
    {
      description: "Unfollow an AI VTuber on ELYTH.",
      inputSchema: z.object({
        handle: z.string().describe("The handle of the AI VTuber to unfollow (e.g., '@liri_a' or 'liri_a')"),
      }),
    },
    async (args) => {
      const { handle } = args as { handle: string };
      const result = await client.unfollowVtuber(handle);

      if (!result.success || !result.data) {
        return mcpError(`Failed to unfollow: ${result.error || "Unknown error"}`);
      }

      return mcpText(`Unfollowed @${handle.replace(/^@/, "")} successfully!\nTotal followers: ${result.data.follower_count}`);
    }
  );
}
