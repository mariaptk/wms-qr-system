const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const config = require('../config/env');
const { User, Session } = require('../models');
const { AppError } = require('../utils/errors');
const { logSecurity } = require('../utils/logger');
const {
  hashToken,
  safeEqualString,
  signAccess,
  signRefresh,
  verifyRefresh,
  newCsrfToken,
  accessTtlSeconds,
} = require('../utils/tokens');

let dummyHash = null;

async function warmDummyHash() {
  if (!dummyHash) {
    dummyHash = await bcrypt.hash('not-a-real-password', config.bcryptRounds);
  }
  return dummyHash;
}

const LOCK_MESSAGE = 'Учётная запись временно заблокирована. Повторите попытку через 15 минут';

async function enforceSessionLimit(userId, ip) {
  const active = await Session.findAll({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'ASC']],
  });

  const max = config.sessions.maxPerUser;
  if (active.length < max) return;

  const overflow = active.slice(0, active.length - max + 1);
  for (const session of overflow) {
    session.revokedAt = new Date();
    await session.save();
  }

  logSecurity('session_limit', {
    userId,
    ip,
    revokedSessionIds: overflow.map((session) => session.id),
  });
}

async function register({ email, password, name }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const user = await User.create({
    email,
    passwordHash,
    name: name || null,
    role: 'user',
  });
  return user;
}

async function login({ email, password, ip, userAgent }) {
  const user = await User.unscoped().findOne({ where: { email } });

  if (user?.lockUntil && user.lockUntil > new Date()) {
    logSecurity('login_locked', { email, ip, userId: user.id });
    throw new AppError(423, LOCK_MESSAGE, { lockedUntil: user.lockUntil.toISOString() });
  }

  const hash = user?.passwordHash || await warmDummyHash();
  const passwordOk = await bcrypt.compare(password, hash);

  if (!user || !passwordOk) {
    if (user) {
      user.failedAttempts += 1;
      if (user.failedAttempts >= config.lock.maxAttempts) {
        user.lockUntil = new Date(Date.now() + config.lock.lockMs);
        user.failedAttempts = 0;
        await user.save();
        logSecurity('login_locked', { email, ip, userId: user.id, reason: 'max_attempts' });
        throw new AppError(423, LOCK_MESSAGE, { lockedUntil: user.lockUntil.toISOString() });
      }
      await user.save();
      logSecurity('login_failed', { email, ip, userId: user.id, failedAttempts: user.failedAttempts });
    } else {
      logSecurity('login_failed', { email, ip, reason: 'unknown_user' });
    }
    throw new AppError(401, 'Неверный email или пароль');
  }

  user.failedAttempts = 0;
  user.lockUntil = null;
  await user.save();

  await enforceSessionLimit(user.id, ip);

  const session = await Session.create({
    userId: user.id,
    tokenHash: crypto.randomBytes(32).toString('hex'),
    expiresAt: new Date(Date.now() + config.jwt.refreshTtlMs),
    ip,
    userAgent: userAgent?.slice(0, 512) || null,
  });

  const refreshToken = signRefresh(user, session.id);
  session.tokenHash = hashToken(refreshToken);
  await session.save();

  return {
    user,
    accessToken: signAccess(user, session.id),
    refreshToken,
    csrfToken: newCsrfToken(),
    expiresIn: accessTtlSeconds(),
  };
}

async function refresh({ rawToken, ip, userAgent }) {
  if (!rawToken) {
    throw new AppError(401, 'Refresh-токен отсутствует');
  }

  let payload;
  try {
    payload = verifyRefresh(rawToken);
  } catch {
    logSecurity('refresh_rejected', { ip, reason: 'invalid_token' });
    throw new AppError(401, 'Refresh-токен недействителен или истёк');
  }

  if (payload.typ !== 'refresh') {
    throw new AppError(401, 'Refresh-токен недействителен или истёк');
  }

  const session = await Session.findByPk(payload.sid);
  if (!session || session.userId !== payload.sub) {
    logSecurity('refresh_rejected', { ip, reason: 'session_missing' });
    throw new AppError(401, 'Сессия недействительна');
  }

  const hashOk = safeEqualString(session.tokenHash, hashToken(rawToken));
  // Несовпадение хеша значит, что предъявили уже сменённый refresh: это повторное использование.
  if (!hashOk) {
    await Session.update(
      { revokedAt: new Date() },
      { where: { userId: session.userId, revokedAt: null } },
    );
    logSecurity('refresh_reuse', { userId: session.userId, ip, sessionId: session.id });
    throw new AppError(401, 'Сессия отозвана. Выполните вход заново');
  }

  if (session.revokedAt || session.expiresAt <= new Date()) {
    throw new AppError(401, 'Сессия недействительна');
  }

  const user = await User.unscoped().findByPk(session.userId);
  if (!user) {
    throw new AppError(401, 'Сессия недействительна');
  }

  const refreshToken = signRefresh(user, session.id);
  session.tokenHash = hashToken(refreshToken);
  session.expiresAt = new Date(Date.now() + config.jwt.refreshTtlMs);
  session.ip = ip;
  session.userAgent = userAgent?.slice(0, 512) || session.userAgent;
  await session.save();

  return {
    user,
    accessToken: signAccess(user, session.id),
    refreshToken,
    csrfToken: newCsrfToken(),
    expiresIn: accessTtlSeconds(),
  };
}

async function logout({ rawToken }) {
  if (!rawToken) return;
  try {
    const payload = verifyRefresh(rawToken);
    const session = await Session.findByPk(payload.sid);
    if (!session || session.revokedAt) return;
    if (!safeEqualString(session.tokenHash, hashToken(rawToken))) return;
    session.revokedAt = new Date();
    await session.save();
  } catch {
    // Недействительный токен на выходе не раскрываем.
  }
}

async function logoutAll(userId) {
  await Session.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } },
  );
}

module.exports = {
  warmDummyHash,
  register,
  login,
  refresh,
  logout,
  logoutAll,
};
