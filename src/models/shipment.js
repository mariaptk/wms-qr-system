const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const { SHIPMENT_STATUSES } = require('../constants/shipments');

const Shipment = sequelize.define('Shipment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  orderNumber: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
  },
  qrCode: {
    type: DataTypes.STRING(32),
    allowNull: false,
    unique: true,
  },
  customerName: {
    type: DataTypes.STRING(200),
    allowNull: false,
  },
  deliveryAddress: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  plannedDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(16),
    allowNull: false,
    defaultValue: 'new',
    validate: { isIn: [SHIPMENT_STATUSES] },
  },
  packagesCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: { min: 1 },
  },
  totalWeightKg: {
    type: DataTypes.DECIMAL(10, 3),
    allowNull: true,
    // PostgreSQL возвращает DECIMAL строкой; клиенту отдаём число.
    get() {
      const value = this.getDataValue('totalWeightKg');
      return value === null || value === undefined ? value : Number(value);
    },
  },
  carrier: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  shippedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'shipments',
  indexes: [{ fields: ['status'] }, { fields: ['plannedDate'] }],
});

module.exports = Shipment;
