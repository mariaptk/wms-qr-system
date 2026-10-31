const { sequelize } = require('./database');

/**
 * Создаёт недостающие таблицы и добавляет в существующие новые столбцы моделей.
 * sync({ alter: true }) не подходит: в PostgreSQL он при каждом запуске
 * добавляет копию уникального ограничения (products_sku_key1, key2, ...).
 */
async function syncSchema() {
  const queryInterface = sequelize.getQueryInterface();

  // Столбцы добавляются до sync(): он создаёт индексы, и индекс по новому столбцу без него упадёт.
  for (const model of Object.values(sequelize.models)) {
    const table = model.getTableName();
    if (!(await queryInterface.tableExists(table))) continue;
    const existing = await queryInterface.describeTable(table);

    for (const attribute of Object.values(model.getAttributes())) {
      if (existing[attribute.field]) continue;
      const { type, allowNull, defaultValue } = attribute;
      await queryInterface.addColumn(table, attribute.field, { type, allowNull, defaultValue });
    }
  }

  await sequelize.sync();
}

module.exports = { syncSchema };
