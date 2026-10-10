const express = require('express');
const request = require('supertest');
const { buildLimiter } = require('../src/middleware/rateLimiters');
const { errorHandler } = require('../src/middleware/errorHandler');
const { clearSecurityEvents, securityEvents } = require('../src/utils/logger');

describe('ограничение частоты запросов', () => {
  beforeEach(() => {
    clearSecurityEvents();
  });

  test('после лимита отвечает 429 и пишет событие', async () => {
    const app = express();
    app.use(buildLimiter({ windowMs: 60_000, max: 2, event: 'rate_limit_test' }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get('/ping').expect(200);
    await request(app).get('/ping').expect(200);
    const blocked = await request(app).get('/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.body.error.message).toMatch(/Слишком много запросов/);
    expect(securityEvents.some((event) => event.event === 'rate_limit_test')).toBe(true);
  });

  test('лимит по пользователю считает ключ отдельно', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.user = { id: req.get('x-user') || 'anonymous' };
      next();
    });
    app.use(buildLimiter({
      windowMs: 60_000,
      max: 1,
      event: 'rate_limit_user',
      keyGenerator: (req) => req.user.id,
    }));
    app.get('/ping', (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    await request(app).get('/ping').set('x-user', 'u1').expect(200);
    await request(app).get('/ping').set('x-user', 'u2').expect(200);
    await request(app).get('/ping').set('x-user', 'u1').expect(429);
  });
});
