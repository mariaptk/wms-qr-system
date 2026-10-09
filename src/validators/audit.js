const Joi = require('joi');
const { paginationQuery } = require('./common');

const listAuditQuery = Joi.object({
  ...paginationQuery,
});

module.exports = { listAuditQuery };
