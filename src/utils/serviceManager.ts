import { logger } from './logger';

interface Service {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, Service>;

  private constructor() {
    this.services = new Map();
  }

  public static getInstance(): ServiceManager {
    if (!ServiceManager.instance) {
      ServiceManager.instance = new ServiceManager();
    }
    return ServiceManager.instance;
  }

  public registerService(name: string, service: Service): void {
    if (this.services.has(name)) {
      throw new Error(`Service ${name} already registered`);
    }
    this.services.set(name, service);
    logger.info(`Service ${name} registered`);
  }

  public async startAll(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        await service.start();
        logger.info(`Service ${name} started`);
      } catch (error) {
        logger.error(`Failed to start service ${name}:`, error);
        throw error;
      }
    }
  }

  public async stopAll(): Promise<void> {
    for (const [name, service] of this.services) {
      try {
        await service.stop();
        logger.info(`Service ${name} stopped`);
      } catch (error) {
        logger.error(`Failed to stop service ${name}:`, error);
        throw error;
      }
    }
  }

  public getService(name: string): Service | undefined {
    return this.services.get(name);
  }
}
