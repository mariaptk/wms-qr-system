const Joi = require('joi');
const { idParams, paginationQuery } = require('./common');
const {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_SORT_FIELDS,
} = require('../constants/products');

const sku = Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9-]{1,63}$/).messages({
  'string.pattern.base': 'Артикул: 2–64 символа, латиница, цифры и дефис',
  'string.empty': 'Артикул обязателен',
  'any.required': 'Артикул обязателен',
});

const name = Joi.string().trim().min(1).max(200).messages({
  'string.empty': 'Название обязательно',
  'string.max': 'Название не длиннее 200 символов',
  'any.required': 'Название обязательно',
});

const category = Joi.string().valid(...PRODUCT_CATEGORIES).messages({
  'any.only': `Категория: ${PRODUCT_CATEGORIES.join(', ')}`,
  'any.required': 'Категория обязательна',
});

const unit = Joi.string().valid(...PRODUCT_UNITS).messages({
  'any.only': `Единица измерения: ${PRODUCT_UNITS.join(', ')}`,
});

const price = Joi.number().min(0).max(10000000).precision(2).messages({
  'number.base': 'Цена должна быть числом',
  'number.min': 'Цена не может быть отрицательной',
  'number.max': 'Цена не больше 10 000 000',
  'any.required': 'Цена обязательна',
});

const weightKg = Joi.number().min(0).max(100000).precision(3).allow(null).messages({
  'number.base': 'Вес должен быть числом',
  'number.min': 'Вес не может быть отрицательным',
  'number.max': 'Вес не больше 100 000 кг',
});

const description = Joi.string().trim().max(2000).allow(null, '').messages({
  'string.max': 'Описание не длиннее 2000 символов',
});

const isActive = Joi.boolean().messages({ 'boolean.base': 'isActive должно быть true или false' });

const createProductSchema = Joi.object({
  sku: sku.required(),
  name: name.required(),
  category: category.required(),
  unit: unit.default('pcs'),
  price: price.required(),
  weightKg,
  description,
  isActive: isActive.default(true),
});

// PUT заменяет карточку целиком: обязательные поля те же, что при создании.
const replaceProductSchema = createProductSchema;

const updateProductSchema = Joi.object({
  sku,
  name,
  category,
  unit,
  price,
  weightKg,
  description,
  isActive,
}).min(1).messages({
  'object.min': 'Нужно передать хотя бы одно поле',
});

const listProductsQuery = Joi.object({
  ...paginationQuery,
  search: Joi.string().trim().max(100).allow(''),
  category,
  isActive,
  minPrice: Joi.number().min(0).messages({
    'number.base': 'minPrice должно быть числом',
    'number.min': 'minPrice не может быть отрицательным',
  }),
  maxPrice: Joi.number().min(0).when('minPrice', {
    is: Joi.exist(),
    then: Joi.number().min(Joi.ref('minPrice')),
  }).messages({
    'number.base': 'maxPrice должно быть числом',
    'number.min': 'maxPrice не может быть меньше minPrice и нуля',
  }),
  sort: Joi.string().valid(...PRODUCT_SORT_FIELDS).default('createdAt').messages({
    'any.only': `Сортировка: ${PRODUCT_SORT_FIELDS.join(', ')}`,
  }),
  order: Joi.string().lowercase().valid('asc', 'desc').default('desc').messages({
    'any.only': 'Порядок: asc или desc',
  }),
});

module.exports = {
  idParams,
  createProductSchema,
  replaceProductSchema,
  updateProductSchema,
  listProductsQuery,
};
