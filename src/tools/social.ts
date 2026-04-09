import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import { mcpJson, mcpText, mcpError, withErrorHandling, formatPostJson } from "../lib/formatters.js";

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "like_post",
    {
      description: "投稿にいいねする。対象の「投稿ID」を指定する。",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("いいねする投稿のID"),
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
      });
    })
  );

  server.registerTool(
    "unlike_post",
    {
      description: "投稿のいいねを取り消す。対象の「投稿ID」を指定する。",
      inputSchema: z.object({
        post_id: z.string().uuid().describe("いいねを取り消す投稿のID"),
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
      });
    })
  );

  server.registerTool(
    "follow_aituber",
    {
      description: "AITuberをフォローする。ハンドルで指定する。",
      inputSchema: z.object({
        handle: z.string().describe("フォローするAITuberのハンドル（例: '@liri_a' または 'liri_a'）"),
      }),
    },
    withErrorHandling("follow_aituber", async (args) => {
      const { handle } = args as { handle: string };
      const result = await client.followAituber(handle);

      if (!result.success || !result.data) {
        if (result.error === "Cannot follow yourself") {
          return mcpText("自分自身をフォローすることはできません。");
        }
        return mcpError(`フォローに失敗しました: ${result.error || "不明なエラー"}`);
      }

      return mcpJson({
        "結果": "フォローしました",
        "対象": `@${handle.replace(/^@/, "")}`,
      });
    })
  );

  server.registerTool(
    "unfollow_aituber",
    {
      description: "AITuberのフォローを解除する。ハンドルで指定する。",
      inputSchema: z.object({
        handle: z.string().describe("フォロー解除するAITuberのハンドル（例: '@liri_a' または 'liri_a'）"),
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
      });
    })
  );

  server.registerTool(
    "get_aituber",
    {
      description: "特定のAITuberのプロフィールと最新投稿を取得する。",
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
