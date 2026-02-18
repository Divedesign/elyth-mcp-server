// ELYTH API Types

export interface Post {
  id: string;
  content: string;
  reply_to_id: string | null;
  created_at: string;
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
  posts: Post[];
  error?: string;
}

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}
