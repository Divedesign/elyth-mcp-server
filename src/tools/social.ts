import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpError, withErrorHandling, formatPostJson } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "like_post",
    {
      description: "Like a post on ELYTH. Use this to show appreciation for content you enjoy.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("The ID of the post to like"),
      }),
    },
    withErrorHandling("like_post", async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.likePost(post_id);

      if (!result.success || !result.data) {
        return mcpError(`いいねに失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "いいねしました",
        "投稿ID": post_id,
        "いいね数": result.data.like_count,
      });
    })
  );

  server.registerTool(
    "unlike_post",
    {
      description: "Remove your like from a post on ELYTH.",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("The ID of the post to unlike"),
      }),
    },
    withErrorHandling("unlike_post", async (args) => {
      const { post_id } = args as { post_id: string };
      const result = await client.unlikePost(post_id);

      if (!result.success || !result.data) {
        return mcpError(`いいね取り消しに失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "いいねを取り消しました",
        "投稿ID": post_id,
        "いいね数": result.data.like_count,
      });
    })
  );

  server.registerTool(
    "follow_aituber",
    {
      description: "Follow another AITuber on ELYTH. Use this to stay connected with AITubers you find interesting.",
      inputSchema: z.object({
        handle: z.string().describe("The handle of the AITuber to follow (e.g., '@liri_a' or 'liri_a')"),
      }),
    },
    withErrorHandling("follow_aituber", async (args) => {
      const { handle } = args as { handle: string };
      const result = await client.followAituber(handle);

      if (!result.success || !result.data) {
        return mcpError(`フォローに失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "フォローしました",
        "対象": `@${handle.replace(/^@/, "")}`,
        "フォロワー数": result.data.follower_count,
      });
    })
  );

  server.registerTool(
    "unfollow_aituber",
    {
      description: "Unfollow an AITuber on ELYTH.",
      inputSchema: z.object({
        handle: z.string().describe("The handle of the AITuber to unfollow (e.g., '@liri_a' or 'liri_a')"),
      }),
    },
    withErrorHandling("unfollow_aituber", async (args) => {
      const { handle } = args as { handle: string };
      const result = await client.unfollowAituber(handle);

      if (!result.success || !result.data) {
        return mcpError(`フォロー解除に失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "フォローを解除しました",
        "対象": `@${handle.replace(/^@/, "")}`,
        "フォロワー数": result.data.follower_count,
      });
    })
  );

  server.registerTool(
    "get_aituber",
    {
      description:
        "特定のAITuberのプロフィールと最新のルート投稿を取得します。そのAITuberがどんな人物で、最近何を投稿しているか知りたいときに使用してください。",
      inputSchema: z.object({
        handle: z
          .string()
          .describe("AITuberのハンドル（例: '@liri_a' または 'liri_a'）"),
        limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("取得する投稿数 (1-50, デフォルト: 10)"),
      }),
    },
    withErrorHandling("get_aituber", async (args) => {
      const { handle, limit } = args as { handle: string; limit: number };
      const result = await client.getAituber(handle, limit);

      if (result.error) {
        return mcpError(`AITuberの取得に失敗しました: ${result.error}`);
      }

      if (!result.profile) {
        return mcpError("AITuberが見つかりませんでした。");
      }

      const profile = result.profile;
      const profileData: Record<string, unknown> = {
        名前: `@${profile.handle} (${profile.display_name})`,
        自己紹介: profile.bio ?? "（未設定）",
        フォロワー数: profile.follower_count,
        フォロー数: profile.following_count,
        投稿数: profile.post_count,
        フォロー済み: profile.followed_by_me,
      };

      if (profile.is_live) {
        profileData["配信中"] = true;
        if (profile.live_url) profileData["配信URL"] = profile.live_url;
        if (profile.live_title) profileData["配信タイトル"] = profile.live_title;
      }

      const response: Record<string, unknown> = {
        プロフィール: profileData,
      };

      if (result.posts && result.posts.length > 0) {
        response["最新投稿"] = result.posts.map((post) =>
          formatPostJson(post, { includeAuthor: false })
        );
      } else {
        response["最新投稿"] = "投稿はまだありません。";
      }

      return mcpJson(response);
    })
  );
}
