export interface MyChannel {
  id: number
  tg_id: number
  username: string
  title: string
  created_at: string
}

export interface SourceChannel {
  id: number
  username: string
  title: string
  tg_id: number
  my_channel_id: number
  prompt: string | null
  created_at: string
}

export interface Post {
  id: number
  source_channel_id: number
  message_id: number
  original_text: string
  rewritten_text: string | null
  media_paths: string[] | null
  media_types: string[] | null
  status: 'new' | 'ready' | 'sent' | 'discarded'
  target_channel_id: number | null
  sent_at: string | null
  created_at: string
}

export interface PublishLog {
  id: number
  post_id: number
  source_channel_username: string
  target_channel_username: string
  original_text_snippet: string
  rewritten_text_snippet: string | null
  media_count: number
  published_at: string
}

export interface Stats {
  total_parsed: number
  total_sent: number
  total_discarded: number
}
