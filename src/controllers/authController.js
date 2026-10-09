const { Session } = require('../models');
const authService = require('../services/authService');
const { toSafeUser } = require('../utils/user');
const { setAuthCookies, clearAuthCookies } = require('../utils/cookies');

function tokenResponse(result) {
  return {
    accessToken: result.accessToken,
    tokenType: 'Bearer',
    expiresIn: result.expiresIn,
    csrfToken: result.csrfToken,
    user: toSafeUser(result.user),
  };
}

async function register(req, res) {
  const user = await authService.register({
    email: req.body.email,
    password: req.body.password,
    name: req.body.name,
  });
  res.status(201).json({ data: toSafeUser(user) });
}

async function login(req, res) {
  const result = await authService.login({
    email: req.body.email,
    password: req.body.password,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  setAuthCookies(res, result.refreshToken, result.csrfToken);
  res.json({ data: tokenResponse(result) });
}

function me(req, res) {
  res.json({ data: toSafeUser(req.user) });
}

async function refresh(req, res) {
  const result = await authService.refresh({
    rawToken: req.cookies?.refreshToken,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  setAuthCookies(res, result.refreshToken, result.csrfToken);
  res.json({ data: tokenResponse(result) });
}

async function logout(req, res) {
  await authService.logout({ rawToken: req.cookies?.refreshToken });
  clearAuthCookies(res);
  res.json({ data: { message: 'Выход выполнен' } });
}

async function logoutAll(req, res) {
  await authService.logoutAll(req.user.id);
  clearAuthCookies(res);
  res.json({ data: { message: 'Все сессии завершены' } });
}

async function sessions(req, res) {
  const rows = await Session.findAll({
    where: { userId: req.user.id, revokedAt: null },
    attributes: ['id', 'ip', 'userAgent', 'createdAt', 'expiresAt'],
    order: [['createdAt', 'DESC']],
  });

  res.json({
    data: rows.map((row) => ({
      id: row.id,
      ip: row.ip,
      userAgent: row.userAgent,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      current: row.id === req.sessionId,
    })),
  });
}

module.exports = {
  register,
  login,
  me,
  refresh,
  logout,
  logoutAll,
  sessions,
};
