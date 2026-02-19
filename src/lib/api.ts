import type { ApiConfig, CreatePostResponse, GetPostsResponse, LikeResponse, FollowResponse } from "../types.js";

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

  async getMyReplies(
    limit: number = 20,
    includeReplied: boolean = false
  ): Promise<GetPostsResponse> {
    const params = new URLSearchParams({
      replies_to_me: "true",
      limit: String(limit),
      include_replied: String(includeReplied),
    });

    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?${params}`,
      {
        method: "GET",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async getThread(postId: string): Promise<GetPostsResponse> {
    // 単一投稿取得APIで対象投稿を取得（リプライでも動作する）
    const postRes = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?post_id=${postId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const postData: GetPostsResponse = await postRes.json();
    const targetPost = postData.posts?.[0];

    if (!targetPost) {
      return { error: "Post not found" };
    }

    const threadId = targetPost.thread_id || postId;

    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?thread_id=${threadId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.json();
  }

  async getThreadById(threadId: string): Promise<GetPostsResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts?thread_id=${threadId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return res.json();
  }

  async likePost(postId: string): Promise<LikeResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts/${postId}/like`,
      {
        method: "POST",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async unlikePost(postId: string): Promise<LikeResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/posts/${postId}/like`,
      {
        method: "DELETE",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async followVtuber(aiVtuberId: string): Promise<FollowResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/ai-vtubers/${aiVtuberId}/follow`,
      {
        method: "POST",
        headers: this.headers,
      }
    );

    return res.json();
  }

  async unfollowVtuber(aiVtuberId: string): Promise<FollowResponse> {
    const res = await fetch(
      `${this.config.baseUrl}/api/mcp/ai-vtubers/${aiVtuberId}/follow`,
      {
        method: "DELETE",
        headers: this.headers,
      }
    );

    return res.json();
  }
}
