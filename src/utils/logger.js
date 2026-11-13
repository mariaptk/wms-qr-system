const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const { Logtail } = require('@logtail/node');
const { LogtailTransport } = require('@logtail/winston');
const config = require('../config/env');
const { redact, MASK, SENSITIVE_KEY } = require('./redact');

const logsDir = path.join(process.cwd(), 'logs');

if (!config.isTest) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Меняет info на месте: winston хранит служебные поля под Symbol-ключами, копия их потеряет.
const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (key === 'level') continue;
    info[key] = SENSITIVE_KEY.test(key) ? MASK : redact(info[key]);
  }
  return info;
});

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  redactFormat(),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  defaultMeta: { service: 'wms-api', env: config.env, commit: config.release.commit },
  transports: [],
});

let logtail = null;

if (config.isTest) {
  logger.add(new winston.transports.Console({ silent: true }));
} else {
  logger.add(new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'error',
    maxSize: '20m',
    maxFiles: '14d',
  }));
  logger.add(new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'combined-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
  }));
  logger.add(new winston.transports.DailyRotateFile({
    filename: path.join(logsDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    level: 'warn',
    maxSize: '20m',
    maxFiles: '30d',
    format: winston.format.combine(
      winston.format((info) => (info.type === 'security' ? info : false))(),
      jsonFormat,
    ),
  }));

  // На Render файловая система временная, поэтому в production логи идут ещё и в stdout (вкладка Logs).
  logger.add(new winston.transports.Console({
    format: config.isProd
      ? jsonFormat
      : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }));

  const { sourceToken, ingestingHost } = config.betterStack;
  if (sourceToken && ingestingHost) {
    logtail = new Logtail(sourceToken, { endpoint: `https://${ingestingHost}` });
    logger.add(new LogtailTransport(logtail, { format: jsonFormat }));
  }
}

async function flushLogs() {
  if (logtail) await logtail.flush();
}

const securityEvents = [];

function logSecurity(event, meta = {}) {
  const entry = {
    level: 'warn',
    type: 'security',
    event,
    message: event,
    ...meta,
  };
  if (config.isTest) securityEvents.push({ ...entry, timestamp: new Date().toISOString() });
  logger.warn(entry);
}

function clearSecurityEvents() {
  securityEvents.length = 0;
}

module.exports = {
  logger,
  logSecurity,
  flushLogs,
  isLogtailEnabled: () => Boolean(logtail),
  securityEvents,
  clearSecurityEvents,
};
