const Joi = require('joi');
const { idParams, paginationQuery } = require('./common');

const createLocationSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{1,31}$/).required().messages({
    'string.pattern.base': 'Код ячейки может содержать латиницу, цифры и дефис',
    'any.required': 'Код ячейки обязателен',
  }),
  zone: Joi.string().trim().min(1).max(100).required().messages({
    'any.required': 'Зона обязательна',
  }),
  description: Joi.string().trim().max(2000).allow(null, ''),
  isBlocked: Joi.boolean().default(false),
});

const updateLocationSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{1,31}$/),
  zone: Joi.string().trim().min(1).max(100),
  description: Joi.string().trim().max(2000).allow(null, ''),
  isBlocked: Joi.boolean(),
}).min(1).messages({
  'object.min': 'Нужно передать хотя бы одно поле',
});

const listLocationsQuery = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().max(100).allow(''),
});

module.exports = {
  idParams,
  createLocationSchema,
  updateLocationSchema,
  listLocationsQuery,
};
