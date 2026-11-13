const config = require('../config/env');
const { redact } = require('../utils/redact');

const lastSent = new Map();

function isTelegramEnabled() {
  return Boolean(config.telegram.botToken && config.telegram.chatId);
}

/**
 * Отправляет сообщение в чат уведомлений. Одинаковые сообщения (по ключу)
 * уходят не чаще раза в TELEGRAM_ALERT_INTERVAL_MS, чтобы поток ошибок не заспамил чат.
 * Ошибки отправки не пробрасываются: уведомление не должно ронять запрос.
 */
async function notify(text, { key } = {}) {
  if (!isTelegramEnabled()) return false;

  const now = Date.now();
  if (key) {
    const previous = lastSent.get(key);
    if (previous && now - previous < config.telegram.alertIntervalMs) return false;
    lastSent.set(key, now);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: config.telegram.chatId,
        text: redact(text).slice(0, 4000),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

module.exports = { notify, isTelegramEnabled };
