const { Op, fn, col, literal } = require('sequelize');
const { Product } = require('../models');
const { AppError } = require('../utils/errors');
const { logSecurity } = require('../utils/logger');
const { ROLE_RANK } = require('../constants/roles');
const { writeAudit } = require('../services/auditService');

const EDITABLE_FIELDS = ['sku', 'name', 'category', 'unit', 'price', 'weightKg', 'description', 'isActive'];

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function findProduct(id) {
  const product = await Product.findByPk(id);
  if (!product) throw new AppError(404, 'Товар не найден');
  return product;
}

async function assertSkuFree(sku, exceptId) {
  const where = { sku };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await Product.count({ where })) {
    throw new AppError(409, 'Товар с таким артикулом уже существует', [
      { field: 'sku', message: 'Артикул занят' },
    ]);
  }
}

/**
 * Менять карточку может её автор; старший смены и администратор — любую.
 */
function assertCanEdit(product, req) {
  const isAuthor = product.createdBy === req.user.id;
  if (isAuthor || ROLE_RANK[req.user.role] >= ROLE_RANK.moderator) return;

  logSecurity('forbidden_resource', {
    userId: req.user.id,
    role: req.user.role,
    resource: 'product',
    resourceId: product.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    requestId: req.id,
  });
  throw new AppError(403, 'Изменять товар может только его автор или администратор');
}

async function auditIfAdmin(req, action, product) {
  if (req.user.role !== 'admin') return;
  await writeAudit({
    userId: req.user.id,
    action,
    entity: 'product',
    entityId: product.id,
    details: { sku: product.sku, name: product.name },
    req,
  });
}

async function list(req, res) {
  const {
    page, limit, search, category, isActive, minPrice, maxPrice, sort, order,
  } = req.validQuery;
  const where = {};

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: pattern } },
      { sku: { [Op.iLike]: pattern } },
    ];
  }
  if (category) where.category = category;
  if (isActive !== undefined) where.isActive = isActive;
  if (minPrice !== undefined || maxPrice !== undefined) {
    where.price = {};
    if (minPrice !== undefined) where.price[Op.gte] = minPrice;
    if (maxPrice !== undefined) where.price[Op.lte] = maxPrice;
  }

  // sort и order уже проверены по белому списку, поэтому их можно подставить в ORDER BY.
  const result = await Product.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [[sort, order.toUpperCase()], ['id', 'ASC']],
  });

  res.json({
    data: result.rows,
    meta: {
      page,
      limit,
      total: result.count,
      pages: Math.ceil(result.count / limit),
      sort,
      order,
    },
  });
}

async function stats(_req, res) {
  const rows = await Product.findAll({
    attributes: [
      'category',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', literal('CASE WHEN "isActive" THEN 1 ELSE 0 END')), 'active'],
      [fn('AVG', col('price')), 'avgPrice'],
      [fn('MIN', col('price')), 'minPrice'],
      [fn('MAX', col('price')), 'maxPrice'],
    ],
    group: ['category'],
    order: [['category', 'ASC']],
    raw: true,
  });

  const round = (value) => Math.round(Number(value) * 100) / 100;
  const byCategory = rows.map((row) => ({
    category: row.category,
    count: Number(row.count),
    active: Number(row.active),
    avgPrice: round(row.avgPrice),
    minPrice: round(row.minPrice),
    maxPrice: round(row.maxPrice),
  }));

  const total = byCategory.reduce((sum, row) => sum + row.count, 0);
  const active = byCategory.reduce((sum, row) => sum + row.active, 0);
  const priceSum = rows.reduce((sum, row) => sum + Number(row.avgPrice) * Number(row.count), 0);

  res.json({
    data: {
      total,
      active,
      inactive: total - active,
      avgPrice: total ? round(priceSum / total) : 0,
      byCategory,
    },
  });
}

async function getById(req, res) {
  res.json({ data: await findProduct(req.params.id) });
}

async function create(req, res) {
  await assertSkuFree(req.body.sku);

  const product = await Product.create({
    sku: req.body.sku,
    name: req.body.name,
    category: req.body.category,
    unit: req.body.unit,
    price: req.body.price,
    weightKg: req.body.weightKg ?? null,
    description: req.body.description || null,
    isActive: req.body.isActive,
    createdBy: req.user.id,
  });

  await auditIfAdmin(req, 'product.created', product);
  res.status(201).json({ data: product });
}

async function replace(req, res) {
  const product = await findProduct(req.params.id);
  assertCanEdit(product, req);
  await assertSkuFree(req.body.sku, product.id);

  product.set({
    sku: req.body.sku,
    name: req.body.name,
    category: req.body.category,
    unit: req.body.unit,
    price: req.body.price,
    weightKg: req.body.weightKg ?? null,
    description: req.body.description || null,
    isActive: req.body.isActive,
  });
  await product.save();

  await auditIfAdmin(req, 'product.updated', product);
  res.json({ data: product });
}

async function update(req, res) {
  const product = await findProduct(req.params.id);
  assertCanEdit(product, req);
  if (req.body.sku !== undefined) await assertSkuFree(req.body.sku, product.id);

  for (const field of EDITABLE_FIELDS) {
    if (req.body[field] !== undefined) product[field] = req.body[field];
  }
  await product.save();

  await auditIfAdmin(req, 'product.updated', product);
  res.json({ data: product });
}

async function remove(req, res) {
  const product = await findProduct(req.params.id);

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

module.exports = {
  list, stats, getById, create, replace, update, remove,
};
