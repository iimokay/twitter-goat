import { TwitterTweet } from '../types/twitter';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import dayjs from 'dayjs';
import {
  findAccountProfile,
  createEvent,
  updateAccountPoints,
  executeTransaction
} from '../db/database';
import { parseJSONObjectFromText } from '../common/parsing';
import * as console from 'node:console';

const CURRENT_MODEL = 'gpt-4o-mini';
const AIRDROP_EVENT = 'AIRDROP_SCORE';

interface ReplyResult {
  replyText: string;
  score: number;
  reason: string;
}

export async function generateTweetReply(tweet: TwitterTweet): Promise<ReplyResult> {
  try {
    if (!tweet.user.screen_name || !tweet.text) {
      return {
        score: 0,
        reason: `Not Found ${!tweet.user.screen_name ? 'Username' : 'Prompt'}.😭`,
        replyText: 'Thanks for sharing! 🌟'
      };
    }

    const prompt = `Yo! Satoshi Goat here, your favorite crypto memelord! Rate this joke (1-100) and give a quick, spicy reason why it's 🔥 or 💩

Scoring vibe:
- Laugh factor & meme potential 
- Crypto knowledge
- Could it go viral?
- Inside joke bonus

Joke: ${tweet.text}

Keep it short and savage! Format:
\`\`\`json
{
  score: number,
  reason: string  // max 80 chars, make it count!
}
\`\`\``;

    const { text } = await generateText({
      model: openai.languageModel(CURRENT_MODEL),
      prompt,
      temperature: 0.7,
      maxTokens: 100
    });

    const data = parseJSONObjectFromText(text) as {
      score: number;
      reason: string;
    };

    const rowKey = `airdrop_${tweet.user.screen_name}_${dayjs().format('YYYY_MM_DD_HH_mm_ss')}`;
    const profile = await findAccountProfile(tweet.user.screen_name);

    // Create event
    const eventPromise = createEvent({
      rowKey,
      level: 'INFO',
      name: AIRDROP_EVENT,
      content: {
        ...data,
        prompt: tweet.text,
        referrer: profile?.first_mentioned_by
      },
      target: 'AGENT',
      username: tweet.user.screen_name
    });

    // Calculate and update user points
    const pointsIncrement = Math.floor(data.score * 0.6 * (profile?.first_mentioned_by ? 1.1 : 1));
    const pointsPromise = updateAccountPoints(tweet.user.screen_name, pointsIncrement);

    // Handle referrer points
    /* eslint-disable @typescript-eslint/no-explicit-any */
    let referralUpdatePromise: Promise<any> | undefined;
    if (profile?.first_mentioned_by) {
      const referralAccount = await findAccountProfile(profile.first_mentioned_by);
      if (referralAccount) {
        const referralPointsIncrement = Math.floor(data.score * 0.6 * 0.1);
        referralUpdatePromise = updateAccountPoints(
          referralAccount.username,
          referralPointsIncrement
        );
      }
    }

    // Execute transaction
    const operations = [eventPromise, pointsPromise];
    if (referralUpdatePromise) {
      operations.push(referralUpdatePromise);
    }
    await executeTransaction(operations);

    // Generate personalized reply based on score and reason
    let replyText = '';
    const score = data.score;

    if (score >= 80) {
      replyText = `🔥 ${data.reason} (${score}/100) You're absolutely brilliant! Keep it up!`;
    } else if (score >= 60) {
      replyText = `👍 ${data.reason} (${score}/100) Nice try!`;
    } else if (score >= 40) {
      replyText = `😊 ${data.reason} (${score}/100) Keep going!`;
    } else {
      replyText = `💪 ${data.reason} (${score}/100) Better luck next time!`;
    }

    return {
      replyText,
      score: data.score,
      reason: data.reason
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
