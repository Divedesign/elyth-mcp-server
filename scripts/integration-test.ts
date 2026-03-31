#!/usr/bin/env tsx
/**
 * MCP 全ツール統合テストスクリプト
 *
 * 開発環境（ローカルホスト）でMCPの全APIエンドポイントを
 * 実際のHTTPリクエストで検証する。正常系・異常系（二重いいね等）を含む。
 *
 * 使い方:
 *   ELYTH_API_KEY=elyth_xxx ELYTH_API_BASE=http://localhost:3000 npx tsx scripts/integration-test.ts
 *
 * オプション:
 *   --category=auth         特定カテゴリのみ実行
 *   --verbose               失敗時にレスポンスボディ全体を表示
 */

// ── 色付き出力 ──
const c = {
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

// ── 引数パース ──
const args = process.argv.slice(2);
const flags = Object.fromEntries(
  args.filter(a => a.startsWith("--")).map(a => {
    const [k, v] = a.replace("--", "").split("=");
    return [k, v ?? "true"];
  })
);
const onlyCategory = flags.category;
const verbose = flags.verbose === "true";

// ── 環境変数 ──
const apiKey = process.env.ELYTH_API_KEY;
const baseUrl = process.env.ELYTH_API_BASE ?? "http://localhost:3000";

if (!apiKey) {
  console.error(c.red("Error: ELYTH_API_KEY を設定してください"));
  console.error("  例: ELYTH_API_KEY=elyth_xxx ELYTH_API_BASE=http://localhost:3000 npx tsx scripts/integration-test.ts");
  process.exit(1);
}

// ── HTTPクライアント ──
interface HttpResult {
  status: number;
  body: Record<string, unknown>;
  headers: Headers;
}

async function request(
  method: string,
  path: string,
  options?: { body?: unknown; omitAuth?: boolean; customApiKey?: string },
): Promise<HttpResult> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!options?.omitAuth) {
    headers["x-api-key"] = options?.customApiKey ?? apiKey!;
  }

  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    body = { _raw: await res.text() };
  }

  return { status: res.status, body, headers: res.headers };
}

// ── テストランナー ──
interface TestResult {
  name: string;
  category: string;
  status: "pass" | "fail" | "skip";
  duration: number;
  error?: string;
  responseBody?: unknown;
}

const results: TestResult[] = [];

class AssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssertionError";
  }
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new AssertionError(message);
}

function assertStatus(res: HttpResult, expected: number) {
  assert(res.status === expected, `Expected status ${expected}, got ${res.status}`);
}

function assertBodyKey(body: Record<string, unknown>, key: string) {
  assert(key in body, `Expected body to contain "${key}"`);
}

async function test(
  name: string,
  category: string,
  fn: () => Promise<void>,
): Promise<TestResult> {
  if (onlyCategory && category !== onlyCategory) {
    const r: TestResult = { name, category, status: "skip", duration: 0 };
    results.push(r);
    return r;
  }

  const start = performance.now();
  let result: TestResult;
  try {
    await fn();
    const duration = performance.now() - start;
    result = { name, category, status: "pass", duration };
    console.log(`  ${c.green("PASS")}  ${name} ${c.dim(`(${duration.toFixed(0)}ms)`)}`);
  } catch (err) {
    const duration = performance.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    result = { name, category, status: "fail", duration, error };
    console.log(`  ${c.red("FAIL")}  ${name}`);
    console.log(`        ${c.red(error)}`);
  }
  results.push(result);
  return result;
}

function skip(name: string, category: string, reason: string): TestResult {
  const r: TestResult = { name, category, status: "skip", duration: 0, error: reason };
  results.push(r);
  console.log(`  ${c.yellow("SKIP")}  ${name} ${c.dim(`— ${reason}`)}`);
  return r;
}

function header(title: string) {
  console.log(`\n${c.cyan("━".repeat(60))}`);
  console.log(c.cyan(`  ${title}`));
  console.log(c.cyan("━".repeat(60)));
}

// ── 共有コンテキスト ──
interface TestContext {
  createdPostId?: string;
  createdReplyId?: string;
  followTargetHandle?: string;
  selfHandle?: string;
  notificationId?: string;
}

const ctx: TestContext = {};

// ── テストスイート ──

// 1. 認証
async function authTests() {
  header("1. 認証 (Auth)");

  await test("APIキーなし → 401", "auth", async () => {
    const res = await request("GET", "/api/mcp/posts", { omitAuth: true });
    assertStatus(res, 401);
  });

  await test("無効APIキー → 401", "auth", async () => {
    const res = await request("GET", "/api/mcp/posts", { customApiKey: "invalid_key_12345" });
    assertStatus(res, 401);
  });

  await test("正常APIキー → 200", "auth", async () => {
    const res = await request("GET", "/api/mcp/posts?limit=1");
    assertStatus(res, 200);
    assertBodyKey(res.body, "posts");
  });
}

// 2. 投稿
async function postTests() {
  header("2. 投稿 (Posts)");

  const ts = Date.now();

  await test("投稿作成 → 200", "posts", async () => {
    const res = await request("POST", "/api/mcp/posts", {
      body: { content: `[MCP-TEST] Integration test post ${ts}` },
    });
    assertStatus(res, 200);
    assert(res.body.success === true, "Expected success: true");
    const post = res.body.post as Record<string, unknown> | undefined;
    assert(!!post?.id, "Expected post.id");
    ctx.createdPostId = post!.id as string;
  });

  await test("投稿作成 — 空content → 400", "posts", async () => {
    const res = await request("POST", "/api/mcp/posts", {
      body: { content: "" },
    });
    assertStatus(res, 400);
  });

  await test("投稿作成 — contentなし → 400", "posts", async () => {
    const res = await request("POST", "/api/mcp/posts", {
      body: {},
    });
    assertStatus(res, 400);
  });

  await test("投稿作成 — 501文字 → 400", "posts", async () => {
    const res = await request("POST", "/api/mcp/posts", {
      body: { content: "あ".repeat(501) },
    });
    assertStatus(res, 400);
  });

  if (ctx.createdPostId) {
    await test("単一投稿取得 → 200", "posts", async () => {
      const res = await request("GET", `/api/mcp/posts/${ctx.createdPostId}`);
      assertStatus(res, 200);
      assertBodyKey(res.body, "posts");
    });
  } else {
    skip("単一投稿取得 → 200", "posts", "投稿作成が未完了");
  }

  await test("単一投稿取得 — 不正UUID → 400", "posts", async () => {
    const res = await request("GET", "/api/mcp/posts/not-a-uuid");
    assertStatus(res, 400);
  });

  await test("単一投稿取得 — 存在しないUUID → 404", "posts", async () => {
    const res = await request("GET", "/api/mcp/posts/00000000-0000-0000-0000-000000000000");
    assertStatus(res, 404);
  });

  await test("タイムライン取得 → 200", "posts", async () => {
    const res = await request("GET", "/api/mcp/posts?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "posts");
    assert(Array.isArray(res.body.posts), "Expected posts to be an array");
  });

  await test("自分の投稿取得 → 200", "posts", async () => {
    const res = await request("GET", "/api/mcp/posts/mine?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "posts");
  });

  if (ctx.createdPostId) {
    await test("リプライ作成 → 200", "posts", async () => {
      const res = await request("POST", "/api/mcp/posts", {
        body: {
          content: `[MCP-TEST] Reply test ${ts}`,
          reply_to_id: ctx.createdPostId,
        },
      });
      assertStatus(res, 200);
      assert(res.body.success === true, "Expected success: true");
      const post = res.body.post as Record<string, unknown> | undefined;
      assert(!!post?.id, "Expected post.id");
      ctx.createdReplyId = post!.id as string;
    });
  } else {
    skip("リプライ作成 → 200", "posts", "投稿作成が未完了");
  }
}

// 3. いいね
async function likeTests() {
  header("3. いいね (Likes)");

  if (!ctx.createdPostId) {
    skip("いいね系テスト全体", "likes", "投稿作成が未完了");
    return;
  }

  await test("いいね → 200", "likes", async () => {
    const res = await request("POST", `/api/mcp/posts/${ctx.createdPostId}/like`);
    assertStatus(res, 200);
    assert(res.body.success === true, "Expected success: true");
    const data = res.body.data as Record<string, unknown>;
    assert(data.liked === true, "Expected data.liked: true");
  });

  await test("二重いいね → 409", "likes", async () => {
    const res = await request("POST", `/api/mcp/posts/${ctx.createdPostId}/like`);
    assertStatus(res, 409);
    assert(res.body.error === "Already liked", `Expected "Already liked", got "${res.body.error}"`);
  });

  await test("いいね解除 → 200", "likes", async () => {
    const res = await request("DELETE", `/api/mcp/posts/${ctx.createdPostId}/like`);
    assertStatus(res, 200);
    assert(res.body.success === true, "Expected success: true");
    const data = res.body.data as Record<string, unknown>;
    assert(data.liked === false, "Expected data.liked: false");
  });

  await test("未いいねの解除（冪等）→ 200", "likes", async () => {
    const res = await request("DELETE", `/api/mcp/posts/${ctx.createdPostId}/like`);
    assertStatus(res, 200);
  });

  await test("存在しない投稿にいいね → 404", "likes", async () => {
    const res = await request("POST", "/api/mcp/posts/00000000-0000-0000-0000-000000000000/like");
    assertStatus(res, 404);
  });
}

// 4. スレッド
async function threadTests() {
  header("4. スレッド (Thread)");

  if (ctx.createdReplyId) {
    await test("リプライのスレッド取得 → 200 (2件以上)", "thread", async () => {
      const res = await request("GET", `/api/mcp/posts/${ctx.createdReplyId}/thread`);
      assertStatus(res, 200);
      assertBodyKey(res.body, "posts");
      const posts = res.body.posts as unknown[];
      assert(posts.length >= 2, `Expected >= 2 posts in thread, got ${posts.length}`);
    });
  } else {
    skip("リプライのスレッド取得", "thread", "リプライ作成が未完了");
  }

  if (ctx.createdPostId) {
    await test("ルートのスレッド取得 → 200", "thread", async () => {
      const res = await request("GET", `/api/mcp/posts/${ctx.createdPostId}/thread`);
      assertStatus(res, 200);
      assertBodyKey(res.body, "posts");
    });
  } else {
    skip("ルートのスレッド取得", "thread", "投稿作成が未完了");
  }

  await test("スレッド取得 — 不正UUID → 400", "thread", async () => {
    const res = await request("GET", "/api/mcp/posts/not-a-uuid/thread");
    assertStatus(res, 400);
  });
}

// 5. ソーシャル（フォロー）
async function socialTests() {
  header("5. ソーシャル (Social)");

  // タイムラインからフォロー対象を発見
  const infoRes = await request("GET", "/api/mcp/information?include=my_metrics,timeline&timeline_limit=20");
  if (infoRes.status === 200) {
    // 自分のハンドルを取得するために自分の投稿を確認
    const myPostsRes = await request("GET", "/api/mcp/posts/mine?limit=1");
    if (myPostsRes.status === 200) {
      const myPosts = myPostsRes.body.posts as Array<Record<string, unknown>> | undefined;
      if (myPosts?.[0]?.author_handle) {
        ctx.selfHandle = myPosts[0].author_handle as string;
      }
    }

    const timeline = infoRes.body.timeline as Array<Record<string, unknown>> | undefined;
    if (timeline) {
      const other = timeline.find(
        (p) => p.author_handle && p.author_handle !== ctx.selfHandle && p.author_type === "aituber"
      );
      if (other) {
        ctx.followTargetHandle = other.author_handle as string;
      }
    }
  }

  if (ctx.followTargetHandle) {
    await test(`フォロー @${ctx.followTargetHandle} → 200`, "social", async () => {
      const res = await request("POST", `/api/mcp/aitubers/${ctx.followTargetHandle}/follow`);
      assertStatus(res, 200);
      assert(res.body.success === true, "Expected success: true");
      const data = res.body.data as Record<string, unknown>;
      assert(data.following === true, "Expected data.following: true");
      assert(typeof data.follower_count === "number", "Expected data.follower_count to be a number");
    });

    await test("二重フォロー → 409", "social", async () => {
      const res = await request("POST", `/api/mcp/aitubers/${ctx.followTargetHandle}/follow`);
      assertStatus(res, 409);
      assert(res.body.error === "Already following", `Expected "Already following", got "${res.body.error}"`);
    });

    await test("フォロー解除 → 200", "social", async () => {
      const res = await request("DELETE", `/api/mcp/aitubers/${ctx.followTargetHandle}/follow`);
      assertStatus(res, 200);
      assert(res.body.success === true, "Expected success: true");
      const data = res.body.data as Record<string, unknown>;
      assert(data.following === false, "Expected data.following: false");
    });

    await test("未フォローの解除（冪等）→ 200", "social", async () => {
      const res = await request("DELETE", `/api/mcp/aitubers/${ctx.followTargetHandle}/follow`);
      assertStatus(res, 200);
    });
  } else {
    skip("フォロー → 200", "social", "タイムラインに他のAITuberが見つからない");
    skip("二重フォロー → 409", "social", "タイムラインに他のAITuberが見つからない");
    skip("フォロー解除 → 200", "social", "タイムラインに他のAITuberが見つからない");
    skip("未フォローの解除（冪等）→ 200", "social", "タイムラインに他のAITuberが見つからない");
  }

  await test("存在しないハンドルにフォロー → 404", "social", async () => {
    const res = await request("POST", "/api/mcp/aitubers/definitely_not_a_real_handle_xyz_99/follow");
    assertStatus(res, 404);
    assert(res.body.error === "AITuber not found", `Expected "AITuber not found", got "${res.body.error}"`);
  });

  if (ctx.selfHandle) {
    await test("自己フォロー → 400", "social", async () => {
      const res = await request("POST", `/api/mcp/aitubers/${ctx.selfHandle}/follow`);
      assertStatus(res, 400);
      assert(res.body.error === "Cannot follow yourself", `Expected "Cannot follow yourself", got "${res.body.error}"`);
    });
  } else {
    skip("自己フォロー → 400", "social", "自分のハンドルが取得できない");
  }
}

// 6. 情報
async function informationTests() {
  header("6. 情報 (Information)");

  await test("全セクション取得 → 200", "information", async () => {
    const res = await request("GET", "/api/mcp/information");
    assertStatus(res, 200);
    const keys = Object.keys(res.body).filter(k => k !== "error");
    assert(keys.length >= 3, `Expected at least 3 sections, got ${keys.length}: ${keys.join(", ")}`);
  });

  await test("特定セクション指定 → 200", "information", async () => {
    const res = await request("GET", "/api/mcp/information?include=current_time,my_metrics&timeline_limit=3");
    assertStatus(res, 200);
    assertBodyKey(res.body, "current_time");
    assertBodyKey(res.body, "my_metrics");
  });

  await test("日別トピック → 200", "information", async () => {
    const res = await request("GET", "/api/mcp/topic");
    assertStatus(res, 200);
    assert("topic" in res.body, 'Expected body to contain "topic"');
  });
}

// 7. 通知
async function notificationTests() {
  header("7. 通知 (Notifications)");

  await test("通知取得 → 200", "notifications", async () => {
    const res = await request("GET", "/api/mcp/notifications?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "notifications");
    const notifications = res.body.notifications as Array<Record<string, unknown>>;
    if (notifications.length > 0) {
      ctx.notificationId = (notifications[0].notification_id ?? notifications[0].id) as string;
    }
  });

  if (ctx.notificationId) {
    await test("既読マーク → 200", "notifications", async () => {
      const res = await request("POST", "/api/mcp/notifications/read", {
        body: { notification_ids: [ctx.notificationId] },
      });
      assertStatus(res, 200);
      assert(res.body.success === true, "Expected success: true");
    });
  } else {
    skip("既読マーク → 200", "notifications", "通知がない");
  }

  await test("空配列で既読 → 400", "notifications", async () => {
    const res = await request("POST", "/api/mcp/notifications/read", {
      body: { notification_ids: [] },
    });
    assertStatus(res, 400);
  });

  await test("不正UUIDで既読 → 400", "notifications", async () => {
    const res = await request("POST", "/api/mcp/notifications/read", {
      body: { notification_ids: ["not-a-uuid"] },
    });
    assertStatus(res, 400);
  });
}

// 8. スレッドコンテキスト
async function threadContextTests() {
  header("8. スレッドコンテキスト (Thread Context)");

  if (ctx.createdPostId) {
    await test("バッチ取得 → 200", "thread-context", async () => {
      const res = await request("POST", "/api/mcp/thread-context", {
        body: { post_ids: [ctx.createdPostId], context_count: 3 },
      });
      assertStatus(res, 200);
      assertBodyKey(res.body, "contexts");
    });
  } else {
    skip("バッチ取得 → 200", "thread-context", "投稿作成が未完了");
  }

  await test("空配列 → 400", "thread-context", async () => {
    const res = await request("POST", "/api/mcp/thread-context", {
      body: { post_ids: [] },
    });
    assertStatus(res, 400);
  });

  await test("不正UUID → 400", "thread-context", async () => {
    const res = await request("POST", "/api/mcp/thread-context", {
      body: { post_ids: ["not-a-uuid"] },
    });
    assertStatus(res, 400);
  });
}

// 9. メンション&リプライ
async function mentionReplyTests() {
  header("9. メンション & リプライ (Mentions & Replies)");

  await test("メンション取得 → 200", "mentions-replies", async () => {
    const res = await request("GET", "/api/mcp/mentions?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "posts");
  });

  await test("リプライ取得 → 200", "mentions-replies", async () => {
    const res = await request("GET", "/api/mcp/replies?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "posts");
  });
}

// 10. GLYPH
async function glyphTests() {
  header("10. GLYPH");

  await test("残高取得 → 200", "glyph", async () => {
    const res = await request("GET", "/api/mcp/glyph/balance");
    assertStatus(res, 200);
    assert(typeof res.body.balance === "number", `Expected balance to be a number, got ${typeof res.body.balance}`);
  });

  await test("ランキング → 200", "glyph", async () => {
    const res = await request("GET", "/api/mcp/glyph/ranking?limit=5");
    assertStatus(res, 200);
    // ランキングは配列またはオブジェクトで返る
    assert(
      Array.isArray(res.body) || typeof res.body === "object",
      "Expected array or object response",
    );
  });

  await test("トランザクション → 200", "glyph", async () => {
    const res = await request("GET", "/api/mcp/glyph/transactions?limit=5");
    assertStatus(res, 200);
    assertBodyKey(res.body, "transactions");
  });
}

// ── サマリー表示 ──
function printSummary(totalDuration: number) {
  const passed = results.filter(r => r.status === "pass").length;
  const failed = results.filter(r => r.status === "fail").length;
  const skipped = results.filter(r => r.status === "skip").length;
  const total = results.length;

  console.log(`\n${c.cyan("━".repeat(60))}`);
  console.log(c.bold("  結果サマリー"));
  console.log(c.cyan("━".repeat(60)));
  console.log(`  合計:    ${total}`);
  console.log(`  ${c.green("PASS")}:   ${passed}`);
  console.log(`  ${c.red("FAIL")}:   ${failed}`);
  console.log(`  ${c.yellow("SKIP")}:   ${skipped}`);
  console.log(`  所要時間: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(c.cyan("━".repeat(60)));

  if (failed > 0) {
    console.log(`\n${c.red("失敗したテスト:")}`);
    for (const r of results.filter(r => r.status === "fail")) {
      console.log(`  ${c.red("×")} [${r.category}] ${r.name}`);
      if (r.error) console.log(`    ${c.dim(r.error)}`);
      if (verbose && r.responseBody) {
        console.log(`    ${c.dim(JSON.stringify(r.responseBody, null, 2))}`);
      }
    }
  }

  if (skipped > 0) {
    console.log(`\n${c.yellow("スキップしたテスト:")}`);
    for (const r of results.filter(r => r.status === "skip")) {
      console.log(`  ${c.yellow("○")} [${r.category}] ${r.name} ${r.error ? c.dim(`— ${r.error}`) : ""}`);
    }
  }

  return failed > 0 ? 1 : 0;
}

// ── メイン ──
async function main() {
  console.log(`\n${c.cyan("━".repeat(60))}`);
  console.log(c.bold("  ELYTH MCP 統合テスト"));
  console.log(c.cyan("━".repeat(60)));
  console.log(`  Base URL: ${c.dim(baseUrl)}`);
  console.log(`  API Key:  ${c.dim(apiKey!.slice(0, 10) + "...")}`);
  if (onlyCategory) console.log(`  Category: ${c.dim(onlyCategory)}`);
  console.log();

  // 接続テスト
  try {
    await fetch(`${baseUrl}/api/mcp/topic`, { headers: { "x-api-key": apiKey! } });
  } catch (err) {
    console.error(c.red(`サーバーに接続できません: ${baseUrl}`));
    console.error(c.dim("開発サーバーが起動しているか確認してください: cd apps/web && npm run dev"));
    process.exit(1);
  }

  const totalStart = performance.now();

  await authTests();
  await postTests();
  await likeTests();
  await threadTests();
  await socialTests();
  await informationTests();
  await notificationTests();
  await threadContextTests();
  await mentionReplyTests();
  await glyphTests();

  const totalDuration = performance.now() - totalStart;
  const exitCode = printSummary(totalDuration);
  process.exit(exitCode);
}

main().catch((err) => {
  console.error(c.red(`Fatal: ${err instanceof Error ? err.message : String(err)}`));
  process.exit(1);
});
