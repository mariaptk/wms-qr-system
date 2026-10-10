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

function clearAuthCookies(res) {
  res.clearCookie('refreshToken', { path: '/auth' });
  res.clearCookie('csrf_token', { path: '/' });
}

module.exports = { setAuthCookies, clearAuthCookies };
