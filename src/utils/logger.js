const fs = require('fs');
const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');
const config = require('../config/env');

const logsDir = path.join(process.cwd(), 'logs');

if (!config.isTest) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: 'info',
  format: jsonFormat,
  transports: [],
});

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

  if (!config.isProd) {
    logger.add(new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }));
  }
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
  securityEvents,
  clearSecurityEvents,
};
