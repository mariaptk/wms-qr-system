const Sentry = require('./instrument');
const app = require('./app');
const config = require('./config/env');
const { sequelize } = require('./models');
const { syncSchema } = require('./config/schema');
const { logger, flushLogs } = require('./utils/logger');
const { warmDummyHash } = require('./services/authService');
const { notify } = require('./services/telegram');

const releaseLabel = `${config.release.version} (${config.release.commit.slice(0, 7)})`;

async function flushAll() {
  await Promise.allSettled([flushLogs(), Sentry.flush(2000)]);
}

async function start() {
  await sequelize.authenticate();
  await syncSchema();
  await warmDummyHash();

  const server = app.listen(config.port, () => {
    logger.info({
      message: 'Сервер запущен',
      port: config.port,
      env: config.env,
      version: config.release.version,
    });
    if (config.isProd) notify(`[СТАРТ] WMS API ${releaseLabel} запущен (${config.env})`);
  });

  async function shutdown(signal) {
    logger.info({ message: 'Сервер останавливается', signal });
    server.close();
    await sequelize.close();
    await flushAll();
    process.exit(0);
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Sentry сам перехватывает uncaughtException и unhandledRejection; здесь — журнал и Telegram.
process.on('unhandledRejection', (reason) => {
  logger.error({ message: 'Необработанный rejection', error: String(reason?.message || reason), stack: reason?.stack });
  notify(`[ОШИБКА] WMS API: необработанный rejection\n${String(reason?.message || reason)}`, { key: 'unhandledRejection' });
});

start().catch(async (err) => {
  logger.error({ message: 'Не удалось запустить сервер', error: err.message, stack: err.stack });
  Sentry.captureException(err);
  await notify(`[ПАДЕНИЕ] WMS API ${releaseLabel} не запустился: ${err.message}`);
  await flushAll();
  process.exit(1);
});
