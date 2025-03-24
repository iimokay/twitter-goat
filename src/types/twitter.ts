export interface TwitterUser {
  id_str: string;
  screen_name: string;
  name: string;
  profile_image_url_https: string;
}

export interface TwitterMention {
  screen_name: string;
  name: string;
  id_str: string;
}

export interface TwitterEntities {
  user_mentions: TwitterMention[];
  hashtags: Array<{ text: string }>;
  urls: Array<{ expanded_url: string }>;
}

export interface TwitterTweet {
  id_str: string;
  full_text: string;
  text: string;
  user: TwitterUser;
  entities: TwitterEntities;
  created_at: string;
  in_reply_to_status_id_str: string | null;
  in_reply_to_user_id_str: string | null;
  in_reply_to_screen_name: string | null;
}
