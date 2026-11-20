const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|csrf|dsn|api[-_]?key/i;
const BEARER = /Bearer\s+[\w.~+/-]+=*/gi;
const JWT = /eyJ[\w-]+\.[\w-]+\.[\w-]+/g;
const MASK = '[скрыто]';

function redactString(value) {
  return value.replace(BEARER, `Bearer ${MASK}`).replace(JWT, MASK);
}

/**
 * Копия значения без паролей и токенов: по имени ключа и по виду строки (JWT, Bearer).
 * Используется перед записью в логи, Sentry и Telegram.
 */
function redact(value, depth = 0) {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object' || depth > 6) return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));

  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_KEY.test(key) ? MASK : redact(item, depth + 1);
  }
  return result;
}

module.exports = { redact, MASK, SENSITIVE_KEY };
