const Joi = require('joi');
const { idParams, paginationQuery } = require('./common');
const { SHIPMENT_STATUSES, SHIPMENT_SORT_FIELDS } = require('../constants/shipments');
const { today } = require('../utils/dates');

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const dateOnly = Joi.string().pattern(DATE_PATTERN).custom((value, helpers) => (
  isRealDate(value) ? value : helpers.error('date.invalid')
)).messages({
  'string.pattern.base': 'Дата в формате ГГГГ-ММ-ДД',
  'date.invalid': 'Такой даты не существует',
});

const plannedDate = dateOnly.custom((value, helpers) => (
  value < today() ? helpers.error('date.past') : value
)).messages({
  'date.past': 'Плановая дата отгрузки не может быть в прошлом',
  'any.required': 'Плановая дата обязательна',
});

const orderNumber = Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{2,31}$/).messages({
  'string.pattern.base': 'Номер заказа: 3–32 символа, латиница, цифры и дефис',
  'string.empty': 'Номер заказа обязателен',
  'any.required': 'Номер заказа обязателен',
});

const customerName = Joi.string().trim().min(2).max(200).messages({
  'string.empty': 'Получатель обязателен',
  'string.min': 'Получатель не короче 2 символов',
  'string.max': 'Получатель не длиннее 200 символов',
  'any.required': 'Получатель обязателен',
});

const deliveryAddress = Joi.string().trim().min(5).max(500).messages({
  'string.empty': 'Адрес доставки обязателен',
  'string.min': 'Адрес доставки не короче 5 символов',
  'string.max': 'Адрес доставки не длиннее 500 символов',
  'any.required': 'Адрес доставки обязателен',
});

const packagesCount = Joi.number().integer().min(1).max(1000).messages({
  'number.base': 'Количество мест должно быть числом',
  'number.integer': 'Количество мест – целое число',
  'number.min': 'Количество мест не меньше 1',
  'number.max': 'Количество мест не больше 1000',
});

const totalWeightKg = Joi.number().min(0).max(50000).precision(3).allow(null).messages({
  'number.base': 'Вес должен быть числом',
  'number.min': 'Вес не может быть отрицательным',
  'number.max': 'Вес не больше 50 000 кг',
});

const carrier = Joi.string().trim().max(100).allow(null, '').messages({
  'string.max': 'Перевозчик не длиннее 100 символов',
});

const comment = Joi.string().trim().max(2000).allow(null, '').messages({
  'string.max': 'Комментарий не длиннее 2000 символов',
});

// status и qrCode с клиента не принимаются: статус меняется отдельным маршрутом, код выдаёт сервер.
const createShipmentSchema = Joi.object({
  orderNumber: orderNumber.required(),
  customerName: customerName.required(),
  deliveryAddress: deliveryAddress.required(),
  plannedDate: plannedDate.required(),
  packagesCount: packagesCount.default(1),
  totalWeightKg,
  carrier,
  comment,
});

// PUT заменяет карточку целиком: обязательные поля те же, что при создании.
const replaceShipmentSchema = createShipmentSchema;

const statusSchema = Joi.object({
  status: Joi.string().valid(...SHIPMENT_STATUSES).required().messages({
    'any.only': `Статус: ${SHIPMENT_STATUSES.join(', ')}`,
    'any.required': 'Статус обязателен',
  }),
});

const qrParams = Joi.object({
  code: Joi.string().uppercase().pattern(/^SHP-[0-9A-F]{16}$/).required().messages({
    'string.pattern.base': 'QR-код отгрузки имеет вид SHP- и 16 шестнадцатеричных символов',
  }),
});

const qrImageQuery = Joi.object({
  format: Joi.string().valid('png', 'svg').default('png').messages({
    'any.only': 'Формат: png или svg',
  }),
});

const listShipmentsQuery = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().max(100).allow(''),
  status: Joi.string().valid(...SHIPMENT_STATUSES).messages({
    'any.only': `Статус: ${SHIPMENT_STATUSES.join(', ')}`,
  }),
  plannedFrom: dateOnly,
  plannedTo: dateOnly.when('plannedFrom', {
    is: Joi.exist(),
    then: Joi.custom((value, helpers) => (
      value < helpers.state.ancestors[0].plannedFrom ? helpers.error('date.range') : value
    )),
  }).messages({ 'date.range': 'plannedTo не может быть раньше plannedFrom' }),
  sort: Joi.string().valid(...SHIPMENT_SORT_FIELDS).default('plannedDate').messages({
    'any.only': `Сортировка: ${SHIPMENT_SORT_FIELDS.join(', ')}`,
  }),
  order: Joi.string().lowercase().valid('asc', 'desc').default('asc').messages({
    'any.only': 'Порядок: asc или desc',
  }),
});

module.exports = {
  idParams,
  qrParams,
  qrImageQuery,
  createShipmentSchema,
  replaceShipmentSchema,
  statusSchema,
  listShipmentsQuery,
};
