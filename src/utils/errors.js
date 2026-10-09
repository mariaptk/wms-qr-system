class AppError extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
  }
}

/**
 * Формирует ответ клиенту.
 * В production неожиданные ошибки заменяются общей фразой, без стека и SQL.
 */
function toClientError(err, isProd) {
  if (err && err.isOperational) {
    return {
      statusCode: err.statusCode,
      body: {
        error: {
          message: err.message,
          ...(err.details !== undefined ? { details: err.details } : {}),
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: {
        message: isProd ? 'Внутренняя ошибка сервера' : (err?.message || 'Внутренняя ошибка сервера'),
      },
    },
  };
}

module.exports = { AppError, toClientError };
