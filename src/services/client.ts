import { Scraper, SearchMode, Tweet } from '@dewicats/agent-twitter-client';
import { logger } from '../utils/logger';
import config from '../config/config';
import { Cookie } from 'tough-cookie';
import { getLatestCookies, saveCookies } from '../db/database';

export interface SearchTweetsResponse {
  tweets: Tweet[];
  hasMore: boolean;
}

export interface TwitterProfile {
  id: string;
  username: string;
  displayName: string;
  followersCount: number;
  followingCount: number;
  tweetsCount: number;
}

export interface TwitterLoginCredentials {
  username: string;
  password: string;
  email: string;
  twitter2faSecret?: string;
}

export class TwitterClientService {
  private scraper = new Scraper();

  async login(credentials: TwitterLoginCredentials): Promise<void> {
    if (!this.scraper) {
      throw new Error('Scraper not initialized');
    }

    const { username, password, email, twitter2faSecret } = credentials;
    let retries = config.bot.retries;

    if (!username) {
      throw new Error('Twitter username not configured');
    }

    // 尝试从数据库获取cookies
    const savedCookies = await getLatestCookies(username);
    if (savedCookies?.cookies) {
      try {
        const cookies = JSON.parse(savedCookies.cookies);
        if (Array.isArray(cookies)) {
          await this.scraper.setCookies(this.convertToString(cookies as Cookie[]));
        }
      } catch (error) {
        logger.error('解析 cookies 时出错:', error);
      }
    }

    logger.info('等待 Twitter 登录');
    while (retries > 0) {
      try {
        if (await this.scraper.isLoggedIn()) {
          logger.info('已登录');
          break;
        } else {
          await this.scraper.login(username, password, email, twitter2faSecret);
          if (await this.scraper.isLoggedIn()) {
            logger.info('登录成功，缓存 cookies');
            const cookies = await this.scraper.getCookies();
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

  async searchTweets(
    query: string,
    limit: number,
    mode: SearchMode
  ): Promise<SearchTweetsResponse> {
    if (!this.scraper) {
      throw new Error('Scraper not initialized');
    }

    const tweets = await this.scraper.fetchSearchTweets(query, limit, mode);
    return {
      tweets: tweets.tweets || [],
      hasMore: false
    };
  }

  async sendReply(tweetId: string, replyText: string): Promise<void> {
    if (!this.scraper) {
      throw new Error('Scraper not initialized');
    }

    await this.scraper.sendTweet(replyText, tweetId);
  }

  async getProfile(username: string): Promise<TwitterProfile> {
    if (!this.scraper) {
      throw new Error('Scraper not initialized');
    }

    const profile = await this.scraper.getProfile(username);
    return {
      id: profile.userId || '',
      username: profile.username || '',
      displayName: profile.name || '',
      followersCount: profile.followersCount || 0,
      followingCount: profile.followingCount || 0,
      tweetsCount: profile.tweetsCount || 0
    };
  }

  async getUserTweets(username: string, limit: number): Promise<SearchTweetsResponse> {
    if (!this.scraper) {
      throw new Error('Scraper not initialized');
    }

    const tweets = await this.scraper.getTweets(username, limit);
    const tweetArray: Tweet[] = [];
    for await (const tweet of tweets) {
      tweetArray.push(tweet);
    }
    return {
      tweets: tweetArray,
      hasMore: false
    };
  }

  async isLoggedIn(): Promise<boolean> {
    return this.scraper?.isLoggedIn() ?? false;
  }
}
