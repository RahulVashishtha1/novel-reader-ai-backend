const express = require('express');
const router = express.Router();
const {
  generateImage,
  getImagesForPage,
  getAllImageLogs,
} = require('../controllers/imageController');
const { authenticateUser, authorizeAdmin } = require('../middlewares/auth');

// Protected routes
router.post('/:novelId/page/:page', authenticateUser, generateImage);
router.get('/:novelId/page/:page', authenticateUser, getImagesForPage);

// Admin routes
router.get('/logs', authenticateUser, authorizeAdmin, getAllImageLogs);

module.exports = router;
