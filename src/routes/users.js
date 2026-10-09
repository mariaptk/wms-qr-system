const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const {
  idParams,
  updateProfileSchema,
  changeRoleSchema,
  listUsersQuery,
} = require('../validators/user');
const userController = require('../controllers/userController');

const router = express.Router();

router.use(authenticate, userLimiter);

router.get('/', roleGuard('admin'), validate(listUsersQuery, 'query'), asyncHandler(userController.list));
router.get('/:id', validate(idParams, 'params'), asyncHandler(userController.getById));
router.patch(
  '/:id',
  validate(idParams, 'params'),
  validate(updateProfileSchema),
  asyncHandler(userController.update),
);
router.patch(
  '/:id/role',
  roleGuard('admin'),
  validate(idParams, 'params'),
  validate(changeRoleSchema),
  asyncHandler(userController.changeRole),
);
router.post(
  '/:id/unlock',
  roleGuard('admin'),
  validate(idParams, 'params'),
  asyncHandler(userController.unlock),
);
router.delete(
  '/:id',
  roleGuard('admin'),
  validate(idParams, 'params'),
  asyncHandler(userController.remove),
);

module.exports = router;
