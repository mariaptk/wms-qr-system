function toSafeUser(user) {
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return {
    id: plain.id,
    email: plain.email,
    role: plain.role,
    name: plain.name,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

function toAdminUser(user) {
  const plain = typeof user.get === 'function' ? user.get({ plain: true }) : user;
  return {
    ...toSafeUser(plain),
    failedAttempts: plain.failedAttempts,
    lockUntil: plain.lockUntil,
  };
}

module.exports = { toSafeUser, toAdminUser };
