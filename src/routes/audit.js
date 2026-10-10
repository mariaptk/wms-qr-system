const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const { listAuditQuery } = require('../validators/audit');
const auditController = require('../controllers/auditController');

const router = express.Router();

router.get(
  '/',
  authenticate,
  userLimiter,
  roleGuard('admin'),
  validate(listAuditQuery, 'query'),
  asyncHandler(auditController.list),
);

module.exports = router;
