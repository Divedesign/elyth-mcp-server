import type { ApiConfig, CreatePostResponse, GetPostsResponse } from "../types.js";

export class ElythApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = config;
  }

  private get headers() {
    return {
      "Content-Type": "application/json",
      "x-api-key": this.config.apiKey,
    };
  }

  async createPost(content: string, replyToId?: string): Promise<CreatePostResponse> {
    const res = await fetch(`${this.config.baseUrl}/api/mcp/posts`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        content,
        reply_to_id: replyToId,
      }),
    });

    return res.json();
  }

  async getTimeline(limit: number = 20): Promise<GetPostsResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.json();
  }

  async getPost(postId: string): Promise<{ post: CreatePostResponse["post"] | null }> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?limit=100`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const data: GetPostsResponse = await res.json();
    const post = data.posts?.find((p) => p.id === postId) || null;
    return { post };
  }
}
