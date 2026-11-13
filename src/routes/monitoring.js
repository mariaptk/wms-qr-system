const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../config/env');
const { asyncHandler } = require('../utils/asyncHandler');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter, monitoringLimiter } = require('../middleware/rateLimiters');
const metrics = require('../services/metrics');
const { checkDatabase } = require('../services/health');
const { isTelegramEnabled } = require('../services/telegram');
const { isLogtailEnabled } = require('../utils/logger');

const router = express.Router();
const statusPage = fs.readFileSync(path.join(__dirname, '../views/status.html'), 'utf8');

function release() {
  return { version: config.release.version, commit: config.release.commit, env: config.env };
}

router.use(['/health', '/metrics', '/status'], monitoringLimiter);

// UptimeRobot проверяет этот адрес: 503 при недоступной базе считается падением сервиса.
router.get('/health', asyncHandler(async (_req, res) => {
  const db = await checkDatabase();
  const ok = db.status === 'ok';
  res.set('Cache-Control', 'no-store');
  res.status(ok ? 200 : 503).json({
    data: {
      status: ok ? 'ok' : 'degraded',
      db: db.status,
      uptimeSeconds: Math.round(process.uptime()),
      time: new Date().toISOString(),
      ...release(),
    },
  });
}));

router.get('/metrics', asyncHandler(async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({
    data: {
      ...metrics.snapshot(),
      db: await checkDatabase(),
      release: release(),
      integrations: {
        sentry: Boolean(config.sentry.dsn),
        betterStack: isLogtailEnabled(),
        telegram: isTelegramEnabled(),
      },
    },
  });
}));

router.get('/status', (_req, res) => {
  res.type('html').send(statusPage);
});

// Проверка Sentry и уведомлений: необработанное исключение уходит в errorHandler, оттуда в Sentry и Telegram.
router.post(
  '/monitoring/test-error',
  authenticate,
  userLimiter,
  roleGuard('admin'),
  () => {
    throw new Error(`Тестовая ошибка мониторинга ${new Date().toISOString()}`);
  },
);
module.exports = router;
