const express = require('express');
const router = express.Router();

const getRoutes = require('./getRoutes');
const postRoutes = require('./postRoutes');

// Import từng nhóm route riêng vào router chính
router.use(getRoutes);
router.use(postRoutes);

module.exports = router;
