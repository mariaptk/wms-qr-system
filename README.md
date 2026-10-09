# Система управления складом (WMS) — безопасный REST API

Серверная часть курсового проекта: учёт товаров и ячеек склада с аутентификацией, ролями и защитой от типовых уязвимостей. Это состояние лабораторной 1, ветка `ipr21`.

## Роли

| Роль в API | Кто на складе | Права |
|---|---|---|
| `user` | кладовщик | читать справочники, создавать товары, видеть только свой профиль |
| `moderator` | старший смены | всё, что может кладовщик, плюс изменение товаров и ячеек |
| `admin` | администратор | пользователи, роли, удаление, журнал аудита |

Новый пользователь всегда получает роль `user`. Назначить роль может только администратор.

## Запуск

Нужны Node.js 18+ и PostgreSQL 16.

```bash
cp .env.example .env
# поправьте JWT_SECRET и JWT_REFRESH_SECRET на свои значения длиной от 32 символов

docker compose up -d
docker compose exec postgres psql -U wms -d wms -c "CREATE DATABASE wms_test OWNER wms;"

npm install
npm run seed
npm run dev
```

Без Docker база создаётся так:

```bash
sudo -u postgres psql -c "CREATE ROLE wms LOGIN PASSWORD 'wms';"
sudo -u postgres psql -c "CREATE DATABASE wms OWNER wms;"
sudo -u postgres psql -c "CREATE DATABASE wms_test OWNER wms;"
```

- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`
- Спецификация: `http://localhost:3000/api-docs.json`
- Администратор после `npm run seed`: `admin@example.com` / `Admin123!`

Проверка и тесты:

```bash
npm test
npm run lint
```

Коллекция Postman: `postman/WMS-API.postman_collection.json`. Перед папкой «Администратор» выполните `npm run seed`.

## Эндпоинты

Подробно в [API.md](API.md).

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- `POST /auth/refresh`, `POST /auth/logout` — cookie и заголовок `X-CSRF-Token`
- `GET /products` — без токена; создание с токеном; изменение — `moderator`; удаление — `admin`
- `GET /locations` — только со входом; создание и изменение — `moderator`; удаление — `admin`
- `DELETE /users/:id` — только `admin`
- `GET /audit` — только `admin`

Access-токен передаётся заголовком `Authorization: Bearer <token>`. Refresh-токен лежит в httpOnly-cookie и в JSON не возвращается.

## Обязательные меры

- Helmet: защитные заголовки, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
- Глобальный rate limit: 100 запросов за 15 минут с одного IP
- Joi на каждом эндпоинте, лишние поля отбрасываются
- Sequelize с привязанными параметрами, SQL не собирается конкатенацией
- Подозрительные события пишутся в `logs/security-YYYY-MM-DD.log`: неудачный вход, блокировка, чужой ресурс, отказ по роли, CSRF, CORS, SQL в query, превышение лимита

## Дополнительные меры

Номера — из таблицы задания. Для склада взяты те, что закрывают общие компьютеры смены, перебор пароля и подмену справочников.

| № | Мера | Где |
|---|---|---|
| 1 | CSRF double-submit на `/auth/refresh` и `/auth/logout` | cookie `csrf_token` и заголовок `X-CSRF-Token` |
| 3 | Сложность пароля: от 8 символов, цифра и спецсимвол | регистрация |
| 5 | Короткий access JWT и refresh в httpOnly-cookie | вход и обновление |
| 6 | 5 неудачных входов, блокировка на 15 минут | `failedAttempts`, `lockUntil` |
| 7 | Аудит действий администратора | таблица `audit_logs`, `GET /audit` |
| 9 | Запрет mass assignment | Joi `stripUnknown`, роль на регистрации всегда `user` |
| 12 | Лимит тела запроса 100 КБ | `express.json({ limit })` |
| 13 | Content-Security-Policy через Helmet | `frame-ancestors 'none'` |
| 15 | Только `Content-Type: application/json` | POST, PUT, PATCH |
| 17 | `bcrypt.compare`, для неизвестного email сравнивается фиктивный хеш | вход |
| 18 | `X-Frame-Options: DENY` | Helmet |
| 19 | Удаление HTML-тегов из строк | названия товаров, имена, комментарии |
| 20 | Не больше 3 сессий, лишняя самая старая отзывается | таблица `sessions` |
| 22 | CORS по белому списку `CORS_ORIGINS` | браузерный клиент |
| 24 | В production текст непредвиденной ошибки один: «Внутренняя ошибка сервера» | обработчик ошибок |
| 25 | Отдельный лимит 60 запросов в минуту на пользователя | маршруты после входа |
| 29 | Проверка query-параметров на SQL-шаблоны | второй рубеж поверх ORM |
| 30 | Ошибки в файл с ротацией 14 дней | `logs/error-YYYY-MM-DD.log` |

Пароли и токены в журналы не пишутся.

## Что снять для отчёта

Импортируйте коллекцию Postman и по порядку сохраните ответы:

1. Регистрация и логин — в ответе есть `accessToken`, в cookie есть `refreshToken` с `HttpOnly`.
2. `GET /auth/me` без заголовка Authorization и с ним.
3. `DELETE /products/:id` от роли `user` (403) и от `admin` (200).
4. Регистрация с коротким паролем и с email без `@`.
5. Пять неверных паролей подряд — последний ответ со статусом 423.
6. `POST /auth/refresh` без `X-CSRF-Token` — 403.
7. Регистрация с полем `"role": "admin"` — в ответе роль `user`.
8. Товар с именем `<script>alert(1)</script>Молоко` — теги вырезаны.
9. `GET /products?search=' OR 1=1 --` — 400.
10. Запрос с `Content-Type: text/plain` — 415.
11. `GET /audit` от кладовщика — 403, от администратора — журнал.
12. Заголовок `X-Frame-Options: DENY` у `GET /health`.

Ответы на контрольные вопросы: [docs/lab1-kontrolnye-voprosy.md](docs/lab1-kontrolnye-voprosy.md).
