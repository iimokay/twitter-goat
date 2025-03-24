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

export const processAirdrop = async ({
  content,
  username
}: {
  content: string;
  username: string;
}): Promise<{ score: number; reason: string }> => {
  try {
    if (!username || !content) {
      return {
        score: 0,
        reason: `Not Found ${!username ? 'Username' : 'Prompt'}.😭`
      };
    }

    const prompt = `Yo! Satoshi Goat here, your favorite crypto memelord! Rate this joke (1-100) and give a quick, spicy reason why it's 🔥 or 💩

Scoring vibe:
- Laugh factor & meme potential 
- Crypto knowledge
- Could it go viral?
- Inside joke bonus

Joke: ${content}

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

    const rowKey = `airdrop_${username}_${dayjs().format('YYYY_MM_DD_HH_mm_ss')}`;
    const profile = await findAccountProfile(username);

    // 创建事件
    const eventPromise = createEvent({
      rowKey,
      level: 'INFO',
      name: AIRDROP_EVENT,
      content: {
        ...data,
        prompt: content,
        referrer: profile?.first_mentioned_by
      },
      target: 'AGENT',
      username
    });

    // 计算并更新用户积分
    const pointsIncrement = Math.floor(data.score * 0.6 * (profile?.first_mentioned_by ? 1.1 : 1));
    const pointsPromise = updateAccountPoints(username, pointsIncrement);

    // 处理推荐人积分
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

    // 执行事务
    const operations = [eventPromise, pointsPromise];
    if (referralUpdatePromise) {
      operations.push(referralUpdatePromise);
    }
    await executeTransaction(operations);

    return data;
  } catch (error) {
    console.error('Error processing airdrop:', error);
    return {
      score: 0,
      reason: 'Internal error occurred 😢'
    };
  }
};
