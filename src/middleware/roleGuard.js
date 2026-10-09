const { ROLE_RANK } = require('../constants/roles');
const { AppError } = require('../utils/errors');
const { logSecurity } = require('../utils/logger');

/**
 * Пропускает пользователя, если его роль не ниже требуемой.
 * user < moderator < admin.
 * Отказ пишется в журнал подозрительных действий.
 */
function roleGuard(requiredRole) {
  if (!ROLE_RANK[requiredRole]) {
    throw new Error(`Неизвестная роль: ${requiredRole}`);
  }

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError(401, 'Требуется аутентификация'));
    }

    if (ROLE_RANK[req.user.role] < ROLE_RANK[requiredRole]) {
      logSecurity('forbidden_role', {
        userId: req.user.id,
        role: req.user.role,
        requiredRole,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        requestId: req.id,
      });
      return next(new AppError(403, 'Недостаточно прав'));
    }

    return next();
  };
}

module.exports = { roleGuard };
