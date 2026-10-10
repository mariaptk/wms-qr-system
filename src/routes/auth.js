const express = require('express');
const { asyncHandler } = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter, userLimiter } = require('../middleware/rateLimiters');
const { csrfGuard } = require('../middleware/security');
const { registerSchema, loginSchema } = require('../validators/auth');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));

router.post('/refresh', csrfGuard, asyncHandler(authController.refresh));
router.post('/logout', csrfGuard, asyncHandler(authController.logout));

router.get('/me', authenticate, userLimiter, asyncHandler(authController.me));
router.get('/sessions', authenticate, userLimiter, asyncHandler(authController.sessions));
router.post('/logout-all', authenticate, userLimiter, asyncHandler(authController.logoutAll));

module.exports = router;
