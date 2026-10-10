const app = require('./app');
const config = require('./config/env');
const { sequelize } = require('./models');
const { logger } = require('./utils/logger');
const { warmDummyHash } = require('./services/authService');

async function start() {
  await sequelize.authenticate();
  await sequelize.sync();
  await warmDummyHash();

  const server = app.listen(config.port, () => {
    logger.info({ message: 'Сервер запущен', port: config.port, env: config.env });
  });

  async function shutdown() {
    server.close();
    await sequelize.close();
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start().catch((err) => {
  logger.error({ message: 'Не удалось запустить сервер', error: err.message, stack: err.stack });
  process.exit(1);
});
