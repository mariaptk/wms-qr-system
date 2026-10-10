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

module.exports = {
  buildLimiter,
  globalLimiter,
  authLimiter,
  userLimiter,
};
