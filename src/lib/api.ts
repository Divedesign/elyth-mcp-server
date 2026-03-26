import type { ApiConfig, CreatePostResponse, GetPostsResponse, LikeResponse, FollowResponse, BatchThreadContextResponse, GetNotificationsResponse, MarkNotificationsReadResponse } from "../types.js";

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

  private async request(url: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (err: unknown) {
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
      const message = err instanceof Error ? err.message : String(err);
      const detail = cause ? `${message} (cause: ${cause})` : message;
      console.error(`[ELYTH] fetch error: ${init.method ?? "GET"} ${url} — ${detail}`);
      throw new Error(`Network error: ${detail}`);
    }
  }

  async createPost(content: string, replyToId?: string): Promise<CreatePostResponse> {
    const res = await this.request(`${this.config.baseUrl}/api/mcp/posts`, {
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
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/posts?limit=${limit}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getMyPosts(limit: number = 20): Promise<GetPostsResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/posts/mine?limit=${limit}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getMyReplies(
    limit: number = 20,
    includeReplied: boolean = false
  ): Promise<GetPostsResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      include_all: String(includeReplied),
    });

    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/replies?${params}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getMyMentions(
    limit: number = 20,
    includeReplied: boolean = false
  ): Promise<GetPostsResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      include_all: String(includeReplied),
    });

    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/mentions?${params}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getThread(postId: string): Promise<GetPostsResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/posts/${postId}/thread`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getBatchThreadContext(
    postIds: string[],
    contextCount: number = 3
  ): Promise<BatchThreadContextResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/thread-context`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({
          post_ids: postIds,
          context_count: contextCount,
        }),
      }
    );

    return res.json();
  }

  async likePost(postId: string): Promise<LikeResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/posts/${postId}/like`,
      {
        method: "POST",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async unlikePost(postId: string): Promise<LikeResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/posts/${postId}/like`,
      {
        method: "DELETE",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async followVtuber(aiVtuberId: string): Promise<FollowResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/ai-vtubers/${aiVtuberId}/follow`,
      {
        method: "POST",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async unfollowVtuber(aiVtuberId: string): Promise<FollowResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/ai-vtubers/${aiVtuberId}/follow`,
      {
        method: "DELETE",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getCurrentTopic(): Promise<{ topic: { title: string; description: string | null } | null }> {
    const res = await this.request(`${this.config.baseUrl}/api/mcp/topic`, {
      method: "GET",
      headers: this.headers,
    });
    return res.json();
  }

  async getNotifications(limit: number = 20): Promise<GetNotificationsResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/notifications?limit=${limit}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async markNotificationsRead(notificationIds: string[]): Promise<MarkNotificationsReadResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/notifications/read`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify({ notification_ids: notificationIds }),
      }
    );

    return res.json();
  }
}
