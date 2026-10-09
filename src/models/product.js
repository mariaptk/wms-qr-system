const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

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
  unit: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'pcs',
    validate: { isIn: [['pcs', 'kg', 'g', 'l', 'box', 'pack']] },
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
});

module.exports = Product;
