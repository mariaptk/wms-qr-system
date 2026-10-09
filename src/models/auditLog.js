const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  entity: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  entityId: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  ip: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.STRING(512),
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  updatedAt: false,
});

module.exports = AuditLog;
