# API склада

Базовый URL: `http://localhost:3000`.

Тело запросов `POST`, `PUT` и `PATCH` — только `Content-Type: application/json`, не больше 100 КБ.

Успех: `{ "data": ... }`. Ошибка: `{ "error": { "message": "...", "details": ... } }`. Стек и SQL клиенту не отдаются.

Защищённые маршруты: `Authorization: Bearer <accessToken>`.

## Аутентификация

### POST /auth/register

Создаёт кладовщика. Поля `role`, `passwordHash`, `failedAttempts` игнорируются.

```json
{ "email": "worker@example.com", "password": "Password1!", "name": "Кладовщик" }
```

Пароль: не короче 8 символов, хотя бы одна цифра и один спецсимвол.

`201` — пользователь без хеша. `400` — валидация. `409` — email занят.

### POST /auth/login

```json
{ "email": "worker@example.com", "password": "Password1!" }
```

`200`:

```json
{
  "data": {
    "accessToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "csrfToken": "<hex>",
    "user": { "id": "...", "email": "...", "role": "user", "name": "..." }
  }
}
```

Cookie:

- `refreshToken` — HttpOnly, Path=/auth, SameSite=Strict
- `csrf_token` — читается скриптом страницы, Path=/

`401` — неверный email или пароль (текст один и тот же). `423` — после 5 неудач учётная запись закрыта на 15 минут, верный пароль до конца блокировки не принимается.

### GET /auth/me

Текущий профиль. Без токена или с просроченным — `401`.

### POST /auth/refresh

Cookie `refreshToken` и заголовок `X-CSRF-Token`, равный cookie `csrf_token`. Тело `{}`.

Выдаёт новый access-токен и заменяет refresh. Старый refresh после этого недействителен. Повтор старого токена гасит все сессии пользователя.

Без CSRF — `403`.

### POST /auth/logout

Та же пара cookie и `X-CSRF-Token`. Отзывает текущую сессию.

### POST /auth/logout-all

Bearer-токен. Отзывает все сессии.

### GET /auth/sessions

Активные сессии текущего пользователя: id, ip, user agent, даты. Хеши токенов не отдаются. Одновременно их не больше трёх: при четвёртом входе самая старая отзывается.

## Пользователи

Все маршруты требуют Bearer-токен.

| Метод | Путь | Кто |
|---|---|---|
| GET | /users | admin |
| GET | /users/:id | сам пользователь или admin |
| PATCH | /users/:id | сам пользователь или admin, только поле `name` |
| PATCH | /users/:id/role | admin, тело `{ "role": "moderator" }`, свою роль менять нельзя |
| POST | /users/:id/unlock | admin, тело `{}`, снимает блокировку входа |
| DELETE | /users/:id | admin, себя удалить нельзя |

Чужой профиль для кладовщика — `403`, событие пишется в журнал безопасности.

## Товары

| Метод | Путь | Кто |
|---|---|---|
| GET | /products | все, без токена |
| GET | /products/:id | все, без токена |
| POST | /products | любая вошедшая роль |
| PATCH | /products/:id | moderator, admin |
| DELETE | /products/:id | admin |

Query: `page`, `limit` (до 100), `search` по названию и артикулу.

```json
{
  "sku": "MILK-01",
  "name": "Молоко",
  "unit": "pcs",
  "description": "3.2%",
  "isActive": true
}
```

`unit`: `pcs`, `kg`, `g`, `l`, `box`, `pack`. Артикул — латиница, цифры и дефис. HTML в названии и описании удаляется. Поле `createdBy` с клиента не принимается.

## Ячейки

Без токена список не отдаётся: это топология склада.

| Метод | Путь | Кто |
|---|---|---|
| GET | /locations | user, moderator, admin |
| GET | /locations/:id | user, moderator, admin |
| POST | /locations | moderator, admin |
| PATCH | /locations/:id | moderator, admin |
| DELETE | /locations/:id | admin |

```json
{ "code": "A-01-03", "zone": "Хранение", "description": "Стеллаж A", "isBlocked": false }
```

## Аудит

`GET /audit` — только admin. Записи о создании, изменении и удалении справочников администратором, смене роли, разблокировке и удалении пользователя. Пароли в `details` не пишутся.

## Служебное

- `GET /health` — `{ "data": { "status": "ok" } }`
- `GET /api-docs` — Swagger UI
- `GET /api-docs.json` — OpenAPI

Запрос с заголовком `Origin` вне `CORS_ORIGINS` получает `403`. Запрос без `Origin` (Postman, curl, сканер) разрешён.

Query вроде `' OR 1=1 --` получает `400` и запись `sql_injection_attempt`.
