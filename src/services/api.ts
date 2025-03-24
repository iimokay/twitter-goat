import express, { Request, Response, NextFunction } from 'express';
import { Server } from 'http';
import { TwitterLoginCredentials } from './client';
import { logger } from '../utils/logger';
import { AccountManager } from './accountManager';
import { SearchMode } from '@dewicats/agent-twitter-client';

export class ApiService {
  private app = express();
  private accountManager: AccountManager;
  private port = 3000;
  private server: Server | null = null;

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
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      logger.info('Health check', req.hostname);
      res.json({ status: 'ok' });
    });

    // Login account (auto create)
    this.app.post('/login', async (req: Request, res: Response) => {
      try {
        const credentials: TwitterLoginCredentials = req.body;
        if (!credentials.username || !credentials.password || !credentials.email) {
          res.status(400).json({ status: 'error', message: 'Missing required login information' });
          return;
        }

        // Use username as account ID
        const accountId = credentials.username;

        // Check if account exists
        const existingClient = this.accountManager.getClient(accountId);
        if (existingClient) {
          // If account exists, try to login directly
          await this.accountManager.login(accountId, credentials);
          res.json({
            status: 'ok',
            message: 'Login successful',
            data: {
              accountId,
              username: credentials.username
            }
          });
          return;
        }

        // If account doesn't exist, create new account
        await this.accountManager.createClient(accountId);
        await this.accountManager.login(accountId, credentials);
        res.json({
          status: 'ok',
          message: 'Login successful',
          data: {
            accountId,
            username: credentials.username
          }
        });
      } catch (error) {
        res.status(500).json({ status: 'error', message: 'Login failed', error });
      }
    });

    // Search tweets
    this.app.get('/accounts/:accountId/search', async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: 'Missing account ID' });
          return;
        }

        const { query, limit = 20 } = req.query;
        if (!query || typeof query !== 'string') {
          res.status(400).json({ status: 'error', message: 'Missing search query' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: 'Account not found' });
          return;
        }

        const tweets = await client.searchTweets(query, Number(limit), SearchMode.Latest);
        res.json({ status: 'ok', data: tweets });
      } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to search tweets', error });
      }
    });

    // Send tweet reply
    this.app.post('/accounts/:accountId/tweet', async (req: Request, res: Response) => {
      try {
        const { accountId } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: 'Missing account ID' });
          return;
        }

        const { tweetId, replyText } = req.body;
        if (!tweetId || !replyText) {
          res.status(400).json({ status: 'error', message: 'Missing required parameters' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: 'Account not found' });
          return;
        }

        await client.sendReply(tweetId, replyText);
        res.json({ status: 'ok', message: 'Reply sent successfully' });
      } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to send reply', error });
      }
    });

    // Get user profile
    this.app.get('/accounts/:accountId/user/:username', async (req: Request, res: Response) => {
      try {
        const { accountId, username } = req.params;
        if (!accountId || typeof accountId !== 'string') {
          res.status(400).json({ status: 'error', message: 'Missing account ID' });
          return;
        }

        if (!username || typeof username !== 'string') {
          res.status(400).json({ status: 'error', message: 'Missing username' });
          return;
        }

        const client = this.accountManager.getClient(accountId);
        if (!client) {
          res.status(404).json({ status: 'error', message: 'Account not found' });
          return;
        }

        const profile = await client.getProfile(username);
        res.json({ status: 'ok', data: profile });
      } catch (error) {
        res.status(500).json({ status: 'error', message: 'Failed to get user profile', error });
      }
    });

    // Get user tweets
    this.app.get(
      '/accounts/:accountId/user/:username/tweets',
      async (req: Request, res: Response) => {
        try {
          const { accountId, username } = req.params;
          if (!accountId || typeof accountId !== 'string') {
            res.status(400).json({ status: 'error', message: 'Missing account ID' });
            return;
          }

          if (!username || typeof username !== 'string') {
            res.status(400).json({ status: 'error', message: 'Missing username' });
            return;
          }

          const { limit = 20 } = req.query;
          const client = this.accountManager.getClient(accountId);
          if (!client) {
            res.status(404).json({ status: 'error', message: 'Account not found' });
            return;
          }

          const tweets = await client.getUserTweets(username, Number(limit));
          res.json({ status: 'ok', data: tweets });
        } catch (error) {
          res.status(500).json({ status: 'error', message: 'Failed to get user tweets', error });
        }
      }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
    logger.error('API Error:', err, req.baseUrl);
    res.status(500).json({ status: 'error', message: 'Internal server error', error: err.message });
  }

  async start(): Promise<void> {
    try {
      this.server = this.app.listen(this.port, () => {
        logger.info(`API service started, listening on port ${this.port}`);
      });
    } catch (error) {
      logger.error('Failed to start API service:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      if (this.server) {
        this.server.close(() => {
          logger.info('API service stopped');
        });
      }
    } catch (error) {
      logger.error('Failed to stop API service:', error);
      throw error;
    }
  }
}
