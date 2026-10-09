const Joi = require('joi');
const { idParams, paginationQuery } = require('./common');

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.min': 'Имя не должно быть пустым',
    'any.required': 'Имя обязательно',
  }),
});

const changeRoleSchema = Joi.object({
  role: Joi.string().valid('user', 'moderator', 'admin').required().messages({
    'any.only': 'Роль должна быть user, moderator или admin',
    'any.required': 'Роль обязательна',
  }),
});

const listUsersQuery = Joi.object({
  ...paginationQuery,
});

module.exports = {
  idParams,
  updateProfileSchema,
  changeRoleSchema,
  listUsersQuery,
};
