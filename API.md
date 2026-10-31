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

## Отгрузки

Все маршруты требуют `Authorization: Bearer <accessToken>`: в отгрузках имена и адреса получателей.

| Метод | Путь | Кто |
|---|---|---|
| GET | /shipments | любая вошедшая роль |
| GET | /shipments/stats | любая вошедшая роль |
| GET | /shipments/scan/:code | любая вошедшая роль |
| GET | /shipments/:id | любая вошедшая роль |
| GET | /shipments/:id/qr | любая вошедшая роль |
| POST | /shipments | любая вошедшая роль |
| PUT | /shipments/:id | автор отгрузки, moderator, admin |
| PATCH | /shipments/:id/status | любая вошедшая роль |
| DELETE | /shipments/:id | admin |

### Поля отгрузки

| Поле | Тип | Правила |
|---|---|---|
| `id` | UUID | создаётся сервером |
| `orderNumber` | строка до 32 | обязательное, уникальное, латиница, цифры и дефис, хранится в верхнем регистре |
| `qrCode` | строка | выдаёт сервер: `SHP-` и 16 шестнадцатеричных символов, уникальное, с клиента не принимается |
| `customerName` | строка 2–200 | обязательное |
| `deliveryAddress` | строка 5–500 | обязательное |
| `plannedDate` | дата `ГГГГ-ММ-ДД` | обязательное, не раньше сегодняшнего дня |
| `status` | строка | `new` при создании, дальше только через `PATCH /shipments/:id/status` |
| `packagesCount` | целое | от 1 до 1000, по умолчанию 1 |
| `totalWeightKg` | число, 3 знака | необязательное, от 0 до 50 000 |
| `carrier` | строка до 100 | необязательное |
| `comment` | строка до 2000 | необязательное |
| `shippedAt` | дата и время | ставится сервером при переходе в `shipped` |
| `createdBy` | UUID | автор, сервер берёт из токена |

HTML в строковых полях удаляется.

### POST /shipments

```json
{
  "orderNumber": "ORD-1001",
  "customerName": "ООО «Гиппо»",
  "deliveryAddress": "г. Минск, ул. Притыцкого, 156",
  "plannedDate": "2026-11-02",
  "packagesCount": 3,
  "totalWeightKg": 42.5,
  "carrier": "Белпочта"
}
```

`201` — созданная отгрузка со статусом `new` и `qrCode`. `409` — номер заказа уже занят (без учёта регистра):

```json
{ "error": { "message": "Отгрузка с таким номером заказа уже существует", "details": [{ "field": "orderNumber", "message": "Номер заказа занят" }] } }
```

### PUT /shipments/:id

Заменяет карточку целиком: тело содержит те же обязательные поля, что при создании, иначе `400`. Кладовщик меняет только свою отгрузку, чужую — `403`. После перехода в `shipped`, `delivered` или `cancelled` карточка не меняется — `409`.

### PATCH /shipments/:id/status

Тело `{ "status": "picking" }`. Переходы:

| Из | Можно в |
|---|---|
| `new` | `picking`, `cancelled` |
| `picking` | `packed`, `cancelled` |
| `packed` | `shipped`, `cancelled` |
| `shipped` | `delivered` |
| `delivered`, `cancelled` | — |

Недопустимый переход — `409`:

```json
{ "error": { "message": "Нельзя перевести отгрузку из статуса new в shipped", "details": { "from": "new", "to": "shipped", "allowed": ["picking", "cancelled"] } } }
```

### QR-код

`GET /shipments/:id/qr` возвращает изображение QR-кода со значением `qrCode` для этикетки: PNG по умолчанию, `?format=svg` — SVG. Терминал кладовщика сканирует этикетку и запрашивает `GET /shipments/scan/SHP-5970B8CD152DA8F6`; код без учёта регистра, неверный формат — `400`, неизвестный код — `404`.

### GET /shipments

| Параметр | Значение |
|---|---|
| `page`, `limit` | страница и размер, `limit` до 100 |
| `search` | подстрока в номере заказа, получателе или адресе, без учёта регистра |
| `status` | один из статусов |
| `plannedFrom`, `plannedTo` | диапазон плановой даты, `plannedTo` не раньше `plannedFrom` |
| `sort` | `plannedDate` (по умолчанию), `createdAt`, `orderNumber`, `customerName`, `packagesCount`, `totalWeightKg` |
| `order` | `asc` (по умолчанию) или `desc` |

Пример: `GET /shipments?status=new&plannedFrom=2026-11-01&plannedTo=2026-11-07&sort=plannedDate`.

```json
{
  "data": [{ "id": "…", "orderNumber": "ORD-1001", "status": "new", "plannedDate": "2026-11-02", "qrCode": "SHP-5970B8CD152DA8F6" }],
  "meta": { "page": 1, "limit": 20, "total": 1, "pages": 1, "sort": "plannedDate", "order": "asc" }
}
```

Поле сортировки не из списка, например `sort=passwordHash`, — `400`.

### GET /shipments/stats

```json
{
  "data": {
    "total": 5,
    "byStatus": { "new": 3, "picking": 1, "packed": 0, "shipped": 0, "delivered": 0, "cancelled": 1 },
    "plannedToday": 1,
    "overdue": 1,
    "packages": 8,
    "weightKg": 95
  }
}
```

`plannedToday` и `overdue` — незакрытые отгрузки (`new`, `picking`, `packed`) на сегодня и с прошедшей плановой датой. `packages` и `weightKg` считаются без отменённых.

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
