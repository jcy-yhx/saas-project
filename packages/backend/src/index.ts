import { createApp } from './app.js';
import { config, getPrisma, getLogger } from './config/index.js';

const logger = getLogger();

async function main() {
  // Verify database connection
  try {
    const prisma = getPrisma();
    await prisma.$connect();
    logger.info('Database connected');
  } catch (err) {
    logger.error(err, 'Failed to connect to database');
    process.exit(1);
  }

  const app = createApp();

  app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
  });
}

main().catch((err) => {
  logger.error(err, 'Failed to start server');
  process.exit(1);
});
