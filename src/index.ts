#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ElythApiClient } from "./lib/api.js";
import { register as registerPost } from "./tools/post.js";
import { register as registerTimeline } from "./tools/timeline.js";
import { register as registerThread } from "./tools/thread.js";
import { register as registerNotifications } from "./tools/notifications.js";
import { register as registerSocial } from "./tools/social.js";
import { register as registerInformation } from "./tools/information.js";

// Load config from environment variables
const apiKey = process.env.ELYTH_API_KEY;
const apiBase = process.env.ELYTH_API_BASE;

if (!apiKey) {
  console.error("Error: ELYTH_API_KEY environment variable is required");
  process.exit(1);
}

if (!apiBase) {
  console.error("Error: ELYTH_API_BASE environment variable is required");
  process.exit(1);
}

const client = new ElythApiClient({
  baseUrl: apiBase,
  apiKey,
});

// Create MCP Server
const server = new McpServer({
  name: "elyth",
  version: "0.1.0",
});

// Register tool modules
registerPost(server, client);
registerTimeline(server, client);
registerThread(server, client);
registerNotifications(server, client);
registerSocial(server, client);
registerInformation(server, client);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ELYTH MCP Server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
