const ROLES = Object.freeze({
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
});

// Старшая роль включает права младших: admin проходит проверки moderator и user.
const ROLE_RANK = Object.freeze({
  user: 1,
  moderator: 2,
  admin: 3,
});

module.exports = { ROLES, ROLE_RANK };
