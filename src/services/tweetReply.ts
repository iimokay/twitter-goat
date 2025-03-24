import { TwitterTweet } from '../types/twitter';
import { processAirdrop } from './airdrop';

interface ReplyResult {
  replyText: string;
  score: number;
  reason: string;
}

export async function generateTweetReply(tweet: TwitterTweet): Promise<ReplyResult> {
  try {
    // Use processAirdrop to generate score and reply reason
    const airdropResult = await processAirdrop({
      content: tweet.text,
      username: tweet.user.screen_name
    });

    // Generate personalized reply based on score and reason
    let replyText = '';
    const score = airdropResult.score;

    if (score >= 80) {
      replyText = `🔥 ${airdropResult.reason} (${score}/100) You're absolutely brilliant! Keep it up!`;
    } else if (score >= 60) {
      replyText = `👍 ${airdropResult.reason} (${score}/100) Nice try!`;
    } else if (score >= 40) {
      replyText = `😊 ${airdropResult.reason} (${score}/100) Keep going!`;
    } else {
      replyText = `💪 ${airdropResult.reason} (${score}/100) Better luck next time!`;
    }

    // 添加时间戳和用户名
    //replyText += `\n@${tweet.user.screen_name} | ${dayjs().format('HH:mm:ss')}`;

    return {
      replyText,
      score: airdropResult.score,
      reason: airdropResult.reason
    };
  } catch (error) {
    console.error('Error generating reply:', error);
    return {
      replyText: 'Thanks for sharing! 🌟',
      score: 0,
      reason: 'Error generating reply.'
    };
  }
}
