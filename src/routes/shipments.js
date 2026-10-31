const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { roleGuard } = require('../middleware/roleGuard');
const { userLimiter } = require('../middleware/rateLimiters');
const {
  idParams,
  qrParams,
  qrImageQuery,
  createShipmentSchema,
  replaceShipmentSchema,
  statusSchema,
  listShipmentsQuery,
} = require('../validators/shipment');
const shipmentController = require('../controllers/shipmentController');

const router = express.Router();

// В отгрузках имена и адреса получателей, поэтому без входа они не отдаются.
router.use(authenticate, userLimiter);

router.get('/', validate(listShipmentsQuery, 'query'), asyncHandler(shipmentController.list));
// Объявлены раньше /:id, иначе «stats» и «scan» попадут в проверку UUID.
router.get('/stats', asyncHandler(shipmentController.stats));
router.get('/scan/:code', validate(qrParams, 'params'), asyncHandler(shipmentController.scan));
router.get('/:id', validate(idParams, 'params'), asyncHandler(shipmentController.getById));
router.get(
  '/:id/qr',
  validate(idParams, 'params'),
  validate(qrImageQuery, 'query'),
  asyncHandler(shipmentController.qrImage),
);

router.post(
  '/',
  roleGuard('user'),
  validate(createShipmentSchema),
  asyncHandler(shipmentController.create),
);
// Право автора проверяет контроллер: для этого нужна сама запись из базы.
router.put(
  '/:id',
  validate(idParams, 'params'),
  validate(replaceShipmentSchema),
  asyncHandler(shipmentController.replace),
);
router.patch(
  '/:id/status',
  validate(idParams, 'params'),
  validate(statusSchema),
  asyncHandler(shipmentController.changeStatus),
);
router.delete(
  '/:id',
  roleGuard('admin'),
  validate(idParams, 'params'),
  asyncHandler(shipmentController.remove),
);

module.exports = router;
