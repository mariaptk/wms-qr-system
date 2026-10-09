const { Op } = require('sequelize');
const { StorageLocation } = require('../models');
const { AppError } = require('../utils/errors');
const { writeAudit } = require('../services/auditService');

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function list(req, res) {
  const { page, limit, search } = req.validQuery;
  const where = {};

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where[Op.or] = [
      { code: { [Op.iLike]: pattern } },
      { zone: { [Op.iLike]: pattern } },
    ];
  }

  const result = await StorageLocation.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [['code', 'ASC']],
  });

  res.json({
    data: result.rows,
    meta: { page, limit, total: result.count },
  });
}

async function getById(req, res) {
  const location = await StorageLocation.findByPk(req.params.id);
  if (!location) throw new AppError(404, 'Ячейка не найдена');
  res.json({ data: location });
}

async function create(req, res) {
  const location = await StorageLocation.create({
    code: req.body.code,
    zone: req.body.zone,
    description: req.body.description || null,
    isBlocked: req.body.isBlocked,
    createdBy: req.user.id,
  });

  if (req.user.role === 'admin') {
    await writeAudit({
      userId: req.user.id,
      action: 'location.created',
      entity: 'storage_location',
      entityId: location.id,
      details: { code: location.code, zone: location.zone },
      req,
    });
  }

  res.status(201).json({ data: location });
}

async function update(req, res) {
  const location = await StorageLocation.findByPk(req.params.id);
  if (!location) throw new AppError(404, 'Ячейка не найдена');

  const fields = ['code', 'zone', 'description', 'isBlocked'];
  for (const field of fields) {
    if (req.body[field] !== undefined) location[field] = req.body[field];
  }
  await location.save();

  if (req.user.role === 'admin') {
    await writeAudit({
      userId: req.user.id,
      action: 'location.updated',
      entity: 'storage_location',
      entityId: location.id,
      details: { code: location.code },
      req,
    });
  }

  res.json({ data: location });
}

async function remove(req, res) {
  const location = await StorageLocation.findByPk(req.params.id);
  if (!location) throw new AppError(404, 'Ячейка не найдена');

  const snapshot = { code: location.code, zone: location.zone };
  await location.destroy();

  await writeAudit({
    userId: req.user.id,
    action: 'location.deleted',
    entity: 'storage_location',
    entityId: req.params.id,
    details: snapshot,
    req,
  });

  res.json({ data: { message: 'Ячейка удалена' } });
}

module.exports = { list, getById, create, update, remove };
