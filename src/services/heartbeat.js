const config = require('../config/env');
const { checkDatabase } = require('./health');
const { logger } = require('../utils/logger');

let timer = null;

/**
 * Сигнал «жив» для Healthchecks.io. Если сигналы перестают приходить (сервер упал или завис),
 * Healthchecks.io по истечении периода и grace time шлёт уведомление в Telegram.
 * При недоступной базе уходит явный /fail — тревога без ожидания.
 */
async function beat() {
  const db = await checkDatabase();
  const url = db.status === 'ok' ? config.healthchecks.pingUrl : `${config.healthchecks.pingUrl}/fail`;
  try {
    await fetch(url, {
      method: 'POST',
      body: `db=${db.status} latencyMs=${db.latencyMs} uptime=${Math.round(process.uptime())}s commit=${config.release.commit.slice(0, 7)}`,
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    logger.warn({ message: 'Healthchecks.io недоступен', error: err.message });
  }
}

function startHeartbeat() {
  if (!config.healthchecks.pingUrl || timer) return false;
  beat();
  timer = setInterval(beat, config.healthchecks.intervalMs);
  timer.unref();
  return true;
}

function stopHeartbeat() {
  clearInterval(timer);
  timer = null;
}

function isHeartbeatEnabled() {
  return Boolean(config.healthchecks.pingUrl);
}

module.exports = { startHeartbeat, stopHeartbeat, isHeartbeatEnabled };
