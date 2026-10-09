const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS API',
    version: '0.1.0',
    description: 'Безопасный REST API склада: аутентификация, роли, товары и ячейки.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Products' },
    { name: 'Locations' },
    { name: 'Audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              details: {},
            },
          },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'Проверка живости',
        responses: { 200: { description: 'Сервис отвечает' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Регистрация. Роль всегда user, поле role игнорируется',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', example: 'Password1!' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Пользователь создан' },
          400: { description: 'Ошибка валидации' },
          409: { description: 'Email занят' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Вход. Access JWT в теле, refresh в httpOnly cookie',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Токены выданы' },
          401: { description: 'Неверные учётные данные' },
          423: { description: 'Учётная запись заблокирована на 15 минут' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Текущий пользователь',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Профиль' },
          401: { description: 'Нет или неверный токен' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Обновление access-токена. Нужны cookie и заголовок X-CSRF-Token',
        parameters: [{
          in: 'header',
          name: 'X-CSRF-Token',
          required: true,
          schema: { type: 'string' },
        }],
        responses: {
          200: { description: 'Новая пара токенов' },
          401: { description: 'Сессия недействительна' },
          403: { description: 'CSRF' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Выход из текущей сессии',
        parameters: [{
          in: 'header',
          name: 'X-CSRF-Token',
          required: true,
          schema: { type: 'string' },
        }],
        responses: { 200: { description: 'Сессия отозвана' } },
      },
    },
    '/auth/logout-all': {
      post: {
        tags: ['Auth'],
        summary: 'Завершить все сессии пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Сессии отозваны' } },
      },
    },
    '/auth/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'Активные сессии текущего пользователя',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список сессий без токенов' } },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Список пользователей. Только admin',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список' }, 403: { description: 'Недостаточно прав' } },
      },
    },
    '/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Профиль. Свой или любой для admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Профиль' }, 403: { description: 'Чужой профиль' } },
      },
      patch: {
        tags: ['Users'],
        summary: 'Смена имени. Роль этим маршрутом не меняется',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Обновлено' } },
      },
      delete: {
        tags: ['Users'],
        summary: 'Удаление пользователя. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Удалён' }, 403: { description: 'Недостаточно прав' } },
      },
    },
    '/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Смена роли. Только admin, пишется в аудит',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Роль изменена' } },
      },
    },
    '/users/{id}/unlock': {
      post: {
        tags: ['Users'],
        summary: 'Снять блокировку входа. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Блокировка снята' } },
      },
    },
    '/products': {
      get: {
        tags: ['Products'],
        summary: 'Каталог товаров. Публичный',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer' } },
          { in: 'query', name: 'limit', schema: { type: 'integer' } },
          { in: 'query', name: 'search', schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Список' } },
      },
      post: {
        tags: ['Products'],
        summary: 'Создать товар. Любая вошедшая роль',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Создан' }, 401: { description: 'Нет токена' } },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Карточка товара. Публичная',
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Товар' }, 404: { description: 'Не найден' } },
      },
      patch: {
        tags: ['Products'],
        summary: 'Изменить товар. moderator и admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Обновлён' }, 403: { description: 'Недостаточно прав' } },
      },
      delete: {
        tags: ['Products'],
        summary: 'Удалить товар. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Удалён' }, 403: { description: 'Недостаточно прав' } },
      },
    },
    '/locations': {
      get: {
        tags: ['Locations'],
        summary: 'Ячейки склада. Нужна аутентификация',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Список' } },
      },
      post: {
        tags: ['Locations'],
        summary: 'Создать ячейку. moderator и admin',
        security: [{ bearerAuth: [] }],
        responses: { 201: { description: 'Создана' } },
      },
    },
    '/locations/{id}': {
      get: {
        tags: ['Locations'],
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Ячейка' } },
      },
      patch: {
        tags: ['Locations'],
        summary: 'Изменить ячейку. moderator и admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Обновлена' } },
      },
      delete: {
        tags: ['Locations'],
        summary: 'Удалить ячейку. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [{ in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Удалена' } },
      },
    },
    '/audit': {
      get: {
        tags: ['Audit'],
        summary: 'Журнал действий администратора',
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: 'Записи' }, 403: { description: 'Недостаточно прав' } },
      },
    },
  },
};

module.exports = openapi;
