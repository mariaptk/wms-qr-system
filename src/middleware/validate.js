const { AppError } = require('../utils/errors');

function formatJoi(error) {
  return error.details.map((detail) => ({
    field: detail.path.join('.') || detail.context?.key || 'value',
    message: detail.message,
  }));
}

/**
 * Проверяет тело, query или params схемой Joi.
 * stripUnknown отбрасывает поля, которых нет в схеме (защита от mass assignment).
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });

    if (error) {
      return next(new AppError(400, 'Ошибка валидации', formatJoi(error)));
    }

    // В Express 5 req.query нельзя перезаписать: геттер каждый раз отдаёт исходную строку.
    if (source === 'query') req.validQuery = value;
    else req[source] = value;
    return next();
  };
}

module.exports = { validate };
