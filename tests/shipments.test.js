const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { sequelize, User, Shipment } = require('../src/models');
const { warmDummyHash } = require('../src/services/authService');
const { today } = require('../src/utils/dates');

const PASSWORD = 'Password1!';

function daysFromToday(days) {
  const date = new Date(`${today()}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function createUser(email, role = 'user') {
  return User.create({ email, role, name: role, passwordHash: await bcrypt.hash(PASSWORD, 4) });
}

async function tokenFor(email) {
  const res = await request(app).post('/auth/login').send({ email, password: PASSWORD });
  return res.body.data.accessToken;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

const order = {
  orderNumber: 'ord-1001',
  customerName: 'ООО «Гиппо»',
  deliveryAddress: 'г. Минск, ул. Притыцкого, 156',
  plannedDate: daysFromToday(1),
  packagesCount: 3,
  totalWeightKg: 42.5,
  carrier: 'Белпочта',
};

let tokens;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  await warmDummyHash();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await sequelize.query(
    'TRUNCATE TABLE audit_logs, sessions, shipments, products, storage_locations, users RESTART IDENTITY CASCADE',
  );
  await createUser('author@example.com');
  await createUser('other@example.com');
  await createUser('admin@example.com', 'admin');
  tokens = {
    author: await tokenFor('author@example.com'),
    other: await tokenFor('other@example.com'),
    admin: await tokenFor('admin@example.com'),
  };
});

async function createShipment(body = order, token = tokens.author) {
  return request(app).post('/shipments').set(auth(token)).send(body);
}

describe('CRUD отгрузок', () => {
  test('создание, чтение, замена автором и удаление администратором', async () => {
    const created = await createShipment({ ...order, status: 'shipped', qrCode: 'SHP-0000000000000000' });
    expect(created.status).toBe(201);
    const shipment = created.body.data;
    expect(shipment.orderNumber).toBe('ORD-1001');
    expect(shipment.status).toBe('new');
    expect(shipment.qrCode).toMatch(/^SHP-[0-9A-F]{16}$/);
    expect(shipment.totalWeightKg).toBe(42.5);

    const one = await request(app).get(`/shipments/${shipment.id}`).set(auth(tokens.other));
    expect(one.status).toBe(200);
    expect(one.body.data.customerName).toBe('ООО «Гиппо»');

    const replaced = await request(app)
      .put(`/shipments/${shipment.id}`)
      .set(auth(tokens.author))
      .send({ ...order, packagesCount: 4, carrier: null });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.packagesCount).toBe(4);
    expect(replaced.body.data.carrier).toBeNull();
    expect(replaced.body.data.qrCode).toBe(shipment.qrCode);

    const byUser = await request(app).delete(`/shipments/${shipment.id}`).set(auth(tokens.author));
    expect(byUser.status).toBe(403);

    const byAdmin = await request(app).delete(`/shipments/${shipment.id}`).set(auth(tokens.admin));
    expect(byAdmin.status).toBe(200);

    const gone = await request(app).get(`/shipments/${shipment.id}`).set(auth(tokens.admin));
    expect(gone.status).toBe(404);

    const audit = await request(app).get('/audit').set(auth(tokens.admin));
    expect(audit.body.data.map((row) => row.action)).toContain('shipment.deleted');
  });

  test('чужую отгрузку кладовщик не меняет, администратор меняет', async () => {
    const { body } = await createShipment();

    const other = await request(app)
      .put(`/shipments/${body.data.id}`)
      .set(auth(tokens.other))
      .send(order);
    expect(other.status).toBe(403);

    const admin = await request(app)
      .put(`/shipments/${body.data.id}`)
      .set(auth(tokens.admin))
      .send({ ...order, packagesCount: 5 });
    expect(admin.status).toBe(200);
    expect(admin.body.data.packagesCount).toBe(5);
  });

  test('без токена отгрузки недоступны', async () => {
    const { body } = await createShipment();
    const id = body.data.id;

    expect((await request(app).get('/shipments')).status).toBe(401);
    expect((await request(app).get(`/shipments/${id}`)).status).toBe(401);
    expect((await request(app).post('/shipments').send(order)).status).toBe(401);
    expect((await request(app).put(`/shipments/${id}`).send(order)).status).toBe(401);
    expect((await request(app).delete(`/shipments/${id}`)).status).toBe(401);
    expect((await request(app).get('/shipments/stats')).status).toBe(401);
  });
});

describe('валидация отгрузок', () => {
  test('пустое тело и неверные значения', async () => {
    const empty = await createShipment({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.details.map((d) => d.field).sort())
      .toEqual(['customerName', 'deliveryAddress', 'orderNumber', 'plannedDate']);

    const bad = await createShipment({
      orderNumber: '№1',
      customerName: 'А',
      deliveryAddress: 'Минск',
      plannedDate: daysFromToday(-1),
      packagesCount: 0,
      totalWeightKg: -1,
    });
    expect(bad.status).toBe(400);
    const messages = Object.fromEntries(bad.body.error.details.map((d) => [d.field, d.message]));
    expect(messages.orderNumber).toBe('Номер заказа: 3–32 символа, латиница, цифры и дефис');
    expect(messages.plannedDate).toBe('Плановая дата отгрузки не может быть в прошлом');
    expect(messages.packagesCount).toBe('Количество мест не меньше 1');
    expect(messages.totalWeightKg).toBe('Вес не может быть отрицательным');

    const noDate = await createShipment({ ...order, plannedDate: '2026-02-30' });
    expect(noDate.status).toBe(400);
    expect(noDate.body.error.details[0].message).toBe('Такой даты не существует');
  });

  test('номер заказа уникален без учёта регистра', async () => {
    await createShipment();
    const duplicate = await createShipment({ ...order, orderNumber: 'ORD-1001' }, tokens.other);
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.details).toEqual([{ field: 'orderNumber', message: 'Номер заказа занят' }]);

    const second = await createShipment({ ...order, orderNumber: 'ORD-1002' });
    const clash = await request(app)
      .put(`/shipments/${second.body.data.id}`)
      .set(auth(tokens.author))
      .send(order);
    expect(clash.status).toBe(409);
  });

  test('PUT требует полное тело, id проверяется', async () => {
    const { body } = await createShipment();
    const partial = await request(app)
      .put(`/shipments/${body.data.id}`)
      .set(auth(tokens.author))
      .send({ packagesCount: 2 });
    expect(partial.status).toBe(400);

    const badId = await request(app).get('/shipments/123').set(auth(tokens.author));
    expect(badId.status).toBe(400);
  });

  test('повторный email при регистрации — 409', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'AUTHOR@example.com', password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.details).toEqual([{ field: 'email', message: 'Email занят' }]);
  });
});

describe('статусы и QR-код', () => {
  test('статус меняется только по цепочке, отгруженную нельзя править', async () => {
    const { body } = await createShipment();
    const url = `/shipments/${body.data.id}/status`;

    const skip = await request(app).patch(url).set(auth(tokens.other)).send({ status: 'shipped' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.details).toEqual({ from: 'new', to: 'shipped', allowed: ['picking', 'cancelled'] });

    for (const status of ['picking', 'packed', 'shipped']) {
      const res = await request(app).patch(url).set(auth(tokens.other)).send({ status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
    const shipped = await Shipment.findByPk(body.data.id);
    expect(shipped.shippedAt).not.toBeNull();

    const edit = await request(app).put(`/shipments/${body.data.id}`).set(auth(tokens.author)).send(order);
    expect(edit.status).toBe(409);

    const cancel = await request(app).patch(url).set(auth(tokens.admin)).send({ status: 'cancelled' });
    expect(cancel.status).toBe(409);

    const unknown = await request(app).patch(url).set(auth(tokens.admin)).send({ status: 'lost' });
    expect(unknown.status).toBe(400);
  });

  test('поиск по QR-коду и картинка QR', async () => {
    const { body } = await createShipment();
    const { id, qrCode } = body.data;

    const scan = await request(app).get(`/shipments/scan/${qrCode.toLowerCase()}`).set(auth(tokens.other));
    expect(scan.status).toBe(200);
    expect(scan.body.data.id).toBe(id);

    const missing = await request(app).get('/shipments/scan/SHP-0000000000000000').set(auth(tokens.other));
    expect(missing.status).toBe(404);

    const malformed = await request(app).get('/shipments/scan/abc').set(auth(tokens.other));
    expect(malformed.status).toBe(400);

    const png = await request(app).get(`/shipments/${id}/qr`).set(auth(tokens.other));
    expect(png.status).toBe(200);
    expect(png.headers['content-type']).toBe('image/png');
    expect(png.body.subarray(1, 4).toString()).toBe('PNG');

    const svg = await request(app)
      .get(`/shipments/${id}/qr?format=svg`)
      .set(auth(tokens.other))
      .buffer(true)
      .parse((res, done) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => done(null, text));
      });
    expect(svg.headers['content-type']).toMatch(/^image\/svg\+xml/);
    expect(svg.body).toContain('<svg');
  });
});

describe('фильтрация, сортировка и статистика', () => {
  beforeEach(async () => {
    await createShipment({ ...order, orderNumber: 'ORD-A', plannedDate: daysFromToday(3), packagesCount: 1 });
    await createShipment({
      ...order, orderNumber: 'ORD-B', customerName: 'ИП Петров', plannedDate: daysFromToday(1), packagesCount: 2,
    });
    const c = await createShipment({
      ...order, orderNumber: 'ORD-C', plannedDate: today(), packagesCount: 4, totalWeightKg: 10,
    });
    await request(app).patch(`/shipments/${c.body.data.id}/status`).set(auth(tokens.author)).send({ status: 'picking' });
    const d = await createShipment({ ...order, orderNumber: 'ORD-D', plannedDate: today(), packagesCount: 8 });
    await request(app).patch(`/shipments/${d.body.data.id}/status`).set(auth(tokens.author)).send({ status: 'cancelled' });
    // Просроченную отгрузку API создать не даст, поэтому дата сдвигается напрямую в базе.
    const e = await createShipment({ ...order, orderNumber: 'ORD-E', packagesCount: 1, totalWeightKg: null });
    await Shipment.update({ plannedDate: daysFromToday(-2) }, { where: { id: e.body.data.id } });
  });

  async function list(query) {
    const res = await request(app).get(`/shipments${query}`).set(auth(tokens.other));
    return res;
  }

  test('по умолчанию сортировка по плановой дате', async () => {
    const res = await list('');
    expect(res.body.data.map((s) => s.orderNumber)).toEqual(['ORD-E', 'ORD-C', 'ORD-D', 'ORD-B', 'ORD-A']);
    expect(res.body.meta).toMatchObject({ total: 5, sort: 'plannedDate', order: 'asc' });
  });

  test('статус, диапазон дат, поиск и сортировка', async () => {
    const byStatus = await list('?status=new&sort=packagesCount&order=desc');
    expect(byStatus.body.data.map((s) => s.orderNumber)).toEqual(['ORD-B', 'ORD-A', 'ORD-E']);

    const range = await list(`?plannedFrom=${today()}&plannedTo=${daysFromToday(1)}&sort=orderNumber`);
    expect(range.body.data.map((s) => s.orderNumber)).toEqual(['ORD-B', 'ORD-C', 'ORD-D']);

    const search = await list(`?search=${encodeURIComponent('петров')}`);
    expect(search.body.data.map((s) => s.orderNumber)).toEqual(['ORD-B']);

    expect((await list('?sort=passwordHash')).status).toBe(400);
    expect((await list('?status=lost')).status).toBe(400);
    expect((await list(`?plannedFrom=${today()}&plannedTo=${daysFromToday(-1)}`)).status).toBe(400);
  });

  test('статистика', async () => {
    const res = await request(app).get('/shipments/stats').set(auth(tokens.other));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      total: 5,
      byStatus: { new: 3, picking: 1, packed: 0, shipped: 0, delivered: 0, cancelled: 1 },
      plannedToday: 1,
      overdue: 1,
      packages: 8,
      weightKg: 95,
    });
  });
});
