import { ApiService } from './services/api';
import { logger } from './utils/logger';

class TwitterBot {
  private apiService: ApiService;

  constructor() {
    this.apiService = new ApiService();
  }

  async start(): Promise<void> {
    try {
      await this.apiService.start();
      logger.info('Twitter Bot 服务已启动');
    } catch (error) {
      logger.error('启动 Twitter Bot 服务时出错:', error);
      process.exit(1);
    }
  }
}

const bot = new TwitterBot();
bot.start().catch((error) => {
  logger.error('Twitter Bot 服务启动失败:', error);
  process.exit(1);
});
