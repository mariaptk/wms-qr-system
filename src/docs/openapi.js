const {
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
  PRODUCT_SORT_FIELDS,
} = require('../constants/products');

const idParam = { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } };

const productProperties = {
  sku: {
    type: 'string',
    pattern: '^[A-Za-z0-9][A-Za-z0-9-]{1,63}$',
    example: 'MILK-001',
    description: 'Уникален, хранится в верхнем регистре',
  },
  name: { type: 'string', maxLength: 200, example: 'Молоко 3,2%' },
  category: { type: 'string', enum: PRODUCT_CATEGORIES, example: 'food' },
  unit: { type: 'string', enum: PRODUCT_UNITS, default: 'pcs' },
  price: { type: 'number', minimum: 0, maximum: 10000000, example: 2.49 },
  weightKg: { type: 'number', nullable: true, minimum: 0, maximum: 100000, example: 1.03 },
  description: { type: 'string', maxLength: 2000 },
  isActive: { type: 'boolean', default: true },
};

function productBody(full = true) {
  return {
    required: true,
    content: {
      'application/json': {
        schema: { $ref: `#/components/schemas/${full ? 'ProductInput' : 'ProductPatch'}` },
      },
    },
  };
}

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS API',
    version: '0.2.0',
    description: 'REST API склада: аутентификация JWT, роли, каталог товаров с фильтрами и статистикой, ячейки.',
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
      ProductInput: {
        type: 'object',
        required: ['sku', 'name', 'category', 'price'],
        properties: productProperties,
      },
      ProductPatch: {
        type: 'object',
        minProperties: 1,
        properties: productProperties,
      },
      Product: {
        allOf: [
          { $ref: '#/components/schemas/ProductInput' },
          {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              createdBy: { type: 'string', format: 'uuid' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
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
        summary: 'Каталог товаров с фильтрами, поиском и сортировкой. Публичный',
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { in: 'query', name: 'search', description: 'Подстрока в названии или артикуле', schema: { type: 'string' } },
          { in: 'query', name: 'category', schema: { type: 'string', enum: PRODUCT_CATEGORIES } },
          { in: 'query', name: 'isActive', schema: { type: 'boolean' } },
          { in: 'query', name: 'minPrice', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'maxPrice', description: 'Не меньше minPrice', schema: { type: 'number', minimum: 0 } },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: PRODUCT_SORT_FIELDS, default: 'createdAt' } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          200: {
            description: 'Страница товаров и meta: page, limit, total, pages, sort, order',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    meta: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Неверный параметр фильтра или сортировки' },
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Создать товар. Любая вошедшая роль, автор записывается в createdBy',
        security: [{ bearerAuth: [] }],
        requestBody: productBody(),
        responses: {
          201: { description: 'Создан' },
          400: { description: 'Ошибка валидации' },
          401: { description: 'Нет токена' },
          409: { description: 'Артикул занят' },
        },
      },
    },
    '/products/stats': {
      get: {
        tags: ['Products'],
        summary: 'Статистика каталога: количество, активные, цены по категориям',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'total, active, inactive, avgPrice, byCategory[]' },
          401: { description: 'Нет токена' },
        },
      },
    },
    '/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Карточка товара. Публичная',
        parameters: [idParam],
        responses: {
          200: { description: 'Товар' },
          400: { description: 'id не UUID' },
          404: { description: 'Не найден' },
        },
      },
      put: {
        tags: ['Products'],
        summary: 'Полная замена товара. Автор, moderator или admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: productBody(),
        responses: {
          200: { description: 'Обновлён' },
          400: { description: 'Ошибка валидации или неполное тело' },
          401: { description: 'Нет токена' },
          403: { description: 'Не автор и не администратор' },
          404: { description: 'Не найден' },
          409: { description: 'Артикул занят' },
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Частичное изменение товара. Автор, moderator или admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: productBody(false),
        responses: {
          200: { description: 'Обновлён' },
          403: { description: 'Не автор и не администратор' },
          409: { description: 'Артикул занят' },
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Удалить товар. Только admin',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
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
