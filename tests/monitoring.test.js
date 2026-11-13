const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const { warmDummyHash } = require('../src/services/authService');
const { redact, MASK } = require('../src/utils/redact');

const PASSWORD = 'Password1!';

async function tokenFor(email, role) {
  await User.create({ email, role, name: role, passwordHash: await bcrypt.hash(PASSWORD, 4) });
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  return res.body.data.accessToken;
}

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await warmDummyHash();
});

afterAll(async () => {
  await sequelize.close();
});

describe('GET /health', () => {
  test('200, база доступна, версия и коммит', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data).toMatchObject({ status: 'ok', db: 'ok', version: expect.any(String), commit: expect.any(String) });
  });
});

describe('GET /metrics', () => {
  test('время работы, память, CPU и счётчик запросов', async () => {
    const before = (await request(app).get('/metrics')).body.data.requests.total;
    await request(app).get('/shipments');
    await request(app).get('/products');

    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    const m = res.body.data;
    expect(m.uptimeSeconds).toEqual(expect.any(Number));
    expect(m.memoryMb.rss).toBeGreaterThan(0);
    expect(m.memoryMb.heapUsed).toBeGreaterThan(0);
    expect(m.cpu).toMatchObject({ processPercent: expect.any(Number), cores: expect.any(Number) });
    expect(m.requests.total).toBeGreaterThanOrEqual(before + 3);
    expect(m.requests.byStatusClass['4xx']).toBeGreaterThanOrEqual(1);
    expect(m.requests.topRoutes).toEqual(expect.arrayContaining([{ route: 'GET /products', count: expect.any(Number) }]));
    expect(m.history.length).toBeGreaterThanOrEqual(1);
    expect(m.db.status).toBe('ok');
    expect(m.integrations).toEqual({ sentry: false, betterStack: false, telegram: false });
  });

  test('маршрут считается шаблоном, без конкретного id', async () => {
    await request(app).get('/products/00000000-0000-4000-8000-000000000000');
    const routes = (await request(app).get('/metrics')).body.data.requests.topRoutes.map((r) => r.route);
    expect(routes).toContain('GET /products/:id');
    expect(routes.some((route) => route.includes('00000000'))).toBe(false);
  });
});

describe('GET /status', () => {
  test('HTML-страница метрик', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('/metrics');
  });
});

describe('POST /monitoring/test-error', () => {
  test('без токена — 401', async () => {
    const res = await request(app).post('/monitoring/test-error').send({});
    expect(res.status).toBe(401);
  });

  test('кладовщику — 403', async () => {
    const token = await tokenFor('worker@example.com', 'user');
    const res = await request(app).post('/monitoring/test-error').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  test('администратору — 500 и счётчик 5xx растёт', async () => {
    const token = await tokenFor('boss@example.com', 'admin');
    const res = await request(app).post('/monitoring/test-error').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(500);
    expect(res.body.error.message).toMatch(/Тестовая ошибка мониторинга/);

    const m = (await request(app).get('/metrics')).body.data;
    expect(m.requests.byStatusClass['5xx']).toBeGreaterThanOrEqual(1);
    expect(m.history.at(-1).errors).toBeGreaterThanOrEqual(1);
  });
});

describe('redact', () => {
  test('скрывает пароли, токены и cookie по имени ключа', () => {
    const result = redact({
      email: 'a@b.c',
      password: 'Secret1!',
      nested: { accessToken: 'abc', refreshToken: 'def', list: [{ newPassword: 'x' }] },
      headers: { authorization: 'Bearer abc', cookie: 'refreshToken=1', 'user-agent': 'jest' },
    });
    expect(result).toEqual({
      email: 'a@b.c',
      password: MASK,
      nested: { accessToken: MASK, refreshToken: MASK, list: [{ newPassword: MASK }] },
      headers: { authorization: MASK, cookie: MASK, 'user-agent': 'jest' },
    });
  });

  test('вырезает JWT и Bearer из текста', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl';
    expect(redact(`token ${jwt} end`)).toBe(`token ${MASK} end`);
    expect(redact('Authorization: Bearer abc.def')).toBe(`Authorization: Bearer ${MASK}`);
  });
});
