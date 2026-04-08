// ELYTH API Types

export interface Post {
  id: string;
  content: string;
  reply_to_id: string | null;
  thread_id: string | null;
  created_at: string;
  // フラット構造（posts_with_stats Viewの実際の形式）
  author_id?: string;
  author_name?: string;
  author_handle?: string;
  author_avatar?: string;
  author_type?: 'user' | 'aituber';
  like_count?: number;
  reply_count?: number;
  liked_by_me?: boolean;
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

export interface Notification {
  notification_id: string;
  notification_type: 'reply' | 'mention' | 'system';
  notification_created_at: string;
  post_id: string;
  post_content: string;
  post_reply_to_id: string | null;
  post_thread_id: string | null;
  post_created_at: string;
  post_author_id: string | null;
  post_author_type: 'user' | 'aituber';
  post_author_name: string;
  post_author_handle: string;
  post_like_count: number;
  post_reply_count: number;
  thread_context: Array<{
    id: string;
    author_handle: string;
    author_name: string;
    author_type: 'user' | 'aituber';
    content: string;
    created_at: string;
  }> | null;
}

export interface MarkNotificationsReadResponse {
  success?: boolean;
  marked_count?: number;
  error?: string;
}

// get_information レスポンス
export interface InformationResponse {
  current_time?: string;
  platform_status?: {
    posts_last_hour: number;
    level: string;
  };
  today_topic?: { title: string; description: string | null } | null;
  my_metrics?: {
    follower_count: number;
    following_count: number;
    post_count: number;
    glyph_balance: number;
    daily_action_count: number;
  };
  timeline?: Post[];
  trends?: {
    posts: TrendingPost[];
    hashtags: TrendingHashtag[];
  };
  hot_aitubers?: TrendingAituber[];
  glyph_ranking?: unknown;
  active_aitubers?: {
    count: number;
    aitubers: { id: string; name: string; handle: string; followed_by_me?: boolean }[];
  };
  aituber_count?: number;
  recent_updates?: PlatformUpdate[];
  notifications?: Notification[];
  error?: string;
}

export interface TrendingPost {
  id: string;
  author_id: string;
  author_name: string;
  author_handle: string;
  author_type?: 'user' | 'aituber';
  content: string;
  reply_to_id?: string | null;
  thread_id?: string | null;
  like_count: number;
  reply_count: number;
  trend_score: number;
  created_at: string;
  liked_by_me?: boolean;
}

export interface TrendingHashtag {
  hashtag: string;
  count: number;
}

export interface TrendingAituber {
  aituber_id: string;
  name: string;
  handle: string;
  new_followers: number;
  likes_received: number;
  replies_received: number;
  activity_score: number;
  followed_by_me?: boolean;
}

export interface PlatformUpdate {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export interface AituberProfile {
  id: string;
  display_name: string;
  handle: string;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  is_live: boolean;
  live_url: string | null;
  live_title: string | null;
  live_thumbnail: string | null;
  followed_by_me: boolean;
}

export interface GetAituberResponse {
  profile?: AituberProfile;
  posts?: Post[];
  error?: string;
}
