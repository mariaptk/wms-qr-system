require('dotenv').config();

function readInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Переменная ${name} должна быть числом`);
  }
  return value;
}

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';
const isProd = env === 'production';

function readSecret(name, testFallback) {
  const value = process.env[name] || (isTest ? testFallback : '');
  if (!value || value.length < 32) {
    throw new Error(`${name} обязателен и должен быть не короче 32 символов`);
  }
  return value;
}

const accessSecret = readSecret('JWT_SECRET', 'test-access-secret-should-be-32-characters-min');
const refreshSecret = readSecret('JWT_REFRESH_SECRET', 'test-refresh-secret-should-be-32-characters');

if (accessSecret === refreshSecret) {
  throw new Error('JWT_SECRET и JWT_REFRESH_SECRET должны различаться');
}

const databaseUrl = isTest
  ? (process.env.TEST_DATABASE_URL || 'postgres://wms:wms@127.0.0.1:5432/wms_test')
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL обязателен');
}

module.exports = {
  env,
  isProd,
  isTest,
  port: readInt('PORT', 3000),
  databaseUrl,
  databaseSsl: process.env.DATABASE_SSL === 'true',
  trustProxy: process.env.TRUST_PROXY === 'true',
  jwt: {
    accessSecret,
    refreshSecret,
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlMs: readInt('JWT_REFRESH_TTL_MS', 7 * 24 * 60 * 60 * 1000),
    issuer: 'wms-api',
  },
  bcryptRounds: readInt('BCRYPT_ROUNDS', isTest ? 4 : 12),
  lock: {
    maxAttempts: 5,
    lockMs: 15 * 60 * 1000,
  },
  sessions: {
    maxPerUser: readInt('MAX_SESSIONS', 3),
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean),
  rateLimit: {
    windowMs: readInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: isTest ? 10000 : readInt('RATE_LIMIT_MAX', 100),
    authWindowMs: readInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    authMax: isTest ? 10000 : readInt('AUTH_RATE_LIMIT_MAX', 20),
    userWindowMs: readInt('USER_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    userMax: isTest ? 10000 : readInt('USER_RATE_LIMIT_MAX', 60),
  },
  bodyLimit: process.env.BODY_LIMIT || '100kb',
  cookies: {
    secure: isProd,
    sameSite: 'strict',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || '',
    name: process.env.ADMIN_NAME || 'Администратор',
  },
};
