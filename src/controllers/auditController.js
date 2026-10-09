const { AuditLog } = require('../models');

async function list(req, res) {
  const { page, limit } = req.validQuery;
  const result = await AuditLog.findAndCountAll({
    order: [['createdAt', 'DESC']],
    limit,
    offset: (page - 1) * limit,
  });

  res.json({
    data: result.rows,
    meta: { page, limit, total: result.count },
  });
}

module.exports = { list };
