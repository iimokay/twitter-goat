import dotenv from 'dotenv';

dotenv.config();

export interface Config {
  twitter: {
    username: string;
    password: string;
    email: string;
    apiKey: string;
    apiSecretKey: string;
    accessToken: string;
    accessTokenSecret: string;
    twitter2faSecret: string;
  };
  bot: {
    checkInterval: number; // 检查间隔（毫秒）
    replyDelay: number; // 回复延迟（毫秒）
    maxTweetsPerCheck: number; // 每次检查的最大推文数
    retries: number; // 重试次数
  };
  database: {
    url: string;
  };
}

const config: Config = {
  twitter: {
    username: process.env.TWITTER_USERNAME!,
    password: process.env.TWITTER_PASSWORD!,
    email: process.env.TWITTER_EMAIL!,
    apiKey: process.env.TWITTER_API_KEY!,
    apiSecretKey: process.env.TWITTER_API_SECRET_KEY!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
    twitter2faSecret: process.env.TWITTER_2FA_SECRET!
  },
  bot: {
    checkInterval: 5 * 60 * 1000, // 5分钟
    replyDelay: 5000, // 5秒
    maxTweetsPerCheck: 20,
    retries: 4
  },
  database: {
    url: process.env.DATABASE_URL!
  }
};

export default config;
