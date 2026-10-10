const { sequelize } = require('../config/database');
const User = require('./user');
const Session = require('./session');
const Product = require('./product');
const StorageLocation = require('./storageLocation');
const AuditLog = require('./auditLog');

User.hasMany(Session, { foreignKey: 'userId', as: 'sessions', onDelete: 'CASCADE' });
Session.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(Product, { foreignKey: 'createdBy', onDelete: 'SET NULL' });
Product.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(StorageLocation, { foreignKey: 'createdBy', onDelete: 'SET NULL' });
StorageLocation.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

User.hasMany(AuditLog, { foreignKey: 'userId', onDelete: 'SET NULL' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'actor' });

module.exports = {
  sequelize,
  User,
  Session,
  Product,
  StorageLocation,
  AuditLog,
};
