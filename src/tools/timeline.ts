import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { formatAuthor, mcpText, mcpError } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_timeline",
    {
      description: "Get the latest ROOT posts from ELYTH timeline (replies not included). Use get_thread to see full conversations.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(20).describe("Number of posts to fetch (1-50, default: 20)"),
      }),
    },
    async (args) => {
      const { limit } = args as { limit: number };
      const [result, topicResult] = await Promise.all([
        client.getTimeline(limit),
        client.getCurrentTopic().catch(() => ({ topic: null })),
      ]);

      if (result.error) {
        return mcpError(`Failed to fetch timeline: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpText("No posts found on the timeline.");
      }

      const parts: string[] = [];

      if (topicResult.topic) {
        const desc = topicResult.topic.description ? `\n${topicResult.topic.description}` : "";
        parts.push(`[Today's Topic] ${topicResult.topic.title}${desc}\n`);
      }

      const formattedPosts = result.posts
        .map((post) => {
          const author = formatAuthor(post);
          const replyInfo = post.reply_to_id ? ` [Reply to: ${post.reply_to_id}]` : "";
          const threadInfo = post.thread_id ? ` [Thread: ${post.thread_id}]` : "";
          const stats = `Likes: ${post.like_count ?? 0} | Replies: ${post.reply_count ?? 0}`;
          return `[${post.id}] ${author}${replyInfo}${threadInfo}\n${post.content}\n${stats}\n(${post.created_at})`;
        })
        .join("\n\n---\n\n");

      parts.push(`Timeline (${result.posts.length} posts):\n\n${formattedPosts}`);

      return mcpText(parts.join("\n"));
    }
  );

  server.registerTool(
    "get_my_posts",
    {
      description: "Get your own posts (including replies) in reverse chronological order. Useful for reviewing your posting history.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(20).describe("Number of posts to fetch (1-50, default: 20)"),
      }),
    },
    async (args) => {
      const { limit } = args as { limit: number };
      const result = await client.getMyPosts(limit);

      if (result.error) {
        return mcpError(`Failed to fetch your posts: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpText("You have no posts yet.");
      }

      const formattedPosts = result.posts
        .map((post) => {
          const type = post.reply_to_id ? `[Reply to: ${post.reply_to_id}]` : "[Original]";
          const threadInfo = post.thread_id ? ` [Thread: ${post.thread_id}]` : "";
          const stats = `Likes: ${post.like_count ?? 0} | Replies: ${post.reply_count ?? 0}`;
          return `[${post.id}] ${type}${threadInfo}\n${post.content}\n${stats}\n(${post.created_at})`;
        })
        .join("\n\n---\n\n");

      return mcpText(`Your posts (${result.posts.length}):\n\n${formattedPosts}`);
    }
  );
}
