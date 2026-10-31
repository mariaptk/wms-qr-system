const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');
const { warmDummyHash } = require('../src/services/authService');

const PASSWORD = 'Password1!';

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

const milk = {
  sku: 'milk-01',
  name: 'Молоко 3,2%',
  category: 'food',
  unit: 'l',
  price: 2.49,
  weightKg: 1.03,
  description: 'Пастеризованное',
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
    'TRUNCATE TABLE audit_logs, sessions, products, storage_locations, users RESTART IDENTITY CASCADE',
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

async function createProduct(body = milk, token = tokens.author) {
  return request(app).post('/products').set(auth(token)).send(body);
}

describe('CRUD товаров', () => {
  test('создание, чтение, замена автором, удаление администратором', async () => {
    const created = await createProduct();
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({
      sku: 'MILK-01',
      category: 'food',
      unit: 'l',
      price: 2.49,
      weightKg: 1.03,
      isActive: true,
    });
    const { id } = created.body.data;

    const one = await request(app).get(`/products/${id}`);
    expect(one.status).toBe(200);
    expect(one.body.data.name).toBe('Молоко 3,2%');

    const replaced = await request(app)
      .put(`/products/${id}`)
      .set(auth(tokens.author))
      .send({ ...milk, name: 'Молоко 2,5%', price: 2.19, isActive: false });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data).toMatchObject({ name: 'Молоко 2,5%', price: 2.19, isActive: false });

    const byUser = await request(app).delete(`/products/${id}`).set(auth(tokens.author));
    expect(byUser.status).toBe(403);

    const byAdmin = await request(app).delete(`/products/${id}`).set(auth(tokens.admin));
    expect(byAdmin.status).toBe(200);

    const gone = await request(app).get(`/products/${id}`);
    expect(gone.status).toBe(404);
  });

  test('PUT: чужой кладовщик получает 403, администратор может', async () => {
    const { id } = (await createProduct()).body.data;

    const foreign = await request(app)
      .put(`/products/${id}`)
      .set(auth(tokens.other))
      .send({ ...milk, name: 'Подмена' });
    expect(foreign.status).toBe(403);
    expect(foreign.body.error.message).toBe('Изменять товар может только его автор или администратор');

    const admin = await request(app)
      .put(`/products/${id}`)
      .set(auth(tokens.admin))
      .send({ ...milk, price: 3 });
    expect(admin.status).toBe(200);
    expect(admin.body.data.price).toBe(3);
  });

  test('без токена изменять и удалять нельзя', async () => {
    const { id } = (await createProduct()).body.data;

    expect((await request(app).post('/products').send(milk)).status).toBe(401);
    expect((await request(app).put(`/products/${id}`).send(milk)).status).toBe(401);
    expect((await request(app).delete(`/products/${id}`)).status).toBe(401);
    expect((await request(app).get('/products/stats')).status).toBe(401);
    expect((await request(app).get('/products')).status).toBe(200);
  });
});

describe('валидация', () => {
  test('пустое тело: ошибки по всем обязательным полям', async () => {
    const res = await createProduct({});
    expect(res.status).toBe(400);
    const fields = res.body.error.details.map((item) => item.field);
    expect(fields).toEqual(expect.arrayContaining(['sku', 'name', 'category', 'price']));
  });

  test('неверные форматы и значения', async () => {
    const res = await createProduct({
      ...milk, sku: 'молоко!', category: 'toys', price: -1, weightKg: 'тяжёлый',
    });
    expect(res.status).toBe(400);
    const messages = Object.fromEntries(res.body.error.details.map((item) => [item.field, item.message]));
    expect(messages.sku).toMatch(/латиница/);
    expect(messages.category).toMatch(/Категория/);
    expect(messages.price).toBe('Цена не может быть отрицательной');
    expect(messages.weightKg).toBe('Вес должен быть числом');
  });

  test('артикул уникален без учёта регистра', async () => {
    await createProduct();
    const duplicate = await createProduct({ ...milk, sku: 'MILK-01' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toBe('Товар с таким артикулом уже существует');

    const second = (await createProduct({ ...milk, sku: 'KEFIR-01' })).body.data;
    const clash = await request(app)
      .patch(`/products/${second.id}`)
      .set(auth(tokens.author))
      .send({ sku: 'milk-01' });
    expect(clash.status).toBe(409);
  });

  test('PUT требует полную карточку, id проверяется как UUID', async () => {
    const { id } = (await createProduct()).body.data;
    const partial = await request(app).put(`/products/${id}`).set(auth(tokens.author)).send({ name: 'Только имя' });
    expect(partial.status).toBe(400);

    const badId = await request(app).get('/products/123');
    expect(badId.status).toBe(400);
  });

  test('повторная регистрация с тем же email – 409', async () => {
    const res = await request(app).post('/auth/register').send({ email: 'Author@Example.com', password: PASSWORD });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Пользователь с таким email уже существует');
  });
});

describe('фильтрация, сортировка и статистика', () => {
  beforeEach(async () => {
    await createProduct(milk);
    await createProduct({ ...milk, sku: 'KEFIR-01', name: 'Кефир', price: 1.89 });
    await createProduct({
      sku: 'SOAP-01', name: 'Мыло', category: 'household', unit: 'pcs', price: 0.99, isActive: false,
    });
    await createProduct({
      sku: 'DRILL-01', name: 'Дрель', category: 'building', unit: 'pcs', price: 120, weightKg: 1.8,
    });
  });

  test('фильтр по категории и диапазону цены, сортировка по цене', async () => {
    const food = await request(app).get('/products').query({ category: 'food', sort: 'price', order: 'asc' });
    expect(food.status).toBe(200);
    expect(food.body.data.map((item) => item.sku)).toEqual(['KEFIR-01', 'MILK-01']);
    expect(food.body.meta).toMatchObject({ total: 2, sort: 'price', order: 'asc' });

    const range = await request(app).get('/products').query({ minPrice: 1, maxPrice: 100 });
    expect(range.body.data.map((item) => item.sku).sort()).toEqual(['KEFIR-01', 'MILK-01']);

    const inactive = await request(app).get('/products').query({ isActive: false });
    expect(inactive.body.data.map((item) => item.sku)).toEqual(['SOAP-01']);

    const search = await request(app).get('/products').query({ search: 'дрел' });
    expect(search.body.data.map((item) => item.sku)).toEqual(['DRILL-01']);
  });

  test('неверные параметры списка – 400', async () => {
    const sort = await request(app).get('/products').query({ sort: 'passwordHash' });
    expect(sort.status).toBe(400);

    const range = await request(app).get('/products').query({ minPrice: 10, maxPrice: 5 });
    expect(range.status).toBe(400);
  });

  test('статистика по категориям', async () => {
    const res = await request(app).get('/products/stats').set(auth(tokens.other));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ total: 4, active: 3, inactive: 1, avgPrice: 31.34 });
    expect(res.body.data.byCategory).toEqual([
      {
        category: 'building', count: 1, active: 1, avgPrice: 120, minPrice: 120, maxPrice: 120,
      },
      {
        category: 'food', count: 2, active: 2, avgPrice: 2.19, minPrice: 1.89, maxPrice: 2.49,
      },
      {
        category: 'household', count: 1, active: 0, avgPrice: 0.99, minPrice: 0.99, maxPrice: 0.99,
      },
    ]);
  });
});
