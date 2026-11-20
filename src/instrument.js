// Подключается первой строкой server.js: SDK Sentry должен загрузиться раньше Express.
const Sentry = require('@sentry/node');
const config = require('./config/env');
const { redact } = require('./utils/redact');

function redactBody(data) {
  if (typeof data !== 'string') return redact(data);
  try {
    return JSON.stringify(redact(JSON.parse(data)));
  } catch {
    return redact(data);
  }
}

if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.sentry.environment,
    release: `wms-api@${config.release.version}+${config.release.commit.slice(0, 7)}`,
    tracesSampleRate: config.sentry.tracesSampleRate,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        event.request.headers = redact(event.request.headers || {});
        if (event.request.data) event.request.data = redactBody(event.request.data);
        if (typeof event.request.query_string === 'string') {
          event.request.query_string = redact(event.request.query_string);
        }
      }
      if (event.extra) event.extra = redact(event.extra);
      return event;
    },
  });
}

module.exports = Sentry;
