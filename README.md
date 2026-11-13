# WMS — система управления складом и отгрузкой товаров с QR-кодами

Курсовой проект по дисциплине «Интернет-технологии и веб-программирование». Система ведёт отгрузки со склада: кладовщик создаёт отгрузку, сервер выдаёт ей уникальный QR-код для этикетки, а на каждом этапе (сборка, упаковка, отгрузка, доставка) этикетку сканируют камерой телефона или ручным сканером.

| Часть | Технологии | Хостинг |
|---|---|---|
| Бэкенд (REST API) | Node.js 22, Express 5, Sequelize 6, JWT, Joi, Helmet, qrcode, Winston | Render (free) |
| Фронтенд | React 19, Vite 8, React Router 7, html5-qrcode | Vercel (Hobby) |
| База данных | PostgreSQL 16 | Neon (free) |
| CI/CD | GitHub Actions | — |
| Мониторинг | UptimeRobot, Healthchecks.io, Sentry, Better Stack Logs, Telegram, `/metrics` и `/status` | — |

## Ссылки

> Заполняются после деплоя: замените значения в угловых скобках на свои.

| Что | Ссылка |
|---|---|
| Приложение (фронтенд) | <https://ВАШ-ПРОЕКТ.vercel.app> |
| API (бэкенд) | <https://ВАШ-СЕРВИС.onrender.com> |
| Проверка доступности | <https://ВАШ-СЕРВИС.onrender.com/health> |
| Дашборд метрик сервера | <https://ВАШ-СЕРВИС.onrender.com/status> |
| Swagger | <https://ВАШ-СЕРВИС.onrender.com/api-docs> |
| Статус-страница UptimeRobot | <https://stats.uptimerobot.com/ВАШ-ID> |
| Heartbeat (Healthchecks.io) | <https://healthchecks.io/projects/ВАШ-ПРОЕКТ/checks/> |
| Ошибки (Sentry) | <https://ВАША-ОРГАНИЗАЦИЯ.sentry.io/issues/> |
| Логи (Better Stack) | <https://telemetry.betterstack.com/> → источник `wms-api` |
| Сборки (GitHub Actions) | <https://github.com/mariaptk/wms-qr-system/actions> |
| Уведомления (Telegram-бот) | <https://t.me/ИМЯ_ВАШЕГО_БОТА> |

Контакт для уведомлений: Telegram-бот `@ИМЯ_ВАШЕГО_БОТА` присылает статус каждой сборки (GitHub Actions), старт сервера и ошибки 5xx (бэкенд). О падении сервера сообщает `@HealthchecksBot` в тот же чат.

Демо-учётные записи (создаются командой `npm run seed:demo`):

| Роль | Email | Пароль |
|---|---|---|
| Администратор | значение `ADMIN_EMAIL` | значение `ADMIN_PASSWORD` |
| Старший смены (`moderator`) | `senior@example.com` | значение `DEMO_PASSWORD` (по умолчанию `Sklad2026!`) |
| Кладовщик (`user`) | `ivanova@example.com`, `petrov@example.com` | то же |

## Работы по ветке

| Ветка | Работа | Что добавлено |
|---|---|---|
| `ipr21` | ИПР1 «Безопасный REST API» | пользователи и роли, JWT и refresh-cookie, CSRF, блокировка входа, лимиты, аудит, товары и ячейки хранения |
| `kr21` | КР1 «Серверная разработка» | отгрузки с QR-кодами: CRUD, статусы, поиск по QR, картинка для этикетки, фильтры, статистика, коллекция Postman |
| `ipr22` | ИПР2 «Деплой и мониторинг» | фронтенд, CI/CD, деплой, `/health`, `/metrics`, `/status`, Sentry, Better Stack, Telegram, демо-данные |

## Возможности

- **Сводка**: отгрузки на сегодня, просроченные, распределение по статусам, количество мест и вес.
- **Отгрузки**: список с поиском, фильтром по статусу и датам, сортировкой и страницами; создание и изменение с проверкой полей.
- **Карточка отгрузки**: смена статуса по цепочке `new → picking → packed → shipped → delivered` (отмена — до отгрузки), этикетка с QR-кодом, печать и скачивание PNG.
- **Сканер QR**: камера телефона (html5-qrcode) или ручной ввод; найденную отгрузку можно сразу перевести на следующий этап.
- **Справочники**: товары и ячейки хранения.
- **Мониторинг**: метрики бэкенда в реальном времени и кнопки тестовых ошибок для Sentry (только администратор).

Права: кладовщик создаёт отгрузки, меняет свои и переводит любые по статусам; старший смены меняет любые; удаляет только администратор.

## Локальный запуск

Нужны Node.js 22 (не ниже 20.19) и PostgreSQL 16.

### 1. База данных

**Docker:**

```bash
docker compose up -d
docker compose exec postgres psql -U wms -d wms -c "CREATE DATABASE wms_test OWNER wms;"
```

**Установленный PostgreSQL** (pgAdmin → Query Tool или `psql -U postgres`):

```sql
CREATE ROLE wms LOGIN PASSWORD 'wms';
CREATE DATABASE wms OWNER wms;
CREATE DATABASE wms_test OWNER wms;
```

### 2. Бэкенд

```bash
git clone https://github.com/mariaptk/wms-qr-system.git
cd wms-qr-system
git checkout ipr22
npm install
cp .env.example .env          # Windows: copy .env.example .env
npm run seed:demo             # таблицы, администратор и демо-данные
npm run dev                   # http://localhost:3000
```

В `.env` обязательно задаются `DATABASE_URL`, `JWT_SECRET` и `JWT_REFRESH_SECRET` (два разных значения не короче 32 символов), `ADMIN_EMAIL` и `ADMIN_PASSWORD`. Секрет можно сгенерировать так:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Фронтенд

```bash
cd frontend
npm install
cp .env.example .env.local    # Windows: copy .env.example .env.local
npm run dev                   # http://localhost:5173
```

Откройте <http://localhost:5173> и войдите администратором или демо-сотрудником.

## Заполнение базы данных

| Команда | Что делает |
|---|---|
| `npm run seed` | создаёт недостающие таблицы и столбцы и администратора; данные не трогает |
| `npm run seed:demo` | то же плюс демо-данные; повторный запуск ничего не дублирует |
| `npm run db:reset` | **удаляет все данные**, пересоздаёт таблицы и администратора |
| `npm run db:reset:demo` | то же плюс демо-данные |

Демо-данные охватывают все три работы:

| Таблица | Работа | Что создаётся |
|---|---|---|
| `users` | ИПР1 | администратор, старший смены и два кладовщика — все три роли |
| `products` | ИПР1 | 10 товаров (молочная продукция, бакалея, упаковка), один снят с продажи |
| `storage_locations` | ИПР1 | 10 ячеек в зонах приёмки, хранения, холодильной камеры, упаковки и отгрузки, одна заблокирована |
| `shipments` | КР1 | 15 отгрузок во всех шести статусах с датами от «4 дня назад» до «через неделю», среди них просроченная |
| `sessions`, `audit_logs` | ИПР1 | заполняются сами при входе и действиях администратора |

Плановые даты считаются от дня запуска, поэтому для свежей картины на защите выполните `npm run db:reset:demo`. Коллекции Postman при этом продолжают работать: КР1 создаёт свои отгрузки с уникальными номерами.

**Production-база (Neon).** Команда запускается на своём компьютере, но с адресом базы Neon. Переменные из терминала важнее файла `.env`, поэтому локальный `.env` менять не нужно:

```powershell
# PowerShell (Windows)
$env:DATABASE_URL="postgresql://ЛОГИН:ПАРОЛЬ@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
$env:DATABASE_SSL="true"
$env:ADMIN_PASSWORD="ВашНадёжныйПароль1!"
npm run seed:demo
```

```bash
# bash (Linux, macOS)
DATABASE_URL="postgresql://...neon.tech/neondb?sslmode=require" DATABASE_SSL=true ADMIN_PASSWORD="ВашНадёжныйПароль1!" npm run seed:demo
```

После этого закройте окно терминала, чтобы следующие команды снова работали с локальной базой.

## CI/CD

Файл [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) запускается при push в `main` или `ipr22`, при pull request в `main` и вручную (Actions → CI/CD → Run workflow).

```
backend (ESLint, Jest на PostgreSQL) ──┬──> docker (сборка образа и проверка запуска)
frontend (ESLint, Vitest, сборка Vite) ─┤
                                        └──> deploy-backend (Render Deploy Hook, ожидание нового коммита на /health)
                                               └──> deploy-frontend (vercel pull → build → deploy --prebuilt)
notify (всегда): итог каждого этапа в Telegram
```

Деплой начинается, только если прошли все проверки. Render получает хеш именно того коммита, который прошёл тесты, а workflow ждёт, пока `/health` вернёт этот хеш. Pull request проходит только проверки, без деплоя.

### Секреты и переменные GitHub

Settings → Secrets and variables → Actions:

| Имя | Тип | Откуда взять |
|---|---|---|
| `RENDER_DEPLOY_HOOK_URL` | secret | Render → сервис → Settings → Deploy Hook |
| `VERCEL_TOKEN` | secret | Vercel → Account Settings → Tokens → Create |
| `VERCEL_ORG_ID` | secret | Vercel → Team Settings → General → Team ID (для личного аккаунта — Account Settings → General → Vercel ID) |
| `VERCEL_PROJECT_ID` | secret | Vercel → проект → Settings → General → Project ID |
| `TELEGRAM_BOT_TOKEN` | secret | @BotFather → `/newbot` |
| `TELEGRAM_CHAT_ID` | secret | @userinfobot → поле `Id` |
| `SENTRY_AUTH_TOKEN` | secret, необязательно | Sentry → Settings → Auth Tokens (загрузка source maps фронтенда) |
| `BACKEND_URL` | variable | `https://ВАШ-СЕРВИС.onrender.com` |
| `FRONTEND_URL` | variable | `https://ВАШ-ПРОЕКТ.vercel.app` |
| `SENTRY_ORG`, `SENTRY_FRONTEND_PROJECT` | variable, необязательно | slug организации и проекта React в Sentry |

## Деплой с нуля

1. **Neon.** Зарегистрируйтесь на <https://neon.tech> через GitHub, создайте проект `wms` (регион Frankfurt), скопируйте строку подключения из Connection Details.
2. **Render.** <https://render.com> → New → Blueprint → репозиторий `wms-qr-system`, ветка `ipr22`. Render прочитает [`render.yaml`](render.yaml) и попросит значения: `DATABASE_URL` из Neon, `CORS_ORIGINS` — адрес фронтенда на Vercel (пока можно `http://localhost:5173`, после шага 3 поменять), остальные можно оставить пустыми и заполнить позже. Скопируйте адрес сервиса `https://….onrender.com` и Deploy Hook (Settings).
3. **Vercel.** <https://vercel.com> → Add New → Project → импорт репозитория, **Root Directory: `frontend`**, Framework: Vite. В Environment Variables добавьте `VITE_API_URL` = адрес Render (и `VITE_SENTRY_DSN`, когда появится). Deploy. Затем впишите адрес `https://….vercel.app` в `CORS_ORIGINS` на Render.
4. **База.** Заполните production-базу командой из раздела «Заполнение базы данных».
5. **GitHub.** Добавьте секреты и переменные из таблицы выше. Сделайте push в `ipr22` — workflow протестирует, задеплоит и пришлёт сообщение в Telegram.

Автодеплой самих Render и Vercel выключен (`autoDeployTrigger: off` в `render.yaml`, `git.deploymentEnabled: false` в `frontend/vercel.json`): выкладку делает только GitHub Actions после тестов.

## Мониторинг

| Задача | Инструмент | Как настроено |
|---|---|---|
| Доступность | UptimeRobot | HTTP-мониторы `…/health` бэкенда и главной страницы фронтенда раз в 5 минут: время ответа, uptime, публичная статус-страница, письмо при падении. Запросы раз в 5 минут заодно не дают бесплатному сервису Render уснуть |
| Падение → Telegram | Healthchecks.io | бэкенд раз в минуту шлёт heartbeat на `HEALTHCHECKS_PING_URL` (при недоступной базе — `/fail`); нет сигнала 1 мин + 3 мин grace — `@HealthchecksBot` пишет в Telegram. На бесплатном UptimeRobot интеграции с Telegram нет |
| Логи | Better Stack Logs | транспорт `@logtail/winston`: старт и остановка сервера, каждый запрос (метод, маршрут, код, время), ошибки со стеком, события безопасности |
| Ошибки | Sentry | `@sentry/node` (необработанные исключения и ответы 5xx), `@sentry/react` (ErrorBoundary, ошибки в браузере), source maps загружаются из CI |
| Уведомления | Telegram | сборки — из GitHub Actions; ошибки 5xx и старт сервера — из бэкенда; падение и восстановление — из Healthchecks.io |
| Метрики | `/metrics`, `/status` | время работы, память, CPU, счётчики запросов по кодам и маршрутам, время ответа (среднее, p95), график за час |

Интеграции включаются переменными окружения на Render: `SENTRY_DSN`, `BETTER_STACK_SOURCE_TOKEN` и `BETTER_STACK_INGESTING_HOST`, `TELEGRAM_BOT_TOKEN` и `TELEGRAM_CHAT_ID`, `HEALTHCHECKS_PING_URL`. Без них сервер работает как раньше, только с файловыми логами. Подключённые интеграции видны на странице `/status` и в разделе «Мониторинг» фронтенда.

Проверка базы в `/health`, `/metrics` и heartbeat кешируется на 15 минут (`HEALTH_DB_CACHE_MS`). Neon на бесплатном тарифе даёт 100 вычислительных часов в месяц и засыпает после 5 минут без запросов; без кеша запросы раз в несколько минут держали бы базу включённой круглосуточно (около 186 часов в месяц), и Neon приостановил бы её до конца месяца.

Пароли, токены, cookie и заголовок `Authorization` маскируются (`[скрыто]`) перед записью в логи, Sentry и Telegram ([`src/utils/redact.js`](src/utils/redact.js)).

Проверка Sentry: войдите администратором → «Мониторинг» → «Ошибка на сервере» (вызывает `POST /monitoring/test-error`) или «Ошибка во фронтенде».

## API

Полное описание — в [API.md](API.md) и Swagger (`/api-docs`).

| Метод и путь | Доступ |
|---|---|
| `GET /health`, `GET /metrics`, `GET /status` | все |
| `POST /monitoring/test-error` | `admin` |
| `POST /auth/register`, `POST /auth/login` | все |
| `POST /auth/refresh`, `POST /auth/logout` | cookie `refreshToken` и заголовок `X-CSRF-Token` |
| `GET /auth/me`, `GET /auth/sessions`, `POST /auth/logout-all` | после входа |
| `GET /shipments`, `GET /shipments/stats`, `GET /shipments/scan/:code`, `GET /shipments/:id`, `GET /shipments/:id/qr` | после входа |
| `POST /shipments`, `PATCH /shipments/:id/status` | после входа |
| `PUT /shipments/:id` | автор отгрузки, `moderator`, `admin` |
| `DELETE /shipments/:id` | `admin` |
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

Access-токен живёт 15 минут и передаётся в заголовке `Authorization: Bearer <token>`. Refresh-токен живёт 7 дней в cookie `HttpOnly; Path=/auth` и при каждом обновлении заменяется. Локально cookie `SameSite=Strict`; в production фронтенд и API находятся на разных сайтах, поэтому `COOKIE_SAMESITE=none` (cookie автоматически становится `Secure`), а от CSRF защищает заголовок `X-CSRF-Token`.

Формат ответов: успех — `{ "data": ... }`, ошибка — `{ "error": { "message": "...", "details": ... } }`.

## Postman

| Файл | Что проверяет |
|---|---|
| [`postman/WMS-KR1.postman_collection.json`](postman/WMS-KR1.postman_collection.json) | 45 запросов: вход, CRUD отгрузок, статусы, QR-код, фильтры, статистика, ошибки и права доступа |
| [`postman/WMS-API.postman_collection.json`](postman/WMS-API.postman_collection.json) | 43 запроса: меры защиты ИПР1 (нужна чистая база: `npm run db:reset`) |

Для проверки production замените переменную коллекции `baseUrl` на адрес Render.

## Скрипты

| Команда | Где | Что делает |
|---|---|---|
| `npm run dev` / `npm start` | корень | бэкенд с автоперезапуском / без |
| `npm test` | корень | 47 тестов Jest и Supertest на базе `wms_test` |
| `npm run lint` | корень | ESLint бэкенда |
| `npm run dev` | `frontend` | фронтенд на <http://localhost:5173> |
| `npm run build` | `frontend` | сборка в `frontend/dist` |
| `npm test` / `npm run lint` | `frontend` | Vitest / ESLint фронтенда |

## Безопасность

- Helmet (CSP, `X-Frame-Options: DENY`, `nosniff`), HSTS и те же заголовки на Vercel;
- лимиты запросов: общий с IP, на вход и регистрацию, на пользователя, на служебные адреса мониторинга;
- Joi-валидация тела, пути и строки запроса, лишние поля отбрасываются;
- запросы к базе только через Sequelize с привязкой параметров, SQL-шаблоны в query отклоняются;
- bcrypt (12 раундов) для паролей, SHA-256 для refresh-токенов, ротация refresh-токена, лимит сессий, блокировка после 5 неудачных входов;
- CORS по белому списку `CORS_ORIGINS`, CSRF double-submit для `/auth/refresh` и `/auth/logout`;
- HTTPS на Render и Vercel, `TRUST_PROXY=true` за прокси Render;
- секреты только в переменных окружения (`.env`, Render, Vercel, GitHub Secrets), `.env` не коммитится.

## Структура

```
.github/workflows/deploy.yml   CI/CD
render.yaml                    описание сервиса Render (Blueprint)
Dockerfile                     образ бэкенда
src/
  instrument.js    подключение Sentry (загружается первым)
  config/          переменные окружения, база, синхронизация схемы
  constants/       роли, статусы отгрузок и переходы
  models/          User, Session, Shipment, Product, StorageLocation, AuditLog
  middleware/      аутентификация, роли, валидация, лимиты, защита, журнал запросов, ошибки
  validators/      схемы Joi
  services/        аутентификация, аудит, метрики, проверка базы, Telegram
  controllers/     обработчики маршрутов
  routes/          маршруты, в том числе monitoring.js (/health, /metrics, /status)
  views/status.html  страница метрик
  utils/           логирование (Winston + Better Stack), маскирование секретов, токены, cookie
  seed.js, demoData.js  администратор и демо-данные
frontend/
  src/pages/       страницы: вход, сводка, отгрузки, карточка, сканер, справочники, мониторинг
  src/api.js       клиент API с обновлением токена
  src/sentry.js    Sentry для React
  vercel.json      настройки Vercel
tests/             Jest и Supertest
postman/           коллекции Postman
```
