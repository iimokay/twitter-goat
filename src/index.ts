import { logger } from './utils/logger';
import { ApiService } from './services/api';
import { ServiceManager } from './utils/serviceManager';

async function main(): Promise<void> {
  try {
    const serviceManager = ServiceManager.getInstance();
    const apiService = new ApiService();

    // Register API service in service manager
    serviceManager.registerService('api', apiService);

    // Start all services
    await serviceManager.startAll();

    // Handle shutdown signals
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT signal');
      await serviceManager.stopAll();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM signal');
      await serviceManager.stopAll();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start services:', error);
    process.exit(1);
  }
}

main();
