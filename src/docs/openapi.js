const {
  SHIPMENT_STATUSES,
  SHIPMENT_SORT_FIELDS,
} = require('../constants/shipments');

const idParam = { in: 'path', name: 'id', required: true, schema: { type: 'string', format: 'uuid' } };

const shipmentProperties = {
  orderNumber: {
    type: 'string',
    pattern: '^[A-Za-z0-9][A-Za-z0-9-]{2,31}$',
    example: 'ORD-1001',
    description: 'Номер заказа покупателя. Уникален, хранится в верхнем регистре',
  },
  customerName: { type: 'string', minLength: 2, maxLength: 200, example: 'ООО «Гиппо»' },
  deliveryAddress: { type: 'string', minLength: 5, maxLength: 500, example: 'г. Минск, ул. Притыцкого, 156' },
  plannedDate: { type: 'string', format: 'date', example: '2026-11-02', description: 'Не раньше сегодняшнего дня' },
  packagesCount: { type: 'integer', minimum: 1, maximum: 1000, default: 1, example: 3 },
  totalWeightKg: { type: 'number', nullable: true, minimum: 0, maximum: 50000, example: 42.5 },
  carrier: { type: 'string', nullable: true, maxLength: 100, example: 'Белпочта' },
  comment: { type: 'string', nullable: true, maxLength: 2000 },
};

const shipmentBody = {
  required: true,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ShipmentInput' } } },
};

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'WMS API',
    version: '0.2.0',
    description: 'REST API склада: аутентификация JWT, роли, отгрузки с QR-кодами, товары и ячейки.',
  },
  servers: [{ url: 'http://localhost:3000' }],
  tags: [
    { name: 'Auth' },
    { name: 'Users' },
    { name: 'Shipments' },
    { name: 'Products' },
    { name: 'Locations' },
    { name: 'Audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ShipmentInput: {
        type: 'object',
        required: ['orderNumber', 'customerName', 'deliveryAddress', 'plannedDate'],
        properties: shipmentProperties,
      },
      Shipment: {
        allOf: [
          { $ref: '#/components/schemas/ShipmentInput' },
          {
            type: 'object',
            properties: {
              id: { type: 'string', format: 'uuid' },
              qrCode: { type: 'string', example: 'SHP-5970B8CD152DA8F6', description: 'Выдаётся сервером' },
              status: { type: 'string', enum: SHIPMENT_STATUSES },
              shippedAt: { type: 'string', format: 'date-time', nullable: true },
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
    '/shipments': {
      get: {
        tags: ['Shipments'],
        summary: 'Список отгрузок с фильтрами, поиском и сортировкой',
        security: [{ bearerAuth: [] }],
        parameters: [
          { in: 'query', name: 'page', schema: { type: 'integer', minimum: 1, default: 1 } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          {
            in: 'query',
            name: 'search',
            description: 'Подстрока в номере заказа, получателе или адресе',
            schema: { type: 'string' },
          },
          { in: 'query', name: 'status', schema: { type: 'string', enum: SHIPMENT_STATUSES } },
          { in: 'query', name: 'plannedFrom', schema: { type: 'string', format: 'date' } },
          {
            in: 'query',
            name: 'plannedTo',
            description: 'Не раньше plannedFrom',
            schema: { type: 'string', format: 'date' },
          },
          { in: 'query', name: 'sort', schema: { type: 'string', enum: SHIPMENT_SORT_FIELDS, default: 'plannedDate' } },
          { in: 'query', name: 'order', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
        ],
        responses: {
          200: {
            description: 'Страница отгрузок и meta: page, limit, total, pages, sort, order',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Shipment' } },
                    meta: { type: 'object' },
                  },
                },
              },
            },
          },
          400: { description: 'Неверный параметр фильтра или сортировки' },
          401: { description: 'Нет токена' },
        },
      },
      post: {
        tags: ['Shipments'],
        summary: 'Создать отгрузку. Статус new, QR-код и автор задаются сервером',
        security: [{ bearerAuth: [] }],
        requestBody: shipmentBody,
        responses: {
          201: { description: 'Создана' },
          400: { description: 'Ошибка валидации' },
          401: { description: 'Нет токена' },
          409: { description: 'Номер заказа занят' },
        },
      },
    },
    '/shipments/stats': {
      get: {
        tags: ['Shipments'],
        summary: 'Статистика: по статусам, на сегодня, просроченные, места и вес',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'total, byStatus, plannedToday, overdue, packages, weightKg' },
          401: { description: 'Нет токена' },
        },
      },
    },
    '/shipments/scan/{code}': {
      get: {
        tags: ['Shipments'],
        summary: 'Найти отгрузку по отсканированному QR-коду',
        security: [{ bearerAuth: [] }],
        parameters: [{
          in: 'path',
          name: 'code',
          required: true,
          schema: { type: 'string', pattern: '^SHP-[0-9A-Fa-f]{16}$' },
        }],
        responses: {
          200: { description: 'Отгрузка' },
          400: { description: 'Неверный формат кода' },
          404: { description: 'Не найдена' },
        },
      },
    },
    '/shipments/{id}': {
      get: {
        tags: ['Shipments'],
        summary: 'Карточка отгрузки',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          200: { description: 'Отгрузка' },
          400: { description: 'id не UUID' },
          404: { description: 'Не найдена' },
        },
      },
      put: {
        tags: ['Shipments'],
        summary: 'Полная замена карточки. Автор, moderator или admin, пока груз на складе',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: shipmentBody,
        responses: {
          200: { description: 'Обновлена' },
          400: { description: 'Ошибка валидации или неполное тело' },
          401: { description: 'Нет токена' },
          403: { description: 'Не автор и не администратор' },
          404: { description: 'Не найдена' },
          409: { description: 'Номер заказа занят или отгрузка уже отправлена' },
        },
      },
      delete: {
        tags: ['Shipments'],
        summary: 'Удалить отгрузку. Только admin, пишется в аудит',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: { description: 'Удалена' }, 403: { description: 'Недостаточно прав' } },
      },
    },
    '/shipments/{id}/status': {
      patch: {
        tags: ['Shipments'],
        summary: 'Сменить статус: new → picking → packed → shipped → delivered, отмена до отгрузки',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: SHIPMENT_STATUSES } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Статус изменён' },
          400: { description: 'Неизвестный статус' },
          409: { description: 'Недопустимый переход, в details from, to, allowed' },
        },
      },
    },
    '/shipments/{id}/qr': {
      get: {
        tags: ['Shipments'],
        summary: 'QR-код отгрузки для этикетки',
        security: [{ bearerAuth: [] }],
        parameters: [
          idParam,
          { in: 'query', name: 'format', schema: { type: 'string', enum: ['png', 'svg'], default: 'png' } },
        ],
        responses: {
          200: {
            description: 'Изображение QR-кода со значением qrCode',
            content: {
              'image/png': { schema: { type: 'string', format: 'binary' } },
              'image/svg+xml': { schema: { type: 'string' } },
            },
          },
          404: { description: 'Не найдена' },
        },
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
