import express, { Request, Response, NextFunction } from 'express';
import { TwitterLoginCredentials } from './client';
import { logger } from '../utils/logger';
import { AccountManager } from './accountManager';
import { SearchMode } from '@dewicats/agent-twitter-client';

export class ApiService {
  private app = express();
  private accountManager: AccountManager;
  private port = 3000;

  constructor() {
    this.accountManager = AccountManager.getInstance();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(this.errorHandler.bind(this));
  }

  private setupRoutes(): void {
    // 健康检查
    this.app.get('/health', (req: Request, res: Response) => {
      logger.info('健康检查', req.hostname);
      res.json({ status: 'ok' });
    });

    // 登录账号（自动创建）
    this.app.post('/login', async (req: Request, res: Response) => {
      try {
        const credentials: TwitterLoginCredentials = req.body;
        if (!credentials.username || !credentials.password || !credentials.email) {
          res.status(400).json({ status: 'error', message: '缺少必要的登录信息' });
          return;
        }

        // 使用用户名作为账号ID
        const accountId = credentials.username;

        // 检查账号是否已存在
        const existingClient = this.accountManager.getClient(accountId);
        if (existingClient) {
          // 如果账号已存在，直接尝试登录
          await this.accountManager.login(accountId, credentials);
          res.json({
            status: 'ok',
            message: '登录成功',
            data: {
              accountId,
              username: credentials.username
            }
          });
          return;
        }

        // 如果账号不存在，创建新账号
        await this.accountManager.createClient(accountId);
        await this.accountManager.login(accountId, credentials);
        res.json({
          status: 'ok',
          message: '登录成功',
          data: {
            accountId,
            username: credentials.username
          }
        });
      } catch (error) {
        res.status(500).json({ status: 'error', message: '登录失败', error });
      }
    });

    // 搜索推文
    this.app.get('/accounts/:accountId/search', async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: '缺少账号ID' });
          return;
        }

        const { query, limit = 20 } = req.query;
        if (!query || typeof query !== 'string') {
          res.status(400).json({ status: 'error', message: '缺少搜索关键词' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: '账号不存在' });
          return;
        }

        const tweets = await client.searchTweets(query, Number(limit), SearchMode.Latest);
        res.json({ status: 'ok', data: tweets });
      } catch (error) {
        res.status(500).json({ status: 'error', message: '搜索推文失败', error });
      }
    });

    // 发送推文回复
    this.app.post('/accounts/:accountId/tweet', async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: '缺少账号ID' });
          return;
        }

        const { tweetId, replyText } = req.body;
        if (!tweetId || !replyText) {
          res.status(400).json({ status: 'error', message: '缺少必要参数' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: '账号不存在' });
          return;
        }

        await client.sendReply(tweetId, replyText);
        res.json({ status: 'ok', message: '回复发送成功' });
      } catch (error) {
        res.status(500).json({ status: 'error', message: '发送回复失败', error });
      }
    });

    // 获取用户资料
    this.app.get('/accounts/:accountId/user/:username', async (req: Request, res: Response) => {
      try {
        const { accountId, username } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: '缺少账号ID' });
          return;
        }

        if (!username || typeof username !== 'string') {
          res.status(400).json({ status: 'error', message: '缺少用户名' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: '账号不存在' });
          return;
        }

        const profile = await client.getProfile(username);
        res.json({ status: 'ok', data: profile });
      } catch (error) {
        res.status(500).json({ status: 'error', message: '获取用户资料失败', error });
      }
    });

    // 获取用户推文
    this.app.get(
      '/accounts/:accountId/user/:username/tweets',
      async (req: Request, res: Response) => {
        try {
          const { accountId, username } = req.params;
          if (!accountId || typeof accountId !== 'string') {
            res.status(400).json({ status: 'error', message: '缺少账号ID' });
            return;
          }

          if (!username || typeof username !== 'string') {
            res.status(400).json({ status: 'error', message: '缺少用户名' });
            return;
          }

          const { limit = 20 } = req.query;
          const client = this.accountManager.getClient(accountId);
          if (!client) {
            res.status(404).json({ status: 'error', message: '账号不存在' });
            return;
          }

          const tweets = await client.getUserTweets(username, Number(limit));
          res.json({ status: 'ok', data: tweets });
        } catch (error) {
          res.status(500).json({ status: 'error', message: '获取用户推文失败', error });
        }
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    logger.error('API 错误:', err, req.baseUrl);
    res.status(500).json({ status: 'error', message: '服务器内部错误', error: err.message });
  }

  async start(): Promise<void> {
    try {
      this.app.listen(this.port, () => {
        logger.info(`API 服务已启动，监听端口 ${this.port}`);
      });
    } catch (error) {
      logger.error('启动 API 服务失败:', error);
      throw error;
    }
  }
}
