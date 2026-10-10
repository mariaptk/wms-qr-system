const { User, Session } = require('../models');
const { AppError } = require('../utils/errors');
const { verifyAccess } = require('../utils/tokens');
const { logSecurity } = require('../utils/logger');

/**
 * Требует Authorization: Bearer <access JWT>.
 * Роль берётся из базы, а не из токена, чтобы смена роли действовала сразу.
 * Отозванная сессия гасит и ещё не истёкший access-токен.
 */
async function authenticate(req, _res, next) {
  const header = req.get('authorization') || '';
  const match = header.match(/^Bearer\s+(\S+)$/i);

  if (!match) {
    return next(new AppError(401, 'Требуется аутентификация'));
  }

  let payload;
  try {
    payload = verifyAccess(match[1]);
  } catch (err) {
    logSecurity('invalid_token', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      reason: err.name,
    });
    return next(new AppError(401, 'Токен недействителен или истёк'));
  }

  const user = await User.findByPk(payload.sub);
  if (!user) {
    return next(new AppError(401, 'Требуется аутентификация'));
  }

  const session = await Session.findByPk(payload.sid);
  const sessionAlive = session
    && !session.revokedAt
    && session.expiresAt > new Date()
    && session.userId === user.id;

  if (!sessionAlive) {
    logSecurity('revoked_session', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      userId: user.id,
    });
    return next(new AppError(401, 'Сессия недействительна'));
  }

  req.user = user;
  req.sessionId = session.id;
  return next();
}

module.exports = { authenticate };
