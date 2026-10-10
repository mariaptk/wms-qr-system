const Joi = require('joi');

const idParams = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Идентификатор должен быть UUID',
    'any.required': 'Идентификатор обязателен',
  }),
});

const paginationQuery = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
};

module.exports = { idParams, paginationQuery };
