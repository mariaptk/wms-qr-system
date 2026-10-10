const { Op } = require('sequelize');
const { Product } = require('../models');
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
      { name: { [Op.iLike]: pattern } },
      { sku: { [Op.iLike]: pattern } },
    ];
  }

  const result = await Product.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [['createdAt', 'DESC']],
  });

  res.json({
    data: result.rows,
    meta: { page, limit, total: result.count },
  });
}

async function getById(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) throw new AppError(404, 'Товар не найден');
  res.json({ data: product });
}

async function create(req, res) {
  const product = await Product.create({
    sku: req.body.sku,
    name: req.body.name,
    unit: req.body.unit,
    description: req.body.description || null,
    isActive: req.body.isActive,
    createdBy: req.user.id,
  });

  if (req.user.role === 'admin') {
    await writeAudit({
      userId: req.user.id,
      action: 'product.created',
      entity: 'product',
      entityId: product.id,
      details: { sku: product.sku, name: product.name },
      req,
    });
  }

  res.status(201).json({ data: product });
}

async function update(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) throw new AppError(404, 'Товар не найден');

  const fields = ['sku', 'name', 'unit', 'description', 'isActive'];
  for (const field of fields) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }
  await product.save();

  if (req.user.role === 'admin') {
    await writeAudit({
      userId: req.user.id,
      action: 'product.updated',
      entity: 'product',
      entityId: product.id,
      details: { sku: product.sku },
      req,
    });
  }

  res.json({ data: product });
}

async function remove(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) throw new AppError(404, 'Товар не найден');

  const snapshot = { sku: product.sku, name: product.name };
  await product.destroy();

  await writeAudit({
    userId: req.user.id,
    action: 'product.deleted',
    entity: 'product',
    entityId: req.params.id,
    details: snapshot,
    req,
  });

  res.json({ data: { message: 'Товар удалён' } });
}

module.exports = { list, getById, create, update, remove };
