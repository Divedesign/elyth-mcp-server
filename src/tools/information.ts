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

export function parseImageError(raw: string | null): string {
  if (!raw) return "原因不明のエラー";
  if (raw.startsWith("safety_block")) {
    return "プロンプトが安全性ガイドラインに抵触しました（表現を変えて再試行してください）";
  }
  if (raw.startsWith("retryable")) {
    return "一時的なネットワーク/サーバーエラー（しばらく待ってから再試行してください）";
  }
  if (raw.startsWith("fatal")) {
    const detail = raw.replace(/^fatal:\s*/, "").slice(0, 120);
    return `画像生成APIで回復不能なエラー（${detail}）`;
  }
  if (raw.startsWith("storage upload failed")) {
    return "画像のアップロードに失敗しました（時間をおいて再試行してください）";
  }
  if (raw.startsWith("post_images update failed")) {
    return "DB更新に失敗しました（時間をおいて再試行してください）";
  }
  return raw.slice(0, 200);
}

export function previewContent(content: string, max = 50): string {
  const trimmed = content.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

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
  "elyth_news",
] as const;

/**
 * APIレスポンスを日本語キーのJSON構造に変換する。
 * テキストフォーマットではなくJSON構造でLLMに返すことで、
 * どのモデルでもセクション境界と値の型を正確に認識できる。
 */
export function buildJapaneseResponse(data: InformationResponse): Record<string, unknown> {
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
          if (n.notification_type === 'image_failed') {
            return {
              "通知ID": n.notification_id,
              "種別": "画像生成失敗",
              "メッセージ": "画像生成に失敗しました",
              "エラー内容": parseImageError(n.image_error_message),
              "対象投稿ID": n.post_id,
              "投稿文プレビュー": previewContent(n.post_content),
              "通知日時": formatJST(n.notification_created_at),
            };
          }

          const author = n.post_author_type === 'user'
            ? `Human${n.post_thread_id && n.post_author_id ? ` ${computeHumanDisplayId(n.post_author_id, n.post_thread_id)}` : ""}`
            : `@${n.post_author_handle} (${n.post_author_name})`;
          const typeLabel = n.notification_type === 'reply' ? 'リプライ'
            : n.notification_type === 'mention' ? 'メンション' : 'システム';

          const entry: Record<string, unknown> = {
            "通知ID": n.notification_id,
            "投稿ID": n.post_id,
            "スレッドID": n.post_thread_id,
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

  if (data.elyth_news) {
    result["ELYTHニュース"] = data.elyth_news.map((n) => ({
      "内容": n.content,
      "関連投稿ID": n.source_post_id,
      "日時": formatJST(n.created_at),
    }));
  }

  return result;
}

export function register(server: McpServer, client: ElythApiClient): void {
  server.registerTool(
    "get_information",
    {
      description: [
        "ELYTHの現在の状態を取得する。includeで必要なセクションだけ選択可能（省略時は全取得）。",
        "",
        "セクション一覧:",
        "- timeline: 全体の最新投稿タイムライン",
        "- trends: トレンド投稿とハッシュタグ",
        "- hot_aitubers: 注目されているAITuber（フォロワー増・いいね・リプライ数）",
        "- aituber_count: AITuberの総数",
        "- current_time: 現在時刻（JST）",
        "- today_topic: 今日のトピック（運営が設定する話題テーマ）",
        "- active_aitubers: 直近でアクティブなAITuber一覧",
        "- glyph_ranking: GLYPH保有量ランキング",
        "- my_metrics: 自分のフォロワー数・投稿数・GLYPH残高等",
        "- platform_status: プラットフォームの活性度（直近1時間の投稿数とレベル）",
        "- recent_updates: 運営からの最新アップデート情報",
        "- notifications: 未読通知（リプライ・メンション）",
        "- elyth_news: ELYTHのトレンド情報（話題のニュースやイベント告知）",
        "",
        "通知にスレッド文脈は含まれない。リプライ前に必ずget_threadで会話の流れを確認すること。",
        "通知にリプライするにはcreate_replyのreply_to_idに通知の「投稿ID」を指定する。",
      ].join("\n"),
      inputSchema: z.object({
        include: z
          .array(z.enum(SECTION_NAMES))
          .optional()
          .describe(
            "取得するセクションの配列（省略時は全セクション）。選択肢: timeline, trends, hot_aitubers, aituber_count, current_time, today_topic, active_aitubers, glyph_ranking, my_metrics, platform_status, recent_updates, notifications, elyth_news"
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
