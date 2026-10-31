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
| GET | /products/stats | любая вошедшая роль |
| GET | /products/:id | все, без токена |
| POST | /products | любая вошедшая роль |
| PUT | /products/:id | автор товара, moderator, admin |
| PATCH | /products/:id | автор товара, moderator, admin |
| DELETE | /products/:id | admin |

### Поля товара

| Поле | Тип | Правила |
|---|---|---|
| `id` | UUID | создаётся сервером |
| `sku` | строка до 64 | обязательное, уникальное, латиница, цифры и дефис, хранится в верхнем регистре |
| `name` | строка до 200 | обязательное |
| `category` | строка | обязательное: `food`, `beverages`, `household`, `electronics`, `building`, `clothing`, `other` |
| `unit` | строка | `pcs` (по умолчанию), `kg`, `g`, `l`, `box`, `pack` |
| `price` | число, 2 знака | обязательное, от 0 до 10 000 000 |
| `weightKg` | число, 3 знака | необязательное, от 0 до 100 000 или `null` |
| `description` | строка до 2000 | необязательное |
| `isActive` | логическое | `true` по умолчанию |
| `createdBy` | UUID | автор, сервер берёт из токена; с клиента не принимается |

HTML в названии и описании удаляется.

### POST /products

```json
{
  "sku": "MILK-01",
  "name": "Молоко 3,2%",
  "category": "food",
  "unit": "pcs",
  "price": 2.49,
  "weightKg": 1.03,
  "description": "Пастеризованное, 1 л"
}
```

`201` — созданный товар. `409` — артикул уже занят (без учёта регистра):

```json
{ "error": { "message": "Товар с таким артикулом уже существует", "details": [{ "field": "sku", "message": "Артикул занят" }] } }
```

### PUT и PATCH /products/:id

`PUT` заменяет карточку целиком, поэтому тело содержит те же обязательные поля, что и при создании, иначе `400`. `PATCH` меняет только переданные поля, пустое тело — `400`. Кладовщик может изменить только свой товар, чужой — `403` «Изменять товар может только его автор или администратор».

### GET /products

| Параметр | Значение |
|---|---|
| `page`, `limit` | страница и размер, `limit` до 100 |
| `search` | подстрока в названии или артикуле, без учёта регистра |
| `category` | одна из категорий |
| `isActive` | `true` или `false` |
| `minPrice`, `maxPrice` | диапазон цены, `maxPrice` не меньше `minPrice` |
| `sort` | `createdAt` (по умолчанию), `name`, `sku`, `price`, `weightKg` |
| `order` | `asc` или `desc` (по умолчанию) |

Пример: `GET /products?category=food&minPrice=1&maxPrice=5&sort=price&order=asc`.

```json
{
  "data": [{ "id": "…", "sku": "KEFIR-01", "name": "Кефир", "category": "food", "price": 1.89 }],
  "meta": { "page": 1, "limit": 20, "total": 1, "pages": 1, "sort": "price", "order": "asc" }
}
```

Поле сортировки не из списка, например `sort=passwordHash`, — `400`.

### GET /products/stats

```json
{
  "data": {
    "total": 4,
    "active": 3,
    "inactive": 1,
    "avgPrice": 31.34,
    "byCategory": [
      { "category": "food", "count": 2, "active": 2, "avgPrice": 2.19, "minPrice": 1.89, "maxPrice": 2.49 }
    ]
  }
}
```

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
