import { logger } from './logger';

interface Task {
  fn: () => Promise<void>;
  interval: number;
  lastRun?: Date;
  isRunning: boolean;
}

export class DaemonManager {
  private tasks: Map<string, Task> = new Map();
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  /**
   * 注册一个需要定期执行的任务
   * @param name 任务名称
   * @param fn 任务函数
   * @param interval 执行间隔（毫秒）
   */
  registerTask(name: string, fn: () => Promise<void>, interval: number): void {
    this.tasks.set(name, { fn, interval, isRunning: false });
    logger.info(`任务 ${name} 已注册，执行间隔: ${interval}ms`);
  }

  /**
   * 启动所有注册的任务
   */
  startAll(): void {
    for (const [name] of this.tasks.entries()) {
      this.startTask(name);
    }
  }

  /**
   * 停止所有任务
   */
  stopAll(): void {
    for (const [name] of this.tasks.entries()) {
      this.stopTask(name);
    }
  }

  private async executeTask(name: string): Promise<void> {
    const task = this.tasks.get(name);
    if (!task || task.isRunning) {
      return;
    }

    task.isRunning = true;
    task.lastRun = new Date();

    try {
      await task.fn();
    } catch (error) {
      logger.error(`任务 ${name} 执行出错:`, error);
    } finally {
      task.isRunning = false;
    }
  }

  private startTask(name: string): void {
    const task = this.tasks.get(name);
    if (!task) {
      return;
    }

    // 立即执行一次
    this.executeTask(name);

    // 设置定时器
    const intervalId = setInterval(() => {
      this.executeTask(name);
    }, task.interval);

    this.intervals.set(name, intervalId);
    logger.info(`任务 ${name} 已启动`);
  }

  private stopTask(name: string): void {
    const intervalId = this.intervals.get(name);
    if (intervalId) {
      clearInterval(intervalId);
      this.intervals.delete(name);
      logger.info(`任务 ${name} 已停止`);
    }
  }

  /**
   * 获取任务状态
   */
  getTaskStatus(): Array<{
    name: string;
    lastRun?: Date;
    isRunning: boolean;
    interval: number;
  }> {
    return Array.from(this.tasks.entries()).map(([name, task]) => ({
      name,
      lastRun: task.lastRun,
      isRunning: task.isRunning,
      interval: task.interval
    }));
  }
}
