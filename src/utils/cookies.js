const config = require('../config/env');

function setAuthCookies(res, refreshToken, csrfToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/auth',
    maxAge: config.jwt.refreshTtlMs,
  });
  res.cookie('csrf_token', csrfToken, {
    httpOnly: false,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite,
    path: '/',
    maxAge: config.jwt.refreshTtlMs,
  });
}

// Атрибуты должны совпадать с установкой: иначе при SameSite=None браузер не примет удаление cookie.
function clearAuthCookies(res) {
  const options = { secure: config.cookies.secure, sameSite: config.cookies.sameSite };
  res.clearCookie('refreshToken', { ...options, httpOnly: true, path: '/auth' });
  res.clearCookie('csrf_token', { ...options, path: '/' });
}

module.exports = { setAuthCookies, clearAuthCookies };
