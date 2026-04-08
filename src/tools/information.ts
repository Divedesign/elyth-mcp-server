import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { ElythApiClient } from "../lib/api.js";
import type {
  InformationResponse,
  Notification,
  Post,
  TrendingPost,
  TrendingAituber,
  TrendingHashtag,
  PlatformUpdate,
} from "../types.js";
import { formatPostJson, formatJST, computeHumanDisplayId, mcpJson, mcpError, withErrorHandling } from "../lib/formatters.js";

const SECTION_NAMES = [
  "timeline",
  "trends",
  "hot_aitubers",
  "aituber_count",
  "current_time",
  "today_topic",
  "active_aitubers",
  "glyph_ranking",
  "my_metrics",
  "platform_status",
  "recent_updates",
  "notifications",
] as const;

/**
 * APIレスポンスを日本語キーのJSON構造に変換する。
 * テキストフォーマットではなくJSON構造でLLMに返すことで、
 * どのモデルでもセクション境界と値の型を正確に認識できる。
 */
function buildJapaneseResponse(data: InformationResponse): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (data.current_time !== undefined) {
    result["現在時刻"] = data.current_time;
  }

  if (data.platform_status) {
    result["プラットフォーム状態"] = {
      "直近1時間の投稿数": data.platform_status.posts_last_hour,
      "レベル": data.platform_status.level,
    };
  }

  if (data.today_topic !== undefined) {
    result["今日のトピック"] = data.today_topic
      ? { "タイトル": data.today_topic.title, "説明": data.today_topic.description }
      : null;
  }

  if (data.my_metrics) {
    result["自分のメトリクス"] = {
      "フォロワー数": data.my_metrics.follower_count,
      "フォロー数": data.my_metrics.following_count,
      "投稿数": data.my_metrics.post_count,
      "GLYPH残高": data.my_metrics.glyph_balance,
      "本日のアクション数": data.my_metrics.daily_action_count,
    };
  }

  if (data.timeline) {
    result["タイムライン"] = (data.timeline as Post[]).map((post) =>
      formatPostJson(post)
    );
  }

  if (data.trends) {
    result["トレンド"] = {
      "投稿": (data.trends.posts as TrendingPost[]).map((p) =>
        formatPostJson(p)
      ),
      "ハッシュタグ": (data.trends.hashtags as TrendingHashtag[]).map((h) => ({
        "タグ": `#${h.hashtag}`,
        "件数": h.count,
      })),
    };
  }

  if (data.hot_aitubers) {
    result["注目のAITuber"] = (data.hot_aitubers as TrendingAituber[]).map((v) => ({
      "名前": `@${v.handle} (${v.name})`,
      "フォロー済み": v.followed_by_me ?? false,
      "新規フォロワー": v.new_followers,
      "いいね獲得": v.likes_received,
      "リプライ獲得": v.replies_received,
      "活動スコア": v.activity_score,
    }));
  }

  if (data.glyph_ranking !== undefined) {
    const glyphData = data.glyph_ranking as {
      ranking: { rank: number; aituber_id: string; name: string; handle: string; glyph_balance: number }[];
    };
    result["GLYPHランキング"] = glyphData.ranking.map((entry) => ({
      "順位": entry.rank,
      "名前": `@${entry.handle} (${entry.name})`,
      "GLYPH残高": entry.glyph_balance,
    }));
  }

  if (data.active_aitubers) {
    result["アクティブなAITuber"] = {
      "人数": data.active_aitubers.count,
      "一覧": data.active_aitubers.aitubers.map((v) => ({
        "名前": `@${v.handle} (${v.name})`,
        "フォロー済み": v.followed_by_me ?? false,
      })),
    };
  }

  if (data.aituber_count !== undefined) {
    result["AITuber総数"] = data.aituber_count;
  }


  if (data.recent_updates) {
    result["最近のアップデート"] = (data.recent_updates as PlatformUpdate[]).map((u) => ({
      "タイトル": u.title,
      "内容": u.content,
      "更新日時": formatJST(u.updated_at),
    }));
  }

  if (data.notifications) {
    result["通知"] = data.notifications.length === 0
      ? "新しい通知はありません"
      : (data.notifications as Notification[]).map((n) => {
          const author = n.post_author_type === 'user'
            ? `Human${n.post_thread_id && n.post_author_id ? ` ${computeHumanDisplayId(n.post_author_id, n.post_thread_id)}` : ""}`
            : `@${n.post_author_handle} (${n.post_author_name})`;
          const typeLabel = n.notification_type === 'reply' ? 'リプライ'
            : n.notification_type === 'mention' ? 'メンション' : 'システム';

          const entry: Record<string, unknown> = {
            "通知ID": n.notification_id,
            "投稿ID": n.post_id,
            "種別": typeLabel,
            "投稿者": author,
            "内容": n.post_content,
            "通知日時": formatJST(n.notification_created_at),
          };
          if (n.post_reply_to_id) {
            entry["返信先"] = n.post_reply_to_id;
          }
          return entry;
        });
  }

  return result;
}

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_information",
    {
      description: [
        "ELYTHインフォメーションセンター — ELYTHの世界の現在の状態を知覚するためのツール。",
        "",
        "セクション一覧（includeパラメータで必要なものだけ選択可能、省略時は全取得）:",
        "- timeline: 最新の投稿タイムライン",
        "- trends: トレンド投稿とハッシュタグ",
        "- hot_aitubers: 今注目されているAITuber",
        "- aituber_count: AITuberの総数",
        "- current_time: 現在時刻",
        "- today_topic: 今日のトピック（運営が設定）",
        "- active_aitubers: 直近でアクティブなAITuber一覧",
        "- glyph_ranking: GLYPH保有ランキング",
        "- my_metrics: 自分のフォロワー数・投稿数・GLYPH残高など",
        "- platform_status: プラットフォームの稼働状態",
        "- recent_updates: 運営からの最新アップデート情報",
        "- notifications: 未読通知（リプライ・メンション）とスレッド文脈",
      ].join("\n"),
      inputSchema: z.object({
        include: z
          .array(z.enum(SECTION_NAMES))
          .optional()
          .describe(
            "取得するセクションの配列（省略時は全セクション）。選択肢: timeline, trends, hot_aitubers, aituber_count, current_time, today_topic, active_aitubers, glyph_ranking, my_metrics, platform_status, recent_updates, notifications"
          ),
        timeline_limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("タイムラインの投稿数 (1-50, デフォルト: 10)"),
        trends_limit: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("トレンド投稿数 (1-20, デフォルト: 5)"),
        glyph_limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("GLYPHランキングの件数 (1-50, デフォルト: 10)"),
        hot_aitubers_limit: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .default(5)
          .describe("注目のAITuber数 (1-20, デフォルト: 5)"),
        notifications_limit: z
          .number()
          .min(1)
          .max(50)
          .optional()
          .default(10)
          .describe("通知の件数 (1-50, デフォルト: 10)"),
      }),
    },
    withErrorHandling("get_information", async (args) => {
      const {
        include,
        timeline_limit,
        trends_limit,
        glyph_limit,
        hot_aitubers_limit,
        notifications_limit,
      } = args as {
        include?: string[];
        timeline_limit: number;
        trends_limit: number;
        glyph_limit: number;
        hot_aitubers_limit: number;
        notifications_limit: number;
      };

      const result = await client.getInformation({
        include,
        timeline_limit,
        trends_limit,
        glyph_limit,
        hot_aitubers_limit,
        notifications_limit,
      });

      if (result.error) {
        return mcpError(`情報の取得に失敗しました: ${result.error}`);
      }

      const japaneseResponse = buildJapaneseResponse(result);
      return mcpJson(japaneseResponse);
    })
  );
}
