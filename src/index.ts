import { Scraper, SearchMode } from '@dewicats/agent-twitter-client';
import { getLatestCookies, saveCookies, isTweetReplied, saveRepliedTweet } from './db/database';
import { generateTweetReply } from './services/tweetReply';
import { logger } from './utils/logger';
import { DaemonManager } from './utils/daemon';
import { TweetConverter } from './utils/tweetConverter';
import config from './config/config';
import { Cookie } from 'tough-cookie';
import { TwitterTweet } from './types/twitter';

class TwitterBot {
  private scraper: Scraper | null = null;
  private daemonManager: DaemonManager;

  constructor() {
    this.daemonManager = new DaemonManager();
  }

  async start(): Promise<void> {
    try {
      // 初始化 scraper
      this.scraper = await this.initializeScraper();
      if (!this.scraper) {
        throw new Error('Failed to initialize scraper');
      }

      // 注册任务
      this.daemonManager.registerTask(
        'processTweets',
        this.processTweets.bind(this),
        config.bot.checkInterval
      );

      // 启动所有任务
      this.daemonManager.startAll();

      // 监听进程信号
      this.setupSignalHandlers();

      logger.info('Twitter bot 已启动');
    } catch (error) {
      logger.error('启动 Twitter bot 时出错:', error);
      process.exit(1);
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGTERM', this.handleShutdown.bind(this));
    process.on('SIGINT', this.handleShutdown.bind(this));
    process.on('uncaughtException', this.handleError.bind(this));
    process.on('unhandledRejection', this.handleError.bind(this));
  }

  private async handleShutdown(): Promise<void> {
    logger.info('正在关闭 Twitter bot...');
    this.daemonManager.stopAll();
    process.exit(0);
  }

  private handleError(error: Error): void {
    logger.error('发生未捕获的错误:', error);
    // 在这里可以添加错误报告逻辑，比如发送到错误追踪服务
  }

  private async initializeScraper(): Promise<Scraper | null> {
    try {
      const scraper = new Scraper();
      await this.login(scraper);
      return scraper;
    } catch (error) {
      logger.error('初始化 scraper 时出错:', error);
      return null;
    }
  }

  private async login(scraper: Scraper): Promise<void> {
    const username = config.twitter.username;
    const password = config.twitter.password;
    const email = config.twitter.email;
    let retries = config.bot.retries;
    const twitter2faSecret = config.twitter.twitter2faSecret;

    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // 尝试从数据库获取cookies
    const savedCookies = await getLatestCookies(username);
    if (savedCookies?.cookies) {
      try {
        const cookies = JSON.parse(savedCookies.cookies);
        if (Array.isArray(cookies)) {
          await scraper.setCookies(this.convertToString(cookies as Cookie[]));
        }
      } catch (error) {
        logger.error('解析 cookies 时出错:', error);
      }
    }

    logger.info('等待 Twitter 登录');
    while (retries > 0) {
      try {
        if (await scraper.isLoggedIn()) {
          logger.info('已登录');
          break;
        } else {
          await scraper.login(username, password, email, twitter2faSecret);
          if (await scraper.isLoggedIn()) {
            logger.info('登录成功，缓存 cookies');
            const cookies = await scraper.getCookies();
            await saveCookies(username, JSON.stringify(cookies));
            break;
          }
        }
      } catch (error) {
        logger.error('登录尝试失败:', error);
      }

      retries--;
      logger.error(`登录 Twitter 失败，重试中... (剩余 ${retries} 次尝试)`);

      if (retries === 0) {
        logger.error('达到最大重试次数，退出登录流程');
        throw new Error('Twitter login failed after maximum retries.');
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  private convertToString(cookiesArray: Cookie[]): string[] {
    return cookiesArray.map(
      (cookie) =>
        `${cookie.key}=${cookie.value}; Domain=${cookie.domain}; Path=${cookie.path}; ${
          cookie.secure ? 'Secure' : ''
        }; ${cookie.httpOnly ? 'HttpOnly' : ''}; SameSite=${cookie.sameSite ?? 'Lax'}`
    );
  }

  private async processTweets(): Promise<void> {
    if (!this.scraper) {
      logger.error('Scraper 未初始化');
      return;
    }

    try {
      // 搜索提及目标用户的推文
      const tweets = await this.scraper.fetchSearchTweets(
        `@${config.twitter.username} ${this.getTweetsFromLast24Hours()}`,
        config.bot.maxTweetsPerCheck,
        SearchMode.Latest
      );

      if (!tweets?.tweets?.length) {
        logger.info('没有找到新的提及推文');
        return;
      }

      for (const rawTweet of tweets.tweets) {
        const tweet = TweetConverter.toTwitterTweet(rawTweet);
        await this.processSingleTweet(tweet);
      }

      logger.info(`检查完成 - ${tweets.tweets.length} 条推文`);
    } catch (error) {
      logger.error('处理推文时出错:', error);
    }
  }

  private async processSingleTweet(tweet: TwitterTweet): Promise<void> {
    if (!this.scraper || !tweet.id_str) {
      return;
    }

    logger.warn(`处理推文: ${tweet.text}`);

    try {
      // Check if tweet has been replied to
      if (await isTweetReplied(tweet.id_str)) {
        logger.warn(`Tweet ${tweet.id_str} has already been replied to, skipping`);
        return;
      }

      // Generate reply content
      const { replyText, score, reason } = await generateTweetReply(tweet);

      // Send reply
      await this.scraper.sendTweet(replyText, tweet.id_str);

      // Save to database
      await saveRepliedTweet(tweet.id_str, replyText, tweet, score, reason);

      logger.warn(`Successfully replied to tweet ${tweet.id_str}: ${replyText}`);

      // Add delay to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, config.bot.replyDelay));
    } catch (error) {
      logger.error(`Error replying to tweet ${tweet.id_str}:`, error);
    }
  }

  private getTweetsFromLast24Hours(): string {
    const now = new Date();
    now.setDate(now.getDate() - 1);
    return `since:${now.toISOString().split('T')[0]}`;
  }
}

// 启动 bot
const bot = new TwitterBot();
bot.start().catch((error) => {
  logger.error('启动失败:', error);
  process.exit(1);
});
