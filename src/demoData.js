const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('./config/env');
const { User, Product, StorageLocation, Shipment } = require('./models');

const USERS = [
  { email: 'senior@example.com', name: 'Ковалёв Андрей (старший смены)', role: 'moderator' },
  { email: 'ivanova@example.com', name: 'Иванова Ольга (кладовщик)', role: 'user' },
  { email: 'petrov@example.com', name: 'Петров Сергей (кладовщик)', role: 'user' },
];

const PRODUCTS = [
  { sku: 'MLK-32-1L', name: 'Молоко 3,2 % 1 л', unit: 'pcs', description: 'Тетрапак, срок годности 10 суток' },
  { sku: 'KFR-25-900', name: 'Кефир 2,5 % 900 г', unit: 'pcs' },
  { sku: 'SGR-1KG', name: 'Сахар-песок 1 кг', unit: 'pack' },
  { sku: 'GRC-800', name: 'Крупа гречневая 800 г', unit: 'pack' },
  { sku: 'WTR-05-24', name: 'Вода питьевая 0,5 л (упаковка 24 шт.)', unit: 'box' },
  { sku: 'OIL-SUN-1L', name: 'Масло подсолнечное 1 л', unit: 'pcs' },
  { sku: 'PPR-A4-500', name: 'Бумага офисная A4, 500 листов', unit: 'pack' },
  { sku: 'BOX-60-40', name: 'Короб гофрированный 60×40×40', unit: 'pcs', description: 'Упаковочный материал' },
  { sku: 'TAPE-48', name: 'Скотч упаковочный 48 мм', unit: 'pcs' },
  { sku: 'APL-GLD', name: 'Яблоки «Голден», ящик', unit: 'kg', isActive: false, description: 'Сезонный товар, снят с продажи' },
];

const LOCATIONS = [
  { code: 'RCV-01', zone: 'Зона приёмки', description: 'Разгрузка с рампы №1' },
  { code: 'A-01-01', zone: 'Стеллаж A', description: 'Ряд 1, ярус 1' },
  { code: 'A-01-02', zone: 'Стеллаж A', description: 'Ряд 1, ярус 2' },
  { code: 'A-02-01', zone: 'Стеллаж A', description: 'Ряд 2, ярус 1' },
  { code: 'B-01-01', zone: 'Стеллаж B', description: 'Тяжёлые грузы' },
  { code: 'B-01-02', zone: 'Стеллаж B', isBlocked: true, description: 'Повреждена балка, ячейка заблокирована' },
  { code: 'COLD-01', zone: 'Холодильная камера', description: '+2…+6 °C, молочная продукция' },
  { code: 'COLD-02', zone: 'Холодильная камера', description: '+2…+6 °C' },
  { code: 'PACK-01', zone: 'Зона упаковки', description: 'Стол упаковщика' },
  { code: 'SHP-GATE-1', zone: 'Зона отгрузки', description: 'Ворота №1' },
];

// day — сдвиг плановой даты от сегодняшнего дня; author — индекс в USERS.
const SHIPMENTS = [
  { orderNumber: 'ORD-2026-0101', customerName: 'ООО «Продторг»', deliveryAddress: 'г. Минск, ул. Тимирязева, 65', day: -4, status: 'delivered', packagesCount: 6, totalWeightKg: 84.5, carrier: 'Собственный транспорт', author: 1 },
  { orderNumber: 'ORD-2026-0102', customerName: 'ИП Петров А. В.', deliveryAddress: 'г. Минск, пр. Независимости, 95', day: -3, status: 'delivered', packagesCount: 2, totalWeightKg: 12.8, carrier: 'Европочта', author: 2 },
  { orderNumber: 'ORD-2026-0103', customerName: 'ОДО «Белхозторг»', deliveryAddress: 'г. Борисов, ул. Чапаева, 30', day: -2, status: 'shipped', packagesCount: 10, totalWeightKg: 230, carrier: 'Автолайт Экспресс', author: 1 },
  { orderNumber: 'ORD-2026-0104', customerName: 'ООО «Мини-маркет Восток»', deliveryAddress: 'г. Минск, ул. Филимонова, 25', day: -1, status: 'cancelled', packagesCount: 3, totalWeightKg: 18, comment: 'Клиент отменил заказ', author: 2 },
  { orderNumber: 'ORD-2026-0105', customerName: 'ЧТУП «Сельмаг Колодищи»', deliveryAddress: 'Минский р-н, аг. Колодищи, ул. Советская, 12', day: -1, status: 'packed', packagesCount: 4, totalWeightKg: 51.2, carrier: 'Собственный транспорт', comment: 'Просрочена: ждёт машину', author: 1 },
  { orderNumber: 'ORD-2026-0106', customerName: 'ООО «Офис-Снаб»', deliveryAddress: 'г. Минск, ул. Кальварийская, 17, офис 304', day: 0, status: 'packed', packagesCount: 5, totalWeightKg: 60, carrier: 'Белпочта', author: 2 },
  { orderNumber: 'ORD-2026-0107', customerName: 'ООО «Продторг»', deliveryAddress: 'г. Минск, ул. Тимирязева, 65', day: 0, status: 'picking', packagesCount: 8, totalWeightKg: 112.4, carrier: 'Собственный транспорт', author: 1 },
  { orderNumber: 'ORD-2026-0108', customerName: 'Кафе «Васильки»', deliveryAddress: 'г. Минск, пр. Победителей, 9', day: 0, status: 'new', packagesCount: 2, totalWeightKg: 25, comment: 'Доставка до 12:00', author: 2 },
  { orderNumber: 'ORD-2026-0109', customerName: 'ИП Сидоренко Н. И.', deliveryAddress: 'г. Заславль, ул. Привокзальная, 4', day: 1, status: 'new', packagesCount: 1, totalWeightKg: 4.3, carrier: 'Европочта', author: 1 },
  { orderNumber: 'ORD-2026-0110', customerName: 'ОАО «Гродненский склад»', deliveryAddress: 'г. Гродно, ул. Победы, 21', day: 1, status: 'picking', packagesCount: 12, totalWeightKg: 340, carrier: 'Автолайт Экспресс', author: 0 },
  { orderNumber: 'ORD-2026-0111', customerName: 'ООО «Школьный мир»', deliveryAddress: 'г. Минск, ул. Якуба Коласа, 37', day: 2, status: 'new', packagesCount: 3, totalWeightKg: 36, carrier: 'Белпочта', author: 2 },
  { orderNumber: 'ORD-2026-0112', customerName: 'Магазин «У дома»', deliveryAddress: 'г. Молодечно, ул. Великий Гостинец, 50', day: 3, status: 'new', packagesCount: 7, totalWeightKg: 95, author: 1 },
  { orderNumber: 'ORD-2026-0113', customerName: 'ООО «Брестская торговая компания»', deliveryAddress: 'г. Брест, ул. Московская, 210', day: 4, status: 'new', packagesCount: 15, totalWeightKg: 410.5, carrier: 'Автолайт Экспресс', author: 0 },
  { orderNumber: 'ORD-2026-0114', customerName: 'ИП Ковальчук Д. С.', deliveryAddress: 'г. Минск, ул. Притыцкого, 140', day: 5, status: 'new', packagesCount: 1, totalWeightKg: 2.1, carrier: 'Европочта', author: 2 },
  { orderNumber: 'ORD-2026-0115', customerName: 'ООО «Витебскторг»', deliveryAddress: 'г. Витебск, пр. Фрунзе, 81', day: 7, status: 'new', packagesCount: 9, totalWeightKg: 150, carrier: 'Собственный транспорт', author: 1 },
];

function dateWithOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toLocaleDateString('sv-SE');
}

function newQrCode() {
  return `SHP-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * Демонстрационные данные: сотрудники всех ролей, справочники и отгрузки во всех статусах.
 * Повторный запуск ничего не дублирует: записи ищутся по email, артикулу, коду ячейки и номеру заказа.
 */
async function seedDemo({ admin, password, log }) {
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  const users = [];
  for (const item of USERS) {
    const [user, created] = await User.unscoped().findOrCreate({
      where: { email: item.email },
      defaults: { ...item, passwordHash },
    });
    users.push(user);
    if (created) log(`Пользователь ${item.email} (${item.role}) создан`);
  }

  let products = 0;
  for (const item of PRODUCTS) {
    const [, created] = await Product.findOrCreate({
      where: { sku: item.sku },
      defaults: { ...item, createdBy: users[0].id },
    });
    if (created) products += 1;
  }

  let locations = 0;
  for (const item of LOCATIONS) {
    const [, created] = await StorageLocation.findOrCreate({
      where: { code: item.code },
      defaults: { ...item, createdBy: admin.id },
    });
    if (created) locations += 1;
  }

  let shipments = 0;
  for (const { day, author, ...item } of SHIPMENTS) {
    const plannedDate = dateWithOffset(day);
    const shipped = ['shipped', 'delivered'].includes(item.status);
    const [, created] = await Shipment.findOrCreate({
      where: { orderNumber: item.orderNumber },
      defaults: {
        ...item,
        plannedDate,
        qrCode: newQrCode(),
        shippedAt: shipped ? new Date(`${plannedDate}T10:00:00`) : null,
        createdBy: users[author].id,
      },
    });
    if (created) shipments += 1;
  }

  log(`Добавлено: товаров ${products}, ячеек ${locations}, отгрузок ${shipments}`);
}

module.exports = { seedDemo, DEMO_USERS: USERS };
