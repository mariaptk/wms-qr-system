const { AuditLog } = require('../models');

async function writeAudit({ userId, action, entity, entityId, details, req }) {
  await AuditLog.create({
    userId: userId || null,
    action,
    entity,
    entityId: entityId ? String(entityId) : null,
    details: details || null,
    ip: req.ip,
    userAgent: (req.get('user-agent') || '').slice(0, 512) || null,
  });
}

module.exports = { writeAudit };
