const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { sequelize, User, AuditLog } = require('../src/models');
const { warmDummyHash } = require('../src/services/authService');
const { clearSecurityEvents, securityEvents } = require('../src/utils/logger');

const PASSWORD = 'Password1!';

async function createUser({ email, role = 'user', password = PASSWORD, name }) {
  return User.create({
    email,
    role,
    name: name || role,
    passwordHash: await bcrypt.hash(password, 4),
  });
}

async function login(agent, email, password = PASSWORD) {
  const res = await agent.post('/auth/login').send({ email, password });
  return res;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function cookieHeader(setCookie) {
  const list = Array.isArray(setCookie) ? setCookie : [setCookie];
  return list.map((item) => item.split(';')[0]).join('; ');
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await warmDummyHash();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  clearSecurityEvents();
  await sequelize.query(
    'TRUNCATE TABLE audit_logs, sessions, products, storage_locations, users RESTART IDENTITY CASCADE',
  );
});

describe('регистрация и вход', () => {
  test('регистрация создаёт пользователя с ролью user и не возвращает хеш', async () => {
    const res = await request(app).post('/auth/register').send({
      email: 'Worker@Example.com',
      password: PASSWORD,
      name: 'Кладовщик',
      role: 'admin',
      passwordHash: 'stolen',
      failedAttempts: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe('worker@example.com');
    expect(res.body.data.role).toBe('user');
    expect(res.body.data.passwordHash).toBeUndefined();

    const stored = await User.unscoped().findByPk(res.body.data.id);
    expect(stored.role).toBe('user');
    expect(stored.passwordHash).not.toBe('stolen');
    expect(stored.passwordHash.startsWith('$2')).toBe(true);
  });

  test('отклоняет неверный email и слабый пароль', async () => {
    const email = await request(app).post('/auth/register').send({
      email: 'not-an-email',
      password: PASSWORD,
    });
    expect(email.status).toBe(400);
    expect(email.body.error.details.some((item) => item.field === 'email')).toBe(true);

    const short = await request(app).post('/auth/register').send({
      email: 'short@example.com',
      password: 'Ab1!',
    });
    expect(short.status).toBe(400);

    const noSpecial = await request(app).post('/auth/register').send({
      email: 'nospecial@example.com',
      password: 'Password1',
    });
    expect(noSpecial.status).toBe(400);
    expect(JSON.stringify(noSpecial.body)).toMatch(/спецсимвол/);
  });

  test('логин выдаёт access JWT и httpOnly refresh cookie', async () => {
    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
      name: 'Кладовщик',
    });

    const res = await request(app).post('/auth/login').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.tokenType).toBe('Bearer');
    expect(res.body.data.refreshToken).toBeUndefined();
    expect(res.body.data.user.passwordHash).toBeUndefined();

    const cookies = res.headers['set-cookie'].map((item) => item.toLowerCase());
    const refresh = cookies.find((item) => item.startsWith('refreshtoken='));
    const csrf = cookies.find((item) => item.startsWith('csrf_token='));
    expect(refresh).toContain('httponly');
    expect(csrf).not.toContain('httponly');
  });

  test('GET /auth/me без токена недоступен, с токеном возвращает профиль', async () => {
    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });
    const denied = await request(app).get('/auth/me');
    expect(denied.status).toBe(401);

    const agent = request.agent(app);
    const logged = await login(agent, 'worker@example.com');
    const me = await request(app).get('/auth/me').set(auth(logged.body.data.accessToken));
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe('worker@example.com');
    expect(me.body.data.passwordHash).toBeUndefined();
  });

  test('пять неудачных входов блокируют учётную запись на 15 минут', async () => {
    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const res = await request(app).post('/auth/login').send({
        email: 'worker@example.com',
        password: 'wrong-password',
      });
      expect(res.status).toBe(401);
    }

    const locked = await request(app).post('/auth/login').send({
      email: 'worker@example.com',
      password: 'wrong-password',
    });
    expect(locked.status).toBe(423);
    expect(locked.body.error.details.lockedUntil).toEqual(expect.any(String));

    const correctDuringLock = await request(app).post('/auth/login').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });
    expect(correctDuringLock.status).toBe(423);
    expect(securityEvents.some((event) => event.event === 'login_locked')).toBe(true);
    expect(JSON.stringify(securityEvents)).not.toContain(PASSWORD);
    expect(JSON.stringify(securityEvents)).not.toContain('wrong-password');
  });

  test('неизвестный email получает тот же ответ, что и неверный пароль', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'missing@example.com',
      password: PASSWORD,
    });
    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Неверный email или пароль');
  });
});

describe('роли и чужие ресурсы', () => {
  test('кладовщик не удаляет товар, администратор удаляет и попадает в аудит', async () => {
    const worker = await createUser({ email: 'worker@example.com', role: 'user' });
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const workerLogin = await request(app).post('/auth/login').send({
      email: worker.email,
      password: PASSWORD,
    });
    const adminLogin = await request(app).post('/auth/login').send({
      email: admin.email,
      password: PASSWORD,
    });

    const created = await request(app)
      .post('/products')
      .set(auth(workerLogin.body.data.accessToken))
      .send({ sku: 'MILK-01', name: 'Молоко', unit: 'pcs', createdBy: admin.id });
    expect(created.status).toBe(201);
    expect(created.body.data.createdBy).toBe(worker.id);

    const denied = await request(app)
      .delete(`/products/${created.body.data.id}`)
      .set(auth(workerLogin.body.data.accessToken));
    expect(denied.status).toBe(403);
    expect(securityEvents.some((event) => event.event === 'forbidden_role')).toBe(true);

    const removed = await request(app)
      .delete(`/products/${created.body.data.id}`)
      .set(auth(adminLogin.body.data.accessToken));
    expect(removed.status).toBe(200);

    const audit = await AuditLog.findOne({ where: { action: 'product.deleted' } });
    expect(audit).not.toBeNull();
    expect(audit.userId).toBe(admin.id);
  });

  test('кладовщик не меняет товар, старший смены меняет', async () => {
    const worker = await createUser({ email: 'worker@example.com', role: 'user' });
    const moderator = await createUser({ email: 'shift@example.com', role: 'moderator' });
    const workerLogin = await login(request(app), worker.email);
    const moderatorLogin = await login(request(app), moderator.email);

    const created = await request(app)
      .post('/products')
      .set(auth(workerLogin.body.data.accessToken))
      .send({ sku: 'BOX-1', name: 'Коробка' });

    const denied = await request(app)
      .patch(`/products/${created.body.data.id}`)
      .set(auth(workerLogin.body.data.accessToken))
      .send({ name: 'Чужая правка' });
    expect(denied.status).toBe(403);

    const updated = await request(app)
      .patch(`/products/${created.body.data.id}`)
      .set(auth(moderatorLogin.body.data.accessToken))
      .send({ name: 'Коробка большая' });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Коробка большая');
  });

  test('чужой профиль недоступен, свой доступен, удаление пользователя только у admin', async () => {
    const worker = await createUser({ email: 'worker@example.com', role: 'user' });
    const other = await createUser({ email: 'other@example.com', role: 'user' });
    const admin = await createUser({ email: 'admin@example.com', role: 'admin' });
    const workerLogin = await login(request(app), worker.email);
    const adminLogin = await login(request(app), admin.email);
    const token = workerLogin.body.data.accessToken;

    const foreign = await request(app).get(`/users/${other.id}`).set(auth(token));
    expect(foreign.status).toBe(403);
    expect(securityEvents.some((event) => event.event === 'forbidden_resource')).toBe(true);

    const own = await request(app).get(`/users/${worker.id}`).set(auth(token));
    expect(own.status).toBe(200);

    const listDenied = await request(app).get('/users').set(auth(token));
    expect(listDenied.status).toBe(403);

    const removeDenied = await request(app).delete(`/users/${other.id}`).set(auth(token));
    expect(removeDenied.status).toBe(403);

    const removed = await request(app).delete(`/users/${other.id}`).set(auth(adminLogin.body.data.accessToken));
    expect(removed.status).toBe(200);
  });

  test('профиль не принимает смену роли', async () => {
    const worker = await createUser({ email: 'worker@example.com', role: 'user' });
    const logged = await login(request(app), worker.email);

    const res = await request(app)
      .patch(`/users/${worker.id}`)
      .set(auth(logged.body.data.accessToken))
      .send({ name: 'Новое имя', role: 'admin', failedAttempts: 0 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Новое имя');
    expect(res.body.data.role).toBe('user');
  });
});

describe('refresh, CSRF и сессии', () => {
  test('обновление токена требует CSRF и отзывает старый refresh', async () => {
    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });
    const agent = request.agent(app);
    const logged = await login(agent, 'worker@example.com');
    const csrf = logged.body.data.csrfToken;

    const missing = await agent.post('/auth/refresh').send({});
    expect(missing.status).toBe(403);
    expect(securityEvents.some((event) => event.event === 'csrf_rejected')).toBe(true);

    const refreshed = await agent.post('/auth/refresh').set('X-CSRF-Token', csrf).send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.accessToken).toEqual(expect.any(String));

    const reuse = await request(app)
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(logged.headers['set-cookie']))
      .set('X-CSRF-Token', csrf)
      .send({});
    expect(reuse.status).toBe(401);
  });

  test('четвёртый вход отзывает самую старую сессию', async () => {
    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });

    const sessions = [];
    for (let index = 0; index < 3; index += 1) {
      const agent = request.agent(app);
      const res = await login(agent, 'worker@example.com');
      sessions.push({ agent, csrf: res.body.data.csrfToken });
    }

    const fourth = request.agent(app);
    const extra = await login(fourth, 'worker@example.com');
    expect(extra.status).toBe(200);

    const oldest = await sessions[0].agent
      .post('/auth/refresh')
      .set('X-CSRF-Token', sessions[0].csrf)
      .send({});
    expect(oldest.status).toBe(401);

    const newest = await fourth
      .post('/auth/refresh')
      .set('X-CSRF-Token', extra.body.data.csrfToken)
      .send({});
    expect(newest.status).toBe(200);

    const list = await request(app)
      .get('/auth/sessions')
      .set(auth(newest.body.data.accessToken));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeLessThanOrEqual(3);
  });
});

describe('защита входа', () => {
  test('публичный каталог, создание только с токеном, HTML вырезается', async () => {
    const empty = await request(app).get('/products');
    expect(empty.status).toBe(200);

    const denied = await request(app).post('/products').send({ sku: 'A-1', name: 'Товар' });
    expect(denied.status).toBe(401);

    await request(app).post('/auth/register').send({
      email: 'worker@example.com',
      password: PASSWORD,
    });
    const logged = await login(request(app), 'worker@example.com');
    const created = await request(app)
      .post('/products')
      .set(auth(logged.body.data.accessToken))
      .send({ sku: 'A-1', name: '<script>alert(1)</script>Молоко', description: '<b>жирное</b>' });

    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('alert(1)Молоко');
    expect(created.body.data.description).toBe('жирное');
  });

  test('ячейки склада не отдаются без токена', async () => {
    const res = await request(app).get('/locations');
    expect(res.status).toBe(401);
  });

  test('SQL-подобный query отклоняется, обычный поиск проходит', async () => {
    const attack = await request(app).get('/products').query({ search: "' OR 1=1 --" });
    expect(attack.status).toBe(400);
    expect(securityEvents.some((event) => event.event === 'sql_injection_attempt')).toBe(true);

    const safe = await request(app).get('/products').query({ search: 'молоко' });
    expect(safe.status).toBe(200);
  });

  test('не-JSON и слишком большое тело отклоняются', async () => {
    const text = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'text/plain')
      .send('email=a');
    expect(text.status).toBe(415);

    const huge = await request(app)
      .post('/auth/register')
      .send({
        email: 'big@example.com',
        password: PASSWORD,
        name: 'a'.repeat(150 * 1024),
      });
    expect(huge.status).toBe(413);
  });

  test('чужой Origin запрещён, свой разрешён', async () => {
    const evil = await request(app).get('/products').set('Origin', 'https://evil.example');
    expect(evil.status).toBe(403);

    const allowed = await request(app).get('/products').set('Origin', 'http://localhost:5173');
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('заголовки helmet запрещают встраивание в frame', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toMatch(/frame-ancestors 'none'/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('битый токен пишется в журнал и не раскрывает стек', async () => {
    const res = await request(app).get('/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.stack).toBeUndefined();
    expect(res.body.error.stack).toBeUndefined();
    expect(securityEvents.some((event) => event.event === 'invalid_token')).toBe(true);
  });
});
