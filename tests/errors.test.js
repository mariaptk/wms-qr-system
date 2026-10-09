const { AppError, toClientError } = require('../src/utils/errors');

describe('ошибки для клиента', () => {
  test('ожидаемая ошибка сохраняет статус и текст', () => {
    const error = new AppError(400, 'Ошибка валидации', [{ field: 'email', message: 'Некорректный email' }]);
    const client = toClientError(error, true);
    expect(client.statusCode).toBe(400);
    expect(client.body.error.message).toBe('Ошибка валидации');
    expect(client.body.error.details).toHaveLength(1);
    expect(client.body.stack).toBeUndefined();
  });

  test('в production непредвиденная ошибка заменяется общей фразой', () => {
    const client = toClientError(new Error('relation users does not exist'), true);
    expect(client.statusCode).toBe(500);
    expect(client.body.error.message).toBe('Внутренняя ошибка сервера');
    expect(JSON.stringify(client.body)).not.toContain('relation');
  });

  test('в разработке непредвиденная ошибка оставляет сообщение без стека', () => {
    const error = new Error('column missing');
    error.stack = 'SECRET STACK';
    const client = toClientError(error, false);
    expect(client.body.error.message).toBe('column missing');
    expect(JSON.stringify(client.body)).not.toContain('SECRET STACK');
  });
});
