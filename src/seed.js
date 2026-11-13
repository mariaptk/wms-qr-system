const bcrypt = require('bcrypt');
const config = require('./config/env');
const { sequelize, User } = require('./models');
const { passwordRule } = require('./validators/auth');
const { logger } = require('./utils/logger');
const { syncSchema } = require('./config/schema');
const { seedDemo, DEMO_USERS } = require('./demoData');

const withDemo = process.argv.includes('--demo');
const withReset = process.argv.includes('--reset');

function log(message) {
  logger.info({ message });
}

function checkPassword(name, value) {
  const { error } = passwordRule.validate(value);
  if (error) {
    throw new Error(`${name} не проходит политику сложности (8 символов, цифра, спецсимвол)`);
  }
}

async function seed() {
  const { email, password, name } = config.admin;
  checkPassword('ADMIN_PASSWORD', password);
  const demoPassword = process.env.DEMO_PASSWORD || 'Sklad2026!';
  if (withDemo) checkPassword('DEMO_PASSWORD', demoPassword);

  await sequelize.authenticate();
  // --reset очищает все таблицы, чтобы коллекцию Postman можно было пройти заново.
  // Без него в существующие таблицы добавляются только новые столбцы, данные остаются.
  if (withReset) await sequelize.sync({ force: true });
  else await syncSchema();

  let admin = await User.unscoped().findOne({ where: { email } });
  if (admin) {
    log(`Администратор ${email} уже существует`);
  } else {
    admin = await User.create({
      email,
      name,
      role: 'admin',
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    });
    log(`Администратор ${email} создан`);
  }

  if (withDemo) {
    await seedDemo({ admin, password: demoPassword, log });
    log(`Демо-сотрудники: ${DEMO_USERS.map((user) => user.email).join(', ')}; пароль из DEMO_PASSWORD`);
  }

  await sequelize.close();
}

seed().catch(async (err) => {
  logger.error({ message: err.message, stack: err.stack });
  await sequelize.close();
  process.exit(1);
});
