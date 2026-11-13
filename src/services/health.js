const { sequelize } = require('../config/database');

async function checkDatabase(timeoutMs = 3000) {
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

module.exports = { checkDatabase };
