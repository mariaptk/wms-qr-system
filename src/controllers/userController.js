const { User, Session } = require('../models');
const { AppError } = require('../utils/errors');
const { toSafeUser, toAdminUser } = require('../utils/user');
const { logSecurity } = require('../utils/logger');
const { writeAudit } = require('../services/auditService');

async function list(req, res) {
  const { page, limit } = req.validQuery;
  const result = await User.findAndCountAll({
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  res.json({
    data: result.rows.map(toAdminUser),
    meta: { page, limit, total: result.count },
  });
}

async function getById(req, res) {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    logSecurity('forbidden_resource', {
      userId: req.user.id,
      targetUserId: req.params.id,
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
    });
    throw new AppError(403, 'Недостаточно прав для доступа к чужому ресурсу');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError(404, 'Пользователь не найден');

  res.json({ data: req.user.role === 'admin' ? toAdminUser(user) : toSafeUser(user) });
}

async function update(req, res) {
  if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
    logSecurity('forbidden_resource', {
      userId: req.user.id,
      targetUserId: req.params.id,
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
    });
    throw new AppError(403, 'Недостаточно прав для доступа к чужому ресурсу');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError(404, 'Пользователь не найден');

  user.name = req.body.name;
  await user.save();

  if (req.user.role === 'admin') {
    await writeAudit({
      userId: req.user.id,
      action: 'user.updated',
      entity: 'user',
      entityId: user.id,
      details: { name: user.name },
      req,
    });
  }

  res.json({ data: req.user.role === 'admin' ? toAdminUser(user) : toSafeUser(user) });
}

async function changeRole(req, res) {
  if (req.user.id === req.params.id) {
    throw new AppError(400, 'Нельзя изменить собственную роль');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError(404, 'Пользователь не найден');

  const previousRole = user.role;
  user.role = req.body.role;
  await user.save();

  await writeAudit({
    userId: req.user.id,
    action: 'user.role_changed',
    entity: 'user',
    entityId: user.id,
    details: { from: previousRole, to: user.role },
    req,
  });

  res.json({ data: toAdminUser(user) });
}

async function unlock(req, res) {
  const user = await User.unscoped().findByPk(req.params.id);
  if (!user) throw new AppError(404, 'Пользователь не найден');

  user.failedAttempts = 0;
  user.lockUntil = null;
  await user.save();

  await writeAudit({
    userId: req.user.id,
    action: 'user.unlocked',
    entity: 'user',
    entityId: user.id,
    req,
  });

  res.json({ data: toAdminUser(user) });
}

async function remove(req, res) {
  if (req.user.id === req.params.id) {
    throw new AppError(400, 'Нельзя удалить собственную учётную запись');
  }

  const user = await User.findByPk(req.params.id);
  if (!user) throw new AppError(404, 'Пользователь не найден');

  await Session.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null } });
  await user.destroy();

  await writeAudit({
    userId: req.user.id,
    action: 'user.deleted',
    entity: 'user',
    entityId: req.params.id,
    details: { email: user.email },
    req,
  });

  res.json({ data: { message: 'Пользователь удалён' } });
}

module.exports = {
  list,
  getById,
  update,
  changeRole,
  unlock,
  remove,
};
