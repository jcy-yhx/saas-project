import pino from 'pino';
import { config } from '../config/index.js';

export type Logger = pino.Logger;

export function createLogger(): Logger {
  return pino({
    level: config.isDev ? 'debug' : 'info',
    ...(config.isDev && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z' },
      },
    }),
  });
}
