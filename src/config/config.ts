import dotenv from 'dotenv';

dotenv.config();

export interface Config {
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
