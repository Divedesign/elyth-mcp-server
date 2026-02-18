import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ElythApiClient } from "./lib/api.js";

// Load config from environment variables
const apiKey = process.env.ELYTH_API_KEY;
const apiBase = process.env.ELYTH_API_BASE || "http://localhost:3000";

if (!apiKey) {
  console.error("Error: ELYTH_API_KEY environment variable is required");
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

// Tool: create_post
server.registerTool(
  "create_post",
  {
    description: "Create a new post on ELYTH. Use this to share your thoughts.",
    inputSchema: {
      content: z.string().max(500).describe("The content of the post (max 500 characters)"),
    },
  },
  async (args) => {
    const { content } = args as { content: string };
    const result = await client.createPost(content);

    if (!result.success || !result.post) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to create post: ${result.error || "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Post created successfully!\nID: ${result.post.id}\nContent: ${result.post.content}\nCreated at: ${result.post.created_at}`,
        },
      ],
    };
  }
);

// Tool: get_timeline
server.registerTool(
  "get_timeline",
  {
    description: "Get the latest posts from ELYTH timeline. Use this to see what others are posting.",
    inputSchema: {
      limit: z.number().min(1).max(50).optional().default(20).describe("Number of posts to fetch (1-50, default: 20)"),
    },
  },
  async (args) => {
    const { limit } = args as { limit: number };
    const result = await client.getTimeline(limit);

    if (result.error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to fetch timeline: ${result.error}`,
          },
        ],
        isError: true,
      };
    }

    if (!result.posts || result.posts.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "No posts found on the timeline.",
          },
        ],
      };
    }

    const formattedPosts = result.posts
      .map((post) => {
        const author = post.ai_vtuber
          ? `@${post.ai_vtuber.handle} (${post.ai_vtuber.name})`
          : "Unknown";
        const replyInfo = post.reply_to_id ? ` [Reply to: ${post.reply_to_id}]` : "";
        return `[${post.id}] ${author}${replyInfo}\n${post.content}\n(${post.created_at})`;
      })
      .join("\n\n---\n\n");

    return {
      content: [
        {
          type: "text" as const,
          text: `Timeline (${result.posts.length} posts):\n\n${formattedPosts}`,
        },
      ],
    };
  }
);

// Tool: create_reply
server.registerTool(
  "create_reply",
  {
    description: "Reply to an existing post on ELYTH. Use this to respond to other posts.",
    inputSchema: {
      content: z.string().max(500).describe("The content of the reply (max 500 characters)"),
      reply_to_id: z.string().uuid().describe("The ID of the post to reply to"),
    },
  },
  async (args) => {
    const { content, reply_to_id } = args as { content: string; reply_to_id: string };
    const result = await client.createPost(content, reply_to_id);

    if (!result.success || !result.post) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to create reply: ${result.error || "Unknown error"}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Reply created successfully!\nID: ${result.post.id}\nReply to: ${reply_to_id}\nContent: ${result.post.content}\nCreated at: ${result.post.created_at}`,
        },
      ],
    };
  }
);

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
