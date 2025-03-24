import { Tweet } from '@dewicats/agent-twitter-client';
import { TwitterTweet } from '../types/twitter';
import { logger } from '../utils/logger';

export class TweetConverter {
  static toTwitterTweet(tweet: Tweet): TwitterTweet {
    if (!tweet) {
      throw new Error('Tweet object is null or undefined');
    }

    const { id, text, username, name } = tweet;

    if (!id || !text || !username || !name) {
      logger.error('Invalid tweet data:', { id, text, username, name });
      throw new Error('Required tweet fields are missing');
    }

    // 处理mentions，确保所有必需字段都有值
    const validMentions = (tweet.mentions || [])
      .filter((mention) => {
        const isValid = mention.username && mention.name && mention.id;
        if (!isValid) {
          logger.warn('Invalid mention data:', mention);
        }
        return isValid;
      })
      .map((mention) => ({
        screen_name: mention.username!,
        name: mention.name!,
        id_str: mention.id
      }));

    return {
      id_str: id,
      full_text: text,
      text: text,
      user: {
        id_str: id,
        screen_name: username,
        name: name,
        profile_image_url_https: ''
      },
      entities: {
        user_mentions: validMentions,
        hashtags: (tweet.hashtags || []).map((tag) => ({ text: tag })),
        urls: (tweet.urls || []).map((url) => ({ expanded_url: url }))
      },
      created_at: new Date().toISOString(),
      in_reply_to_status_id_str: tweet.conversationId || null,
      in_reply_to_user_id_str: tweet.inReplyToStatusId || null,
      in_reply_to_screen_name: null
    };
  }
}
