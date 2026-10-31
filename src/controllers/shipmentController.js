const crypto = require('crypto');
const QRCode = require('qrcode');
const { Op, fn, col } = require('sequelize');
const { Shipment } = require('../models');
const { AppError } = require('../utils/errors');
const { logSecurity } = require('../utils/logger');
const { ROLE_RANK } = require('../constants/roles');
const {
  SHIPMENT_STATUSES,
  SHIPMENT_TRANSITIONS,
  SHIPMENT_OPEN_STATUSES,
} = require('../constants/shipments');
const { today } = require('../utils/dates');
const { writeAudit } = require('../services/auditService');

const EDITABLE_FIELDS = [
  'orderNumber',
  'customerName',
  'deliveryAddress',
  'plannedDate',
  'packagesCount',
  'totalWeightKg',
  'carrier',
  'comment',
];

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function newQrCode() {
  return `SHP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

async function findShipment(id) {
  const shipment = await Shipment.findByPk(id);
  if (!shipment) throw new AppError(404, 'Отгрузка не найдена');
  return shipment;
}

async function assertOrderNumberFree(orderNumber, exceptId) {
  const where = { orderNumber };
  if (exceptId) where.id = { [Op.ne]: exceptId };
  if (await Shipment.count({ where })) {
    throw new AppError(409, 'Отгрузка с таким номером заказа уже существует', [
      { field: 'orderNumber', message: 'Номер заказа занят' },
    ]);
  }
}

/**
 * Менять карточку может её автор; старший смены и администратор — любую.
 */
function assertCanEdit(shipment, req) {
  const isAuthor = shipment.createdBy === req.user.id;
  if (isAuthor || ROLE_RANK[req.user.role] >= ROLE_RANK.moderator) return;

  logSecurity('forbidden_resource', {
    userId: req.user.id,
    role: req.user.role,
    resource: 'shipment',
    resourceId: shipment.id,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    requestId: req.id,
  });
  throw new AppError(403, 'Изменять отгрузку может только её автор или администратор');
}

async function list(req, res) {
  const {
    page, limit, search, status, plannedFrom, plannedTo, sort, order,
  } = req.validQuery;
  const where = {};

  if (search) {
    const pattern = `%${escapeLike(search)}%`;
    where[Op.or] = [
      { orderNumber: { [Op.iLike]: pattern } },
      { customerName: { [Op.iLike]: pattern } },
      { deliveryAddress: { [Op.iLike]: pattern } },
    ];
  }
  if (status) where.status = status;
  if (plannedFrom || plannedTo) {
    where.plannedDate = {};
    if (plannedFrom) where.plannedDate[Op.gte] = plannedFrom;
    if (plannedTo) where.plannedDate[Op.lte] = plannedTo;
  }

  // sort и order уже проверены по белому списку, поэтому их можно подставить в ORDER BY.
  const result = await Shipment.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: [[sort, order.toUpperCase()], ['createdAt', 'ASC'], ['id', 'ASC']],
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
  const rows = await Shipment.findAll({
    attributes: [
      'status',
      [fn('COUNT', col('id')), 'count'],
      [fn('SUM', col('packagesCount')), 'packages'],
      [fn('SUM', col('totalWeightKg')), 'weightKg'],
    ],
    group: ['status'],
    raw: true,
  });

  const byStatus = Object.fromEntries(SHIPMENT_STATUSES.map((status) => [status, 0]));
  let total = 0;
  let packages = 0;
  let weightKg = 0;
  for (const row of rows) {
    const count = Number(row.count);
    byStatus[row.status] = count;
    total += count;
    if (row.status !== 'cancelled') {
      packages += Number(row.packages || 0);
      weightKg += Number(row.weightKg || 0);
    }
  }

  const date = today();
  const open = { [Op.in]: SHIPMENT_OPEN_STATUSES };
  const [overdue, plannedToday] = await Promise.all([
    Shipment.count({ where: { status: open, plannedDate: { [Op.lt]: date } } }),
    Shipment.count({ where: { status: open, plannedDate: date } }),
  ]);

  res.json({
    data: {
      total,
      byStatus,
      plannedToday,
      overdue,
      packages,
      weightKg: Math.round(weightKg * 1000) / 1000,
    },
  });
}

async function getById(req, res) {
  res.json({ data: await findShipment(req.params.id) });
}

async function scan(req, res) {
  const shipment = await Shipment.findOne({ where: { qrCode: req.params.code } });
  if (!shipment) throw new AppError(404, 'Отгрузка с таким QR-кодом не найдена');
  res.json({ data: shipment });
}

async function qrImage(req, res) {
  const shipment = await findShipment(req.params.id);
  const options = { errorCorrectionLevel: 'M', margin: 2, width: 300 };

  if (req.validQuery.format === 'svg') {
    res.type('image/svg+xml').send(await QRCode.toString(shipment.qrCode, { ...options, type: 'svg' }));
    return;
  }
  res.type('image/png').send(await QRCode.toBuffer(shipment.qrCode, options));
}

async function create(req, res) {
  await assertOrderNumberFree(req.body.orderNumber);
  const shipment = await Shipment.create({
    ...req.body,
    status: 'new',
    qrCode: newQrCode(),
    createdBy: req.user.id,
  });
  res.status(201).json({ data: shipment });
}

async function replace(req, res) {
  const shipment = await findShipment(req.params.id);
  assertCanEdit(shipment, req);
  if (!SHIPMENT_OPEN_STATUSES.includes(shipment.status)) {
    throw new AppError(409, `Отгрузку в статусе ${shipment.status} изменить нельзя`);
  }
  await assertOrderNumberFree(req.body.orderNumber, shipment.id);

  for (const field of EDITABLE_FIELDS) {
    shipment[field] = req.body[field] ?? null;
  }
  await shipment.save();
  res.json({ data: shipment });
}

async function changeStatus(req, res) {
  const shipment = await findShipment(req.params.id);
  const from = shipment.status;
  const to = req.body.status;
  const allowed = SHIPMENT_TRANSITIONS[from];

  if (!allowed.includes(to)) {
    throw new AppError(409, `Нельзя перевести отгрузку из статуса ${from} в ${to}`, { from, to, allowed });
  }

  shipment.status = to;
  if (to === 'shipped') shipment.shippedAt = new Date();
  await shipment.save();
  res.json({ data: shipment });
}

async function remove(req, res) {
  const shipment = await findShipment(req.params.id);
  await shipment.destroy();
  await writeAudit({
    userId: req.user.id,
    action: 'shipment.deleted',
    entity: 'shipment',
    entityId: shipment.id,
    details: { orderNumber: shipment.orderNumber, status: shipment.status },
    req,
  });
  res.json({ data: { message: 'Отгрузка удалена' } });
}

module.exports = {
  list,
  stats,
  getById,
  scan,
  qrImage,
  create,
  replace,
  changeStatus,
  remove,
};
