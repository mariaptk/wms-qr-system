const { sequelize } = require('../config/database');
const config = require('../config/env');

let cached = null;
let pending = null;

async function queryDatabase(timeoutMs) {
  const started = Date.now();
  let timer;
  try {
    await Promise.race([
      sequelize.query('SELECT 1'),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
      }),
    ]);
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (err) {
    return { status: 'down', latencyMs: Date.now() - started, error: err.message === 'timeout' ? 'timeout' : 'unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Проверка базы с кешем. Neon на бесплатном тарифе засыпает после 5 минут без запросов и даёт
 * 100 вычислительных часов в месяц: проверка при каждом обращении UptimeRobot и heartbeat
 * не дала бы базе уснуть и исчерпала бы лимит. Неудачная проверка не кешируется.
 */
async function checkDatabase({ timeoutMs = 3000 } = {}) {
  const maxAge = config.healthDbCacheMs;
  if (cached && cached.status === 'ok' && Date.now() - cached.checkedAt < maxAge) {
    return { ...cached.result, cached: true };
  }
  if (!pending) {
    pending = queryDatabase(timeoutMs).then((result) => {
      cached = { status: result.status, result: { ...result, checkedAt: new Date().toISOString() }, checkedAt: Date.now() };
      return cached.result;
    }).finally(() => {
      pending = null;
    });
  }
  return { ...(await pending), cached: false };
}

module.exports = { checkDatabase };
