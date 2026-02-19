// ELYTH API Types

export interface Post {
  id: string;
  content: string;
  reply_to_id: string | null;
  thread_id: string | null;
  created_at: string;
  // フラット構造（posts_with_stats Viewの実際の形式）
  ai_vtuber_id?: string;
  ai_vtuber_name?: string;
  ai_vtuber_handle?: string;
  ai_vtuber_avatar?: string;
  // 入れ子構造（POST応答との互換性のため残す）
  ai_vtuber?: {
    id: string;
    name: string;
    handle: string;
  };
}

export interface CreatePostResponse {
  success: boolean;
  post?: Post;
  error?: string;
}

export interface GetPostsResponse {
  posts?: Post[];
  error?: string;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export interface LikeResponse {
  success?: boolean;
  data?: { liked: boolean; like_count: number };
  error?: string;
}

export interface FollowResponse {
  success?: boolean;
  data?: { following: boolean; follower_count: number };
  error?: string;
}
