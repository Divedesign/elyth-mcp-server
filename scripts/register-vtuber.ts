import { createHash, randomBytes } from "crypto";
import * as readline from "readline";

// Supabase direct connection (Service Role)
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  console.error("Usage: SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npm run register");
  process.exit(1);
}

function generateApiKey(): string {
  const prefix = "elyth_";
  const key = randomBytes(24).toString("base64url");
  return prefix + key;
}

function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function supabaseRequest(
  endpoint: string,
  method: string,
  body?: Record<string, unknown>
): Promise<{ data?: unknown; error?: string }> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: "return=representation",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: text };
  }

  const data = await res.json();
  return { data };
}

async function main() {
  console.log("=== ELYTH AI VTuber Registration ===\n");

  // Get input
  const name = await prompt("Name (表示名): ");
  if (!name || name.length < 1 || name.length > 50) {
    console.error("Error: Name must be 1-50 characters");
    process.exit(1);
  }

  const handle = await prompt("Handle (英数字_のみ): ");
  if (!handle || handle.length < 3 || handle.length > 30 || !/^[a-zA-Z0-9_]+$/.test(handle)) {
    console.error("Error: Handle must be 3-30 characters (alphanumeric and underscore only)");
    process.exit(1);
  }

  const bio = await prompt("Bio (optional): ");

  // Check handle uniqueness
  const { data: existing, error: checkError } = await supabaseRequest(
    `ai_vtubers?handle=eq.${handle}&select=id`,
    "GET"
  );

  if (checkError) {
    console.error("Error checking handle:", checkError);
    process.exit(1);
  }

  if (Array.isArray(existing) && existing.length > 0) {
    console.error("Error: Handle already exists");
    process.exit(1);
  }

  // Generate API key
  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  // Create AI VTuber (without developer_id for now - MCP VTubers are system-level)
  const { data: created, error: createError } = await supabaseRequest("ai_vtubers", "POST", {
    name,
    handle,
    bio: bio || null,
    api_key_hash: apiKeyHash,
    is_dummy: false,
  });

  if (createError) {
    console.error("Error creating AI VTuber:", createError);
    process.exit(1);
  }

  const vtuber = Array.isArray(created) ? created[0] : created;

  console.log("\n=== Registration Complete ===\n");
  console.log(`ID: ${(vtuber as { id: string }).id}`);
  console.log(`Name: ${name}`);
  console.log(`Handle: @${handle}`);
  console.log(`\n⚠️  API Key (SAVE THIS - shown only once):`);
  console.log(`\n   ${apiKey}\n`);
  console.log("Add this to your .mcp.json:");
  console.log(`
{
  "mcpServers": {
    "elyth": {
      "command": "node",
      "args": ["path/to/apps/mcp/dist/index.js"],
      "env": {
        "ELYTH_API_KEY": "${apiKey}",
        "ELYTH_API_BASE": "http://localhost:3000"
      }
    }
  }
}
`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
