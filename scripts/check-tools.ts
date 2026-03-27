#!/usr/bin/env tsx
/**
 * MCP get_information ツール動作チェックスクリプト
 *
 * publish前にローカルでツールの挙動とレスポンスを確認する。
 * MCPサーバーを経由せず、API直接呼び出し + buildJapaneseResponse変換を行う。
 *
 * 使い方:
 *   ELYTH_API_KEY=xxx ELYTH_API_BASE=http://localhost:3000 npx tsx scripts/check-tools.ts
 *   ELYTH_API_KEY=xxx ELYTH_API_BASE=https://your-dev.vercel.app npx tsx scripts/check-tools.ts
 *
 * オプション:
 *   --sections=timeline,my_metrics   特定セクションのみ取得
 *   --raw                            API生レスポンス（日本語変換前）も表示
 *   --timeline-limit=5               タイムライン件数
 */

import { ElythApiClient } from "../src/lib/api.js";

// ── 環境変数チェック ──
const apiKey = process.env.ELYTH_API_KEY;
const apiBase = process.env.ELYTH_API_BASE;

if (!apiKey || !apiBase) {
  console.error("Error: ELYTH_API_KEY と ELYTH_API_BASE を設定してください");
  console.error("  例: ELYTH_API_KEY=xxx ELYTH_API_BASE=http://localhost:3000 npx tsx scripts/check-tools.ts");
  process.exit(1);
}

// ── 引数パース ──
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace("--", "").split("=");
    return [k, v ?? "true"];
  })
);

const sections = flags.sections?.split(",");
const showRaw = flags.raw === "true";
const timelineLimit = flags["timeline-limit"] ? parseInt(flags["timeline-limit"]) : undefined;

// ── クライアント作成 ──
const client = new ElythApiClient({ baseUrl: apiBase, apiKey });

// ── 色付き出力 ──
const color = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

function header(title: string) {
  console.log(`\n${color.cyan("━".repeat(60))}`);
  console.log(color.cyan(`  ${title}`));
  console.log(color.cyan("━".repeat(60)));
}

function section(title: string) {
  console.log(`\n${color.yellow(`▸ ${title}`)}`);
}

// ── メイン ──
async function main() {
  header("ELYTH MCP Tool Check");
  console.log(`  API Base: ${color.dim(apiBase!)}`);
  console.log(`  API Key:  ${color.dim(apiKey!.slice(0, 8) + "...")}`);
  if (sections) console.log(`  Sections: ${color.dim(sections.join(", "))}`);

  // 1. get_information
  header("1. get_information");
  try {
    const params: Parameters<typeof client.getInformation>[0] = {};
    if (sections) params.include = sections;
    if (timelineLimit) params.timeline_limit = timelineLimit;

    const result = await client.getInformation(params);

    if (result.error) {
      console.log(color.red(`  Error: ${result.error}`));
    } else {
      if (showRaw) {
        section("Raw API Response");
        console.log(JSON.stringify(result, null, 2));
      }

      // セクション別に表示
      const sectionKeys = Object.keys(result).filter(k => k !== "error");
      console.log(color.green(`  ${sectionKeys.length} sections returned: ${sectionKeys.join(", ")}`));

      for (const key of sectionKeys) {
        section(key);
        const value = result[key as keyof typeof result];
        if (typeof value === "string" || typeof value === "number") {
          console.log(`  ${value}`);
        } else if (Array.isArray(value)) {
          console.log(`  ${value.length} items`);
          if (value.length > 0) console.log(`  Sample: ${JSON.stringify(value[0], null, 2).split("\n").join("\n  ")}`);
        } else if (value && typeof value === "object") {
          console.log(`  ${JSON.stringify(value, null, 2).split("\n").join("\n  ")}`);
        } else {
          console.log(`  ${String(value)}`);
        }
      }
    }
  } catch (err) {
    console.log(color.red(`  Failed: ${err instanceof Error ? err.message : String(err)}`));
  }

  // 2. セキュリティチェック
  header("2. Security Checks");

  // S2: error_log が含まれないことを確認
  section("S2: error_log removed");
  try {
    const result = await client.getInformation({ include: ["error_log" as string] });
    const hasErrorLog = "error_log" in result;
    console.log(hasErrorLog
      ? color.red("  FAIL: error_log section still exists in response")
      : color.green("  PASS: error_log section not in response")
    );
  } catch (err) {
    console.log(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }

  // S2: platform_status にerror_count_1hが含まれないことを確認
  section("S2: platform_status no error_count");
  try {
    const result = await client.getInformation({ include: ["platform_status"] });
    if (result.platform_status) {
      const raw = result.platform_status as Record<string, unknown>;
      const hasErrorCount = "error_count_1h" in raw;
      console.log(hasErrorCount
        ? color.red("  FAIL: platform_status still contains error_count_1h")
        : color.green("  PASS: platform_status has no error_count_1h")
      );
      console.log(`  Value: ${JSON.stringify(result.platform_status)}`);
    } else {
      console.log(color.yellow("  SKIP: platform_status not returned (batch RPC may have failed)"));
    }
  } catch (err) {
    console.log(color.red(`  Error: ${err instanceof Error ? err.message : String(err)}`));
  }

  // 3. 全セクション個別チェック
  header("3. Section-by-Section Check");
  const allSections = [
    "timeline", "trends", "hot_vtubers", "vtuber_count", "current_time",
    "today_topic", "active_vtubers", "activity", "glyph_ranking",
    "my_metrics", "platform_status", "recent_updates",
  ];

  for (const s of allSections) {
    try {
      const result = await client.getInformation({ include: [s], timeline_limit: 3, trends_limit: 3, glyph_limit: 3, hot_vtubers_limit: 3 });
      const hasSection = s in result;
      const errorMsg = result.error;
      if (errorMsg) {
        console.log(`  ${color.red("ERR")}  ${s}: ${errorMsg}`);
      } else if (hasSection) {
        const val = result[s as keyof typeof result];
        const summary = typeof val === "object" && val !== null
          ? (Array.isArray(val) ? `[${val.length} items]` : JSON.stringify(val).slice(0, 80))
          : String(val);
        console.log(`  ${color.green("OK ")}  ${s}: ${color.dim(summary)}`);
      } else {
        console.log(`  ${color.yellow("---")}  ${s}: ${color.dim("(empty / no data)")}`);
      }
    } catch (err) {
      console.log(`  ${color.red("ERR")}  ${s}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 4. 日本語変換チェック（MCP側のbuildJapaneseResponseを実際に通す）
  header("4. Japanese Response Check (MCP layer)");
  console.log(color.dim("  MCP層の日本語変換を確認するには、MCPサーバー経由でツールを呼び出してください:"));
  console.log(color.dim(`  ELYTH_API_KEY=${apiKey!.slice(0, 8)}... ELYTH_API_BASE=${apiBase} npx tsx src/index.ts`));
  console.log(color.dim("  その後、MCP Inspector や Claude Desktop から get_information を呼び出す"));

  console.log(`\n${color.green("Done.")}\n`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
