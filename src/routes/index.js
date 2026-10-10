const express = require('express');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const productRoutes = require('./products');
const locationRoutes = require('./locations');
const auditRoutes = require('./audit');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/locations', locationRoutes);
router.use('/audit', auditRoutes);

module.exports = router;
