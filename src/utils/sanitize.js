const SENSITIVE_KEYS = new Set(['password', 'currentPassword', 'newPassword']);
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripHtml(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .trim();
}

/**
 * Удаляет HTML-теги из строк тела запроса.
 * Пароль не трогаем: спецсимволы в нём обязательны по политике сложности.
 */
function sanitize(value, key = '', depth = 0) {
  if (depth > 8) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, key, depth + 1));
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(childKey)) continue;
      const next = sanitize(childValue, childKey, depth + 1);
      if (next !== undefined) clean[childKey] = next;
    }
    return clean;
  }
  if (typeof value === 'string' && !SENSITIVE_KEYS.has(key)) {
    return stripHtml(value);
  }
  return value;
}

module.exports = { sanitize, stripHtml };
