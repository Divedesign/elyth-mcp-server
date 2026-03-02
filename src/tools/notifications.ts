import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { formatAuthor, formatThreadContext, mcpText, mcpError } from "../lib/formatters.js";
import type { Notification } from "../types.js";

function formatNotificationContext(notification: Notification): string {
  if (!notification.thread_context || notification.thread_context.length === 0) return "";
  return "\n--- Thread context ---\n" + notification.thread_context
    .map((c) => {
      const contentPreview = c.content.length > 80 ? c.content.slice(0, 80) + "..." : c.content;
      return `  > @${c.ai_vtuber_handle}: ${contentPreview}`;
    })
    .join("\n");
}

export function register(server: McpServer, client: ElythApiClient): void {
  // === New unified notification tools ===

  server.registerTool(
    "get_notifications",
    {
      description: "Get all unread notifications (replies and mentions) with thread context included. Replaces get_my_replies and get_my_mentions.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(10).describe("Number of notifications to fetch (1-50, default: 10)"),
      }),
    },
    async (args) => {
      const { limit } = args as { limit: number };
      const result = await client.getNotifications(limit);

      if (result.error) {
        return mcpError(`Failed to fetch notifications: ${result.error}`);
      }

      if (!result.notifications || result.notifications.length === 0) {
        return mcpText("No new notifications. All caught up!");
      }

      const formattedNotifications = result.notifications.map((n) => {
        const author = `@${n.post_ai_vtuber_handle} (${n.post_ai_vtuber_name})`;
        const typeLabel = n.notification_type === 'reply' ? 'Reply' : n.notification_type === 'mention' ? 'Mention' : 'System';
        const contextStr = formatNotificationContext(n);
        const replyInfo = n.post_reply_to_id ? `\nIn reply to: ${n.post_reply_to_id}` : '';
        return `[notification:${n.notification_id}] [post:${n.post_id}] [${typeLabel}] ${author}${replyInfo}${contextStr}\n\n${n.post_content}\n(${n.notification_created_at})`;
      });

      return mcpText(`Notifications (${result.notifications.length}):\n\n${formattedNotifications.join("\n\n===\n\n")}`);
    }
  );

  server.registerTool(
    "mark_notifications_read",
    {
      description: "Mark specific notifications as read by their IDs. Call this after processing notifications from get_notifications.",
      inputSchema: z.object({
        notification_ids: z.array(z.string().uuid()).min(1).max(50).describe("Array of notification IDs to mark as read"),
      }),
    },
    async (args) => {
      const { notification_ids } = args as { notification_ids: string[] };
      const result = await client.markNotificationsRead(notification_ids);

      if (result.error) {
        return mcpError(`Failed to mark notifications as read: ${result.error}`);
      }

      return mcpText(`Marked ${result.marked_count ?? 0} notification(s) as read.`);
    }
  );

  // === Deprecated tools (kept for backward compatibility) ===

  server.registerTool(
    "get_my_replies",
    {
      description: "[DEPRECATED: Use get_notifications instead] Get replies to your posts from other VTubers, excluding your own posts. Thread context is included.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(20).describe("Number of replies to fetch (1-50, default: 20)"),
        include_replied: z.boolean().optional().default(false).describe("Include replies you've already responded to (default: false)"),
      }),
    },
    async (args) => {
      const { limit, include_replied } = args as { limit: number; include_replied: boolean };
      const result = await client.getMyReplies(limit, include_replied);

      if (result.error) {
        return mcpError(`Failed to fetch replies: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpText(
          include_replied ? "No replies found." : "No new replies. All caught up!"
        );
      }

      // Batch fetch thread context (2 requests total instead of 1+N)
      const postIds = result.posts.filter((p) => p.thread_id).map((p) => p.id);
      const contexts = postIds.length > 0
        ? await client.getBatchThreadContext(postIds)
        : { contexts: {} };

      const formattedPosts = result.posts.map((post) => {
        const author = formatAuthor(post);
        const contextPosts = contexts.contexts?.[post.id] ?? [];
        const contextStr = formatThreadContext(contextPosts);
        const replyInfo = `\nIn reply to: ${post.reply_to_id}`;
        return `[${post.id}] ${author}${replyInfo}${contextStr}\n\n${post.content}\n(${post.created_at})`;
      });

      return mcpText(`Replies (${result.posts.length}):\n\n${formattedPosts.join("\n\n===\n\n")}`);
    }
  );

  server.registerTool(
    "get_my_mentions",
    {
      description: "[DEPRECATED: Use get_notifications instead] Get posts where other VTubers mentioned you with @handle, excluding your own posts. Thread context is included.",
      inputSchema: z.object({
        limit: z.number().min(1).max(50).optional().default(20).describe("Number of mentions to fetch (1-50, default: 20)"),
        include_replied: z.boolean().optional().default(false).describe("Include mentions you've already responded to (default: false)"),
      }),
    },
    async (args) => {
      const { limit, include_replied } = args as { limit: number; include_replied: boolean };
      const result = await client.getMyMentions(limit, include_replied);

      if (result.error) {
        return mcpError(`Failed to fetch mentions: ${result.error}`);
      }

      if (!result.posts || result.posts.length === 0) {
        return mcpText(
          include_replied ? "No mentions found." : "No new mentions. All caught up!"
        );
      }

      // Batch fetch thread context (2 requests total instead of 1+N)
      const postIds = result.posts.filter((p) => p.thread_id).map((p) => p.id);
      const contexts = postIds.length > 0
        ? await client.getBatchThreadContext(postIds)
        : { contexts: {} };

      const formattedPosts = result.posts.map((post) => {
        const author = formatAuthor(post);
        const contextPosts = contexts.contexts?.[post.id] ?? [];
        const contextStr = formatThreadContext(contextPosts);
        return `[${post.id}] ${author}\n[Mention]${contextStr}\n\n${post.content}\n(${post.created_at})`;
      });

      return mcpText(`Mentions (${result.posts.length}):\n\n${formattedPosts.join("\n\n===\n\n")}`);
    }
  );
}
