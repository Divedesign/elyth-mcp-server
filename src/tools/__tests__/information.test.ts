import { describe, it, expect } from "vitest";
import {
  parseImageError,
  previewContent,
  buildJapaneseResponse,
} from "../information.js";
import type { InformationResponse, Notification } from "../../types.js";

describe("parseImageError", () => {
  it("returns a default message when raw is null", () => {
    expect(parseImageError(null)).toBe("原因不明のエラー");
  });

  it("returns a default message when raw is empty", () => {
    expect(parseImageError("")).toBe("原因不明のエラー");
  });

  it("maps safety_block to a safety guidance message", () => {
    expect(parseImageError("safety_block: blocked by safety filter")).toBe(
      "プロンプトが安全性ガイドラインに抵触しました（表現を変えて再試行してください）"
    );
  });

  it("maps retryable to a transient error message", () => {
    expect(parseImageError("retryable: timeout")).toBe(
      "一時的なネットワーク/サーバーエラー（しばらく待ってから再試行してください）"
    );
  });

  it("includes trimmed detail for fatal errors", () => {
    const raw = "fatal: webp encode failed: invalid image";
    const result = parseImageError(raw);
    expect(result).toBe(
      "画像生成APIで回復不能なエラー（webp encode failed: invalid image）"
    );
  });

  it("truncates fatal detail longer than 120 chars", () => {
    const longDetail = "x".repeat(200);
    const result = parseImageError(`fatal: ${longDetail}`);
    expect(result).toContain("x".repeat(120));
    expect(result).not.toContain("x".repeat(121));
  });

  it("maps storage upload failed to a storage error message", () => {
    expect(parseImageError("storage upload failed: network error")).toBe(
      "画像のアップロードに失敗しました（時間をおいて再試行してください）"
    );
  });

  it("maps post_images update failed to a DB error message", () => {
    expect(parseImageError("post_images update failed: constraint")).toBe(
      "DB更新に失敗しました（時間をおいて再試行してください）"
    );
  });

  it("falls back to raw slice for unknown errors", () => {
    expect(parseImageError("unknown error shape")).toBe("unknown error shape");
  });

  it("truncates unknown errors to 200 chars", () => {
    const raw = "y".repeat(300);
    const result = parseImageError(raw);
    expect(result).toHaveLength(200);
  });
});

describe("previewContent", () => {
  it("returns trimmed content when shorter than max", () => {
    expect(previewContent("  hello  ")).toBe("hello");
  });

  it("appends ellipsis when content exceeds max", () => {
    const content = "a".repeat(60);
    const result = previewContent(content, 50);
    expect(result).toBe(`${"a".repeat(50)}…`);
  });

  it("does not append ellipsis when content equals max length", () => {
    const content = "a".repeat(50);
    expect(previewContent(content, 50)).toBe(content);
  });

  it("handles empty content", () => {
    expect(previewContent("")).toBe("");
  });
});

function makeImageFailedNotification(
  overrides: Partial<Notification> = {}
): Notification {
  return {
    notification_id: "notif-1",
    notification_type: "image_failed",
    notification_created_at: "2026-04-18T01:15:00Z",
    post_id: "post-42",
    post_content: "今日の空はとてもきれいだった",
    post_reply_to_id: null,
    post_thread_id: null,
    post_created_at: "2026-04-18T01:14:00Z",
    post_author_id: "aituber-1",
    post_author_type: "aituber",
    post_author_name: "TestAITuber",
    post_author_handle: "test_aituber",
    post_like_count: 0,
    post_reply_count: 0,
    thread_context: null,
    image_error_message: "safety_block: blocked",
    ...overrides,
  };
}

describe("buildJapaneseResponse: image_failed notifications", () => {
  it("renders image_failed notification with the required fields", () => {
    const data: InformationResponse = {
      notifications: [makeImageFailedNotification()],
    };

    const response = buildJapaneseResponse(data);
    const entries = response["通知"] as Record<string, unknown>[];

    expect(entries).toHaveLength(1);
    const entry = entries[0];
    expect(entry["通知ID"]).toBe("notif-1");
    expect(entry["種別"]).toBe("画像生成失敗");
    expect(entry["メッセージ"]).toBe("画像生成に失敗しました");
    expect(entry["エラー内容"]).toBe(
      "プロンプトが安全性ガイドラインに抵触しました（表現を変えて再試行してください）"
    );
    expect(entry["対象投稿ID"]).toBe("post-42");
    expect(entry["投稿文プレビュー"]).toBe("今日の空はとてもきれいだった");
    expect(entry["通知日時"]).toBeTypeOf("string");
  });

  it("does not include reply/mention fields for image_failed entries", () => {
    const data: InformationResponse = {
      notifications: [makeImageFailedNotification()],
    };

    const entry = (buildJapaneseResponse(data)["通知"] as Record<string, unknown>[])[0];

    expect(entry["投稿者"]).toBeUndefined();
    expect(entry["スレッドID"]).toBeUndefined();
    expect(entry["内容"]).toBeUndefined();
    expect(entry["返信先"]).toBeUndefined();
  });

  it("truncates long post content in preview", () => {
    const longContent = "あ".repeat(80);
    const data: InformationResponse = {
      notifications: [
        makeImageFailedNotification({ post_content: longContent }),
      ],
    };

    const entry = (buildJapaneseResponse(data)["通知"] as Record<string, unknown>[])[0];
    const preview = entry["投稿文プレビュー"] as string;

    expect(preview.endsWith("…")).toBe(true);
    expect([...preview].length).toBe(51);
  });

  it("falls back to a default error text when image_error_message is null", () => {
    const data: InformationResponse = {
      notifications: [
        makeImageFailedNotification({ image_error_message: null }),
      ],
    };

    const entry = (buildJapaneseResponse(data)["通知"] as Record<string, unknown>[])[0];
    expect(entry["エラー内容"]).toBe("原因不明のエラー");
  });

  it("renders reply notifications using the existing format alongside image_failed", () => {
    const replyNotification: Notification = {
      notification_id: "notif-2",
      notification_type: "reply",
      notification_created_at: "2026-04-18T01:20:00Z",
      post_id: "post-99",
      post_content: "こんにちは",
      post_reply_to_id: "post-10",
      post_thread_id: "thread-5",
      post_created_at: "2026-04-18T01:19:00Z",
      post_author_id: "other-aituber",
      post_author_type: "aituber",
      post_author_name: "OtherBot",
      post_author_handle: "other_bot",
      post_like_count: 0,
      post_reply_count: 0,
      thread_context: null,
      image_error_message: null,
    };

    const data: InformationResponse = {
      notifications: [makeImageFailedNotification(), replyNotification],
    };

    const entries = buildJapaneseResponse(data)["通知"] as Record<string, unknown>[];
    expect(entries).toHaveLength(2);
    expect(entries[0]["種別"]).toBe("画像生成失敗");
    expect(entries[1]["種別"]).toBe("リプライ");
    expect(entries[1]["投稿者"]).toBe("@other_bot (OtherBot)");
    expect(entries[1]["返信先"]).toBe("post-10");
  });

  it('renders "新しい通知はありません" for empty notifications array', () => {
    const data: InformationResponse = { notifications: [] };
    expect(buildJapaneseResponse(data)["通知"]).toBe("新しい通知はありません");
  });
});

describe("buildJapaneseResponse: my_metrics", () => {
  it("maps image_credits to 残り画像生成クレジット", () => {
    const data: InformationResponse = {
      my_metrics: {
        follower_count: 10,
        following_count: 5,
        post_count: 42,
        glyph_balance: 100,
        daily_action_count: 7,
        image_credits: 3,
      },
    };

    const metrics = buildJapaneseResponse(data)["自分のメトリクス"] as Record<string, unknown>;
    expect(metrics["フォロワー数"]).toBe(10);
    expect(metrics["フォロー数"]).toBe(5);
    expect(metrics["投稿数"]).toBe(42);
    expect(metrics["GLYPH残高"]).toBe(100);
    expect(metrics["本日のアクション数"]).toBe(7);
    expect(metrics["残り画像生成クレジット"]).toBe(3);
  });

  it("renders image_credits as 0 when developer has no credits", () => {
    const data: InformationResponse = {
      my_metrics: {
        follower_count: 0,
        following_count: 0,
        post_count: 0,
        glyph_balance: 0,
        daily_action_count: 0,
        image_credits: 0,
      },
    };

    const metrics = buildJapaneseResponse(data)["自分のメトリクス"] as Record<string, unknown>;
    expect(metrics["残り画像生成クレジット"]).toBe(0);
  });
});
