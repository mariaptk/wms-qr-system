const Sentry = require('@sentry/node');
const config = require('../config/env');
const { AppError, toClientError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const { notify } = require('../services/telegram');

function normalize(err) {
  if (err.type === 'entity.too.large' || err.status === 413) {
    return new AppError(413, 'Тело запроса слишком большое');
  }
  if (err.type === 'entity.parse.failed') {
    return new AppError(400, 'Некорректный JSON');
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    return new AppError(409, 'Запись с такими данными уже существует');
  }
  if (err.name === 'SequelizeValidationError') {
    return new AppError(400, 'Ошибка валидации данных');
  }
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return new AppError(400, 'Связанная запись не найдена');
  }
  return err;
}

/**
 * Клиенту не отдаём стек, SQL и внутренние имена.
 * В production текст непредвиденной ошибки всегда один и тот же.
 */
function errorHandler(err, req, res, _next) {
  const normalized = normalize(err);
  const client = toClientError(normalized, config.isProd);
  const record = {
    message: err.message,
    name: err.name,
    statusCode: client.statusCode,
    path: req.originalUrl,
    method: req.method,
    requestId: req.id,
  };

  if (!normalized.isOperational || client.statusCode >= 500) {
    logger.error({ ...record, stack: err.stack });
    const eventId = Sentry.captureException(err, {
      tags: { requestId: req.id, route: `${req.method} ${req.baseUrl}${req.route?.path || req.path}` },
      user: req.user ? { id: req.user.id, role: req.user.role } : undefined,
    });
    notify(
      `[ОШИБКА] WMS API: код ${client.statusCode}\n${req.method} ${req.originalUrl.split('?')[0]}\n${err.name}: ${err.message}\nrequestId: ${req.id}${eventId && config.sentry.dsn ? `\nSentry: ${eventId}` : ''}`,
      { key: `error:${req.method}:${req.route?.path || req.path}:${err.message.slice(0, 60)}` },
    );
  } else {
    logger.info(record);
  }

  res.status(client.statusCode).json(client.body);
}

function notFound(req, _res, next) {
  next(new AppError(404, 'Маршрут не найден'));
}

module.exports = { errorHandler, notFound };
