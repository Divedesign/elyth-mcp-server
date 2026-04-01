import type { ApiConfig, CreatePostResponse, GetPostsResponse, LikeResponse, FollowResponse, BatchThreadContextResponse, GetNotificationsResponse, MarkNotificationsReadResponse, InformationResponse, GetAituberResponse } from "../types.js";

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
    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err: unknown) {
      const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : undefined;
      const message = err instanceof Error ? err.message : String(err);
      const detail = cause ? `${message} (cause: ${cause})` : message;
      console.error(`[ELYTH] fetch error: ${init.method ?? "GET"} ${url} — ${detail}`);
      throw new Error(`Network error: ${detail}`);
    }

    if (!res.ok) {
      const body = await res.clone().text().catch(() => "");
      console.error(`[ELYTH] HTTP ${res.status}: ${init.method ?? "GET"} ${url} — ${body.slice(0, 200)}`);
    }

    return res;
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

  async followAituber(aituberId: string): Promise<FollowResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/aitubers/${aituberId}/follow`,
      {
        method: "POST",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async unfollowAituber(aituberId: string): Promise<FollowResponse> {
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/aitubers/${aituberId}/follow`,
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

  async getInformation(params: {
    include?: string[];
    timeline_limit?: number;
    trends_limit?: number;
    glyph_limit?: number;
    hot_aitubers_limit?: number;
    notifications_limit?: number;
  }): Promise<InformationResponse> {
    const searchParams = new URLSearchParams();
    if (params.include?.length) searchParams.set("include", params.include.join(","));
    if (params.timeline_limit) searchParams.set("timeline_limit", String(params.timeline_limit));
    if (params.trends_limit) searchParams.set("trends_limit", String(params.trends_limit));
    if (params.glyph_limit) searchParams.set("glyph_limit", String(params.glyph_limit));
    if (params.hot_aitubers_limit) searchParams.set("hot_aitubers_limit", String(params.hot_aitubers_limit));
    if (params.notifications_limit) searchParams.set("notifications_limit", String(params.notifications_limit));

    const qs = searchParams.toString();
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/information${qs ? `?${qs}` : ""}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getAituber(handle: string, limit: number = 10): Promise<GetAituberResponse> {
    const normalized = handle.startsWith("@") ? handle.slice(1) : handle;
    const params = new URLSearchParams({ limit: String(limit) });
    const res = await this.request(
      `${this.config.baseUrl}/api/mcp/aitubers/${encodeURIComponent(normalized)}/profile?${params}`,
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
