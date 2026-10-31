const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const {
  idParams,
  createProductSchema,
  replaceProductSchema,
  updateProductSchema,
  listProductsQuery,
} = require('../validators/product');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/', validate(listProductsQuery, 'query'), asyncHandler(productController.list));
// Объявлен раньше /:id, иначе «stats» попадёт в проверку UUID.
router.get('/stats', authenticate, userLimiter, asyncHandler(productController.stats));
router.get('/:id', validate(idParams, 'params'), asyncHandler(productController.getById));

router.post(
  '/',
  authenticate,
  userLimiter,
  roleGuard('user'),
  validate(createProductSchema),
  asyncHandler(productController.create),
);
// Право автора проверяет контроллер: для этого нужна сама запись из базы.
router.put(
  '/:id',
  authenticate,
  userLimiter,
  validate(idParams, 'params'),
  validate(replaceProductSchema),
  asyncHandler(productController.replace),
);
router.patch(
  '/:id',
  authenticate,
  userLimiter,
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
