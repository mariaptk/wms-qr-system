const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config/env');

function accessTtlSeconds(ttl = config.jwt.accessTtl) {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  const amount = Number(match[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[match[2]];
  return amount * unit;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeEqualString(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || left.length !== right.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(left), Buffer.from(right));
}

function signAccess(user, sessionId) {
  return jwt.sign(
    { sub: user.id, role: user.role, sid: sessionId },
    config.jwt.accessSecret,
    {
      expiresIn: config.jwt.accessTtl,
      issuer: config.jwt.issuer,
      algorithm: 'HS256',
      jwtid: crypto.randomUUID(),
    },
  );
}

function signRefresh(user, sessionId) {
  return jwt.sign(
    { sub: user.id, sid: sessionId, typ: 'refresh' },
    config.jwt.refreshSecret,
    {
      expiresIn: Math.floor(config.jwt.refreshTtlMs / 1000),
      issuer: config.jwt.issuer,
      algorithm: 'HS256',
      jwtid: crypto.randomUUID(),
    },
  );
}

function verifyAccess(token) {
  return jwt.verify(token, config.jwt.accessSecret, {
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  });
}

function verifyRefresh(token) {
  return jwt.verify(token, config.jwt.refreshSecret, {
    issuer: config.jwt.issuer,
    algorithms: ['HS256'],
  });
}

function newCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  accessTtlSeconds,
  hashToken,
  safeEqualString,
  signAccess,
  signRefresh,
  verifyAccess,
  verifyRefresh,
  newCsrfToken,
};
