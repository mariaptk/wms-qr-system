const Joi = require('joi');
const { idParams, paginationQuery } = require('./common');

const unit = Joi.string().valid('pcs', 'kg', 'g', 'l', 'box', 'pack');

const createProductSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{1,63}$/).required().messages({
    'string.pattern.base': 'Артикул может содержать латиницу, цифры и дефис',
    'any.required': 'Артикул обязателен',
  }),
  name: Joi.string().trim().min(1).max(200).required().messages({
    'string.min': 'Название обязательно',
    'any.required': 'Название обязательно',
  }),
  unit: unit.default('pcs'),
  description: Joi.string().trim().max(2000).allow(null, ''),
  isActive: Joi.boolean().default(true),
});

const updateProductSchema = Joi.object({
  sku: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{1,63}$/),
  name: Joi.string().trim().min(1).max(200),
  unit,
  description: Joi.string().trim().max(2000).allow(null, ''),
  isActive: Joi.boolean(),
}).min(1).messages({
  'object.min': 'Нужно передать хотя бы одно поле',
});

const listProductsQuery = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().max(100).allow(''),
});

module.exports = {
  idParams,
  createProductSchema,
  updateProductSchema,
  listProductsQuery,
};
