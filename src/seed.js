const bcrypt = require('bcrypt');
const config = require('./config/env');
const { sequelize, User } = require('./models');
const { passwordRule } = require('./validators/auth');
const { logger } = require('./utils/logger');

async function seed() {
  const { email, password, name } = config.admin;
  const { error } = passwordRule.validate(password);
  if (error) {
    throw new Error('ADMIN_PASSWORD не проходит политику сложности (8 символов, цифра, спецсимвол)');
  }

  await sequelize.authenticate();
  // --reset очищает все таблицы, чтобы коллекцию Postman можно было пройти заново.
  await sequelize.sync({ force: process.argv.includes('--reset') });

  const existing = await User.unscoped().findOne({ where: { email } });
  if (existing) {
    logger.info({ message: 'Администратор уже существует', email });
  } else {
    await User.create({
      email,
      name,
      role: 'admin',
      passwordHash: await bcrypt.hash(password, config.bcryptRounds),
    });
    logger.info({ message: 'Администратор создан', email });
  }

  await sequelize.close();
}

seed().catch(async (err) => {
  logger.error({ message: err.message, stack: err.stack });
  await sequelize.close();
  process.exit(1);
});
