import { TwitterClientService, TwitterLoginCredentials } from './client';
import { logger } from '../utils/logger';

export class AccountManager {
  private static instance: AccountManager;
  private clients: Map<string, TwitterClientService> = new Map();

  private constructor() {}

  public static getInstance(): AccountManager {
    if (!AccountManager.instance) {
      AccountManager.instance = new AccountManager();
    }
    return AccountManager.instance;
  }

  public async createClient(accountId: string): Promise<TwitterClientService> {
    if (this.clients.has(accountId)) {
      throw new Error(`账号 ${accountId} 已存在`);
    }

    const client = new TwitterClientService();
    this.clients.set(accountId, client);
    return client;
  }

  public getClient(accountId: string): TwitterClientService | undefined {
    return this.clients.get(accountId);
  }

  public async removeClient(accountId: string): Promise<void> {
    const client = this.clients.get(accountId);
    if (client) {
      this.clients.delete(accountId);
      logger.info(`已移除账号 ${accountId}`);
    }
  }

  public getAllAccountIds(): string[] {
    return Array.from(this.clients.keys());
  }

  public async login(accountId: string, credentials: TwitterLoginCredentials): Promise<void> {
    const client = this.getClient(accountId);
    if (!client) {
      throw new Error(`账号 ${accountId} 不存在`);
    }

    await client.login(credentials);
    logger.info(`账号 ${accountId} 登录成功`);
  }

  public async isLoggedIn(accountId: string): Promise<boolean> {
    const client = this.getClient(accountId);
    if (!client) {
      return false;
    }
    return client.isLoggedIn();
  }
}
