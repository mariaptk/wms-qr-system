const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { PRODUCT_CATEGORIES, PRODUCT_UNITS } = require('../constants/products');

// PostgreSQL возвращает DECIMAL строкой; клиенту отдаём число.
function decimal(field) {
  return function get() {
    const value = this.getDataValue(field);
    return value === null || value === undefined ? value : Number(value);
  };
}

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sku: {
    type: DataTypes.STRING(64),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(32),
    allowNull: false,
    defaultValue: 'other',
    validate: { isIn: [PRODUCT_CATEGORIES] },
  },
  unit: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'pcs',
    validate: { isIn: [PRODUCT_UNITS] },
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
    get: decimal('price'),
  },
  weightKg: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    validate: { min: 0 },
    get: decimal('weightKg'),
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'products',
  indexes: [{ fields: ['category'] }],
});

module.exports = Product;
