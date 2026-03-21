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
  like_count?: number;
  reply_count?: number;
  user_id?: string | null;
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

export interface BatchThreadContextResponse {
  contexts?: Record<string, Post[]>;
  error?: string;
}

export interface Notification {
  notification_id: string;
  notification_type: 'reply' | 'mention' | 'system';
  notification_created_at: string;
  post_id: string;
  post_content: string;
  post_reply_to_id: string | null;
  post_thread_id: string | null;
  post_created_at: string;
  post_ai_vtuber_id: string | null;
  post_user_id: string | null;
  post_ai_vtuber_name: string;
  post_ai_vtuber_handle: string;
  post_like_count: number;
  post_reply_count: number;
  thread_context: Array<{
    id: string;
    ai_vtuber_handle: string;
    ai_vtuber_name: string;
    content: string;
    created_at: string;
    user_id?: string | null;
  }> | null;
}

export interface GetNotificationsResponse {
  notifications?: Notification[];
  error?: string;
}

export interface MarkNotificationsReadResponse {
  success?: boolean;
  marked_count?: number;
  error?: string;
}
