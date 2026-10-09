const crypto = require('crypto');
const config = require('../config/env');
const { AppError } = require('../utils/errors');
const { sanitize } = require('../utils/sanitize');
const { safeEqualString } = require('../utils/tokens');
const { logSecurity } = require('../utils/logger');

const SQLI_PATTERN = /('|--|\/\*|\*\/|;|\b(union\s+select|insert\s+into|drop\s+table|alter\s+table|delete\s+from)\b|\bor\s+\d+\s*=\s*\d+)/i;

function requestId(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

/**
 * POST, PUT и PATCH принимают только JSON.
 * Это отсекает неожиданные разборы тела (form, text, xml).
 */
function requireJson(req, _res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const contentType = (req.get('content-type') || '').toLowerCase();
  if (!contentType.startsWith('application/json')) {
    return next(new AppError(415, 'Content-Type должен быть application/json'));
  }
  return next();
}

function sanitizeBody(req, _res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitize(req.body);
  }
  next();
}

/**
 * Дополнительная проверка query-параметров.
 * Основные запросы и так параметризованы Sequelize, это второй рубеж.
 */
function rejectSqlInjection(req, _res, next) {
  const values = [];
  for (const value of Object.values(req.query)) {
    if (Array.isArray(value)) values.push(...value);
    else values.push(value);
  }

  for (const value of values) {
    if (typeof value === 'string' && SQLI_PATTERN.test(value)) {
      logSecurity('sql_injection_attempt', {
        ip: req.ip,
        path: req.originalUrl,
        requestId: req.id,
      });
      return next(new AppError(400, 'Недопустимые параметры запроса'));
    }
  }

  return next();
}

/**
 * Double-submit cookie: значение cookie csrf_token должно совпасть с заголовком X-CSRF-Token.
 * Нужно только там, где браузер сам прикладывает cookie (refresh и logout).
 */
function csrfGuard(req, _res, next) {
  const cookie = req.cookies?.csrf_token;
  const header = req.get('x-csrf-token');

  if (!cookie || !header || !safeEqualString(cookie, header)) {
    logSecurity('csrf_rejected', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
    });
    return next(new AppError(403, 'CSRF-токен отсутствует или неверен'));
  }

  return next();
}

function enforceCorsWhitelist(req, _res, next) {
  const origin = req.get('origin');
  if (origin && !config.corsOrigins.includes(origin)) {
    logSecurity('cors_rejected', {
      origin,
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
    });
    return next(new AppError(403, 'Origin не разрешён политикой CORS'));
  }
  return next();
}

module.exports = {
  requestId,
  requireJson,
  sanitizeBody,
  rejectSqlInjection,
  csrfGuard,
  enforceCorsWhitelist,
  SQLI_PATTERN,
};
