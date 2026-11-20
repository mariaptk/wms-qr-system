const rateLimit = require('express-rate-limit');
const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { logSecurity } = require('../utils/logger');

/**
 * Общий ограничитель. Срабатывание считается массовыми запросами и пишется в журнал.
 */
function buildLimiter({ windowMs, max, event, keyGenerator }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    handler(req, _res, next) {
      logSecurity(event, {
        ip: req.ip,
        userId: req.user?.id,
        path: req.originalUrl,
        requestId: req.id,
      });
      next(new AppError(429, 'Слишком много запросов. Повторите позже'));
    },
  });
}

const globalLimiter = buildLimiter({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  event: 'rate_limit_global',
});

const authLimiter = buildLimiter({
  windowMs: config.rateLimit.authWindowMs,
  max: config.rateLimit.authMax,
  event: 'rate_limit_auth',
});

const userLimiter = buildLimiter({
  windowMs: config.rateLimit.userWindowMs,
  max: config.rateLimit.userMax,
  event: 'rate_limit_user',
  keyGenerator: (req) => req.user?.id || 'anonymous',
});

// Служебные адреса опрашиваются часто (страница метрик раз в 5 секунд), поэтому у них свой лимит.
const monitoringLimiter = buildLimiter({
  windowMs: 60 * 1000,
  max: config.isTest ? 10000 : 120,
  event: 'rate_limit_monitoring',
});

module.exports = {
  buildLimiter,
  globalLimiter,
  monitoringLimiter,
  authLimiter,
  userLimiter,
};
