const Joi = require('joi');

const passwordRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*\d)(?=.*[^A-Za-z0-9]).+$/)
  .required()
  .messages({
    'string.min': 'Пароль должен содержать не менее 8 символов',
    'string.max': 'Пароль не должен быть длиннее 128 символов',
    'string.pattern.base': 'Пароль должен содержать цифру и спецсимвол',
    'any.required': 'Пароль обязателен',
    'string.empty': 'Пароль обязателен',
  });

const emailRule = Joi.string().trim().lowercase().email().max(255).required().messages({
  'string.email': 'Некорректный email',
  'any.required': 'Email обязателен',
  'string.empty': 'Email обязателен',
});

const registerSchema = Joi.object({
  email: emailRule,
  password: passwordRule,
  name: Joi.string().trim().min(1).max(100).messages({
    'string.min': 'Имя не должно быть пустым',
    'string.max': 'Имя не должно быть длиннее 100 символов',
  }),
});

const loginSchema = Joi.object({
  email: emailRule,
  password: Joi.string().min(1).max(128).required().messages({
    'string.empty': 'Пароль обязателен',
    'any.required': 'Пароль обязателен',
  }),
});

module.exports = { registerSchema, loginSchema, passwordRule, emailRule };
