# WMS — система управления складом и отгрузкой товаров

Серверная часть системы складского учёта. В текущей версии реализован безопасный REST API: пользователи и роли, справочники товаров и ячеек хранения, журнал аудита. Приёмка, размещение и отгрузка с подтверждением операций по QR-кодам строятся поверх этого API.

Стек: Node.js, Express 5, PostgreSQL 16, Sequelize 6, JWT, bcrypt, Joi, Helmet, Winston, Jest.

## Роли

| Роль | Кто на складе | Права |
|---|---|---|
| `user` | кладовщик | просмотр справочников, создание товаров, свой профиль |
| `moderator` | старший смены | права кладовщика, изменение товаров, создание и изменение ячеек |
| `admin` | администратор | пользователи и роли, удаление товаров и ячеек, журнал аудита |

При регистрации всегда назначается роль `user`, роль меняет только администратор.

## Требования

- Node.js 18 или новее
- PostgreSQL 16 (локально или в Docker)

## Установка и запуск

### 1. Зависимости

```bash
git clone https://github.com/mariaptk/wms-qr-system.git
cd wms-qr-system
git checkout ipr21
npm install
```

### 2. База данных

Нужны две базы: `wms` для работы и `wms_test` для автотестов.

**Docker:**

```bash
docker compose up -d
docker compose exec postgres psql -U wms -d wms -c "CREATE DATABASE wms_test OWNER wms;"
```

**Установленный PostgreSQL** (pgAdmin → Query Tool или `psql -U postgres`), команды выполняются по одной:

```sql
CREATE ROLE wms LOGIN PASSWORD 'wms';
CREATE DATABASE wms OWNER wms;
CREATE DATABASE wms_test OWNER wms;
```

### 3. Переменные окружения

```bash
cp .env.example .env        # Windows: copy .env.example .env
```

В `.env` обязательно задаются:

| Переменная | Значение |
|---|---|
| `DATABASE_URL` | `postgres://ЛОГИН:ПАРОЛЬ@127.0.0.1:5432/wms` |
| `TEST_DATABASE_URL` | то же, база `wms_test` |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | два разных случайных секрета, не короче 32 символов |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | учётная запись администратора, создаётся командой `npm run seed` |

Секрет можно сгенерировать так:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Остальные параметры (лимиты запросов, размер тела, число сессий, белый список CORS) описаны в `.env.example`. Файл `.env` в репозиторий не попадает.

### 4. Запуск

```bash
npm run seed     # таблицы и администратор
npm run dev      # сервер с автоперезапуском
```

- API: http://localhost:3000
- Проверка: http://localhost:3000/health
- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON: http://localhost:3000/api-docs.json

## Скрипты

| Команда | Что делает |
|---|---|
| `npm run dev` | запуск через nodemon |
| `npm start` | запуск без автоперезапуска |
| `npm run seed` | создаёт таблицы и администратора, данные не трогает |
| `npm run db:reset` | пересоздаёт все таблицы и администратора |
| `npm test` | тесты Jest и Supertest на базе `wms_test` |
| `npm run lint` | ESLint |

## API

Полное описание запросов и ответов — в [API.md](API.md) и в Swagger.

| Метод и путь | Доступ |
|---|---|
| `POST /auth/register`, `POST /auth/login` | все |
| `POST /auth/refresh`, `POST /auth/logout` | cookie `refreshToken` и заголовок `X-CSRF-Token` |
| `GET /auth/me`, `GET /auth/sessions`, `POST /auth/logout-all` | после входа |
| `GET /products`, `GET /products/:id` | все |
| `POST /products` | после входа |
| `PATCH /products/:id` | `moderator`, `admin` |
| `DELETE /products/:id` | `admin` |
| `GET /locations`, `GET /locations/:id` | после входа |
| `POST /locations`, `PATCH /locations/:id` | `moderator`, `admin` |
| `DELETE /locations/:id` | `admin` |
| `GET /users/:id`, `PATCH /users/:id` | владелец профиля или `admin` |
| `GET /users`, `PATCH /users/:id/role`, `POST /users/:id/unlock`, `DELETE /users/:id` | `admin` |
| `GET /audit` | `admin` |

Access-токен живёт 15 минут и передаётся в заголовке `Authorization: Bearer <token>`. Refresh-токен живёт 7 дней, хранится в cookie `HttpOnly; SameSite=Strict; Path=/auth` и при каждом обновлении заменяется новым.

Формат ответов: успех — `{ "data": ... }`, ошибка — `{ "error": { "message": "...", "details": ... } }`.

## Postman

Коллекция: [`postman/WMS-API.postman_collection.json`](postman/WMS-API.postman_collection.json). Postman → Import → выбрать файл.

43 запроса в шести папках: служебное, аутентификация, товары и ячейки, администратор, блокировка входа, сессии. У запросов есть проверки статусов и содержимого ответа, токены и идентификаторы передаются через переменные коллекции, поэтому папки выполняются по порядку. Перед полным прогоном база пересоздаётся (`npm run db:reset`) и сервер перезапускается, так как счётчики лимитов хранятся в памяти.

Прогон из командной строки:

```bash
npx newman run postman/WMS-API.postman_collection.json
```

## Безопасность

Базовые меры:

- Helmet: Content-Security-Policy, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, без `X-Powered-By`;
- глобальный лимит 100 запросов за 15 минут с IP, на вход и регистрацию — 20;
- валидация Joi для тела, параметров пути и строки запроса, лишние поля отбрасываются;
- запросы к базе только через Sequelize с привязкой параметров;
- журнал подозрительных действий `logs/security-YYYY-MM-DD.log`.

Дополнительные меры (номера по перечню требований):

| № | Мера | Реализация |
|---|---|---|
| 1 | Защита от CSRF | double-submit: cookie `csrf_token` и заголовок `X-CSRF-Token` на `/auth/refresh` и `/auth/logout` |
| 3 | Сложность пароля | от 8 символов, цифра и спецсимвол |
| 5 | Короткий access-токен, refresh в httpOnly-cookie | 15 минут и 7 дней, ротация refresh-токена |
| 6 | Блокировка после неудачных входов | 5 ошибок — блокировка на 15 минут, ответ 423 |
| 7 | Аудит действий администратора | таблица `audit_logs`, `GET /audit` |
| 9 | Защита от mass assignment | `stripUnknown`, роль при регистрации всегда `user` |
| 12 | Лимит тела запроса | 100 КБ, ответ 413 |
| 13 | Content-Security-Policy | `frame-ancestors 'none'` |
| 15 | Только JSON | для POST, PUT, PATCH, иначе 415 |
| 17 | Безопасное сравнение паролей | `bcrypt.compare`, для неизвестного email — сравнение с фиктивным хешем |
| 18 | Защита от кликджекинга | `X-Frame-Options: DENY` |
| 19 | Очистка HTML | теги удаляются из строковых полей |
| 20 | Ограничение сессий | не больше 3, при новом входе отзывается самая старая |
| 22 | CORS по белому списку | `CORS_ORIGINS`, чужой Origin — 403 |
| 24 | Общие сообщения об ошибках | в production клиент видит только «Внутренняя ошибка сервера» |
| 25 | Лимит на пользователя | 60 запросов в минуту после входа |
| 29 | Проверка строки запроса | SQL-шаблоны в query отклоняются с кодом 400 |
| 30 | Журнал ошибок | `logs/error-YYYY-MM-DD.log`, ротация, хранение 14 дней |

Пароли хранятся только в виде bcrypt-хеша (12 раундов), refresh-токены — в виде SHA-256. Пароли и токены в журналы не записываются.

## Журналы

| Файл | Содержимое | Хранение |
|---|---|---|
| `logs/security-YYYY-MM-DD.log` | неудачные входы, блокировки, отказы по роли, CSRF, CORS, SQL-шаблоны, превышение лимитов | 30 дней |
| `logs/error-YYYY-MM-DD.log` | ошибки сервера со стеком | 14 дней |
| `logs/combined-YYYY-MM-DD.log` | все события | 14 дней |

## Тесты

```bash
npm test
```

24 теста: регистрация и вход, роли, валидация, блокировка, CSRF, ротация refresh-токена, лимит сессий, очистка HTML, SQL в query, Content-Type, лимиты запросов, ответ на непредвиденную ошибку. Тесты используют отдельную базу из `TEST_DATABASE_URL`.

## Структура

```
src/
  config/        переменные окружения, подключение к базе
  constants/     роли и их уровни
  models/        User, Session, Product, StorageLocation, AuditLog
  middleware/    authenticate, roleGuard, validate, лимиты, защитные проверки, обработчик ошибок
  validators/    схемы Joi
  services/      аутентификация и аудит
  controllers/   обработчики маршрутов
  routes/        маршруты
  utils/         логирование, токены, cookie, очистка строк
  docs/          OpenAPI для Swagger
  app.js, server.js, seed.js
tests/           Jest и Supertest
postman/         коллекция Postman
docs/            ответы на контрольные вопросы
```
