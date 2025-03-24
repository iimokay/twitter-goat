import pino from 'pino';

const pinoLogger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname'
    }
  },
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
});

interface LogMessage {
  msg: string;
  error?: {
    message: string;
    stack?: string;
  };
}

// 为了保持与原有接口兼容，我们封装一下 pino 的方法
class Logger {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  info(message: string, ...args: any[]): void {
    pinoLogger.info(this.formatMessage(message, ...args));
  }

  warn(message: string, ...args: any[]): void {
    pinoLogger.warn(this.formatMessage(message, ...args));
  }

  error(message: string, ...args: any[]): void {
    pinoLogger.error(this.formatMessage(message, ...args));
  }

  private formatMessage(message: string, ...args: any[]): LogMessage {
    if (args.length === 0) {
      return { msg: message };
    }

    // 如果只有一个参数且是错误对象，则特殊处理
    if (args.length === 1 && args[0] instanceof Error) {
      return {
        msg: message,
        error: {
          message: args[0].message,
          stack: args[0].stack
        }
      };
    }

    // 处理其他参数
    const formattedArgs = args
      .map((arg) => (typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg))
      .join(' ');

    return {
      msg: `${message} ${formattedArgs}`.trim()
    };
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export const logger = new Logger();
