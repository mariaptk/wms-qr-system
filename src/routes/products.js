const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const {
  idParams,
  createProductSchema,
  updateProductSchema,
  listProductsQuery,
} = require('../validators/product');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', validate(listProductsQuery, 'query'), asyncHandler(productController.list));
router.get('/:id', validate(idParams, 'params'), asyncHandler(productController.getById));

router.post(
  '/',
  authenticate,
  userLimiter,
  roleGuard('user'),
  validate(createProductSchema),
  asyncHandler(productController.create),
);
router.patch(
  '/:id',
  authenticate,
  userLimiter,
  roleGuard('moderator'),
  validate(idParams, 'params'),
  validate(updateProductSchema),
  asyncHandler(productController.update),
);
router.delete(
  '/:id',
  authenticate,
  userLimiter,
  roleGuard('admin'),
  validate(idParams, 'params'),
  asyncHandler(productController.remove),
);

module.exports = router;
