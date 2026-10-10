const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const {
  idParams,
  createLocationSchema,
  updateLocationSchema,
  listLocationsQuery,
} = require('../validators/location');
const locationController = require('../controllers/locationController');

const router = express.Router();

router.use(authenticate, userLimiter);

router.get('/', validate(listLocationsQuery, 'query'), asyncHandler(locationController.list));
router.get('/:id', validate(idParams, 'params'), asyncHandler(locationController.getById));
router.post(
  '/',
  roleGuard('moderator'),
  validate(createLocationSchema),
  asyncHandler(locationController.create),
);
router.patch(
  '/:id',
  roleGuard('moderator'),
  validate(idParams, 'params'),
  validate(updateLocationSchema),
  asyncHandler(locationController.update),
);
router.delete(
  '/:id',
  roleGuard('admin'),
  validate(idParams, 'params'),
  asyncHandler(locationController.remove),
);

module.exports = router;
