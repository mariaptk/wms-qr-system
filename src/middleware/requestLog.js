const metrics = require('../services/metrics');
const { logger } = require('../utils/logger');

// Служебные адреса опрашиваются UptimeRobot и страницей метрик каждые несколько секунд и засорили бы журнал.
const QUIET_PATHS = new Set(['/health', '/metrics', '/status']);

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const QR_CODE = /SHP-[0-9A-F]{16}/gi;

// К моменту ответа Express уже сбросил req.baseUrl, поэтому шаблон строится по самому пути.
function routeTemplate(url) {
  const pathname = url.split('?')[0].replace(UUID, ':id').replace(QR_CODE, ':code');
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

/**
 * Считает запросы для /metrics и пишет одну строку журнала на каждый запрос.
 * Маршрут берётся шаблоном (/shipments/:id), чтобы в метриках не копились отдельные id.
 */
function requestLog(req, res, next) {
  const started = process.hrtime.bigint();
  metrics.requestStarted();

  let done = false;
  function finish() {
    if (done) return;
    done = true;
    metrics.requestFinished();

    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const route = req.route ? `${req.method} ${routeTemplate(req.originalUrl)}` : null;
    metrics.recordRequest({
      method: req.method,
      route,
      statusCode: res.statusCode,
      durationMs,
    });

    if (QUIET_PATHS.has(req.path) && res.statusCode < 400) return;

    const record = {
      message: res.statusCode >= 400 ? 'Неуспешный запрос' : 'Запрос обработан',
      type: 'http',
      method: req.method,
      path: req.originalUrl.split('?')[0],
      route,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      requestId: req.id,
      userId: req.user?.id,
      ip: req.ip,
    };
    if (res.statusCode >= 500) logger.error(record);
    else if (res.statusCode >= 400) logger.warn(record);
    else logger.info(record);
  }

  res.on('finish', finish);
  res.on('close', finish);
  next();
}

module.exports = { requestLog };
