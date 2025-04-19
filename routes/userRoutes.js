const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  getUserStats,
  updateReadingStats,
  getAllUsers,
  deleteUser,
} = require('../controllers/userController');
const { authenticateUser, authorizeAdmin } = require('../middlewares/auth');

// Protected routes
router.get('/profile', authenticateUser, getUserProfile);
router.get('/stats', authenticateUser, getUserStats);
router.patch('/stats', authenticateUser, updateReadingStats);

// Admin routes
router.get('/all', authenticateUser, authorizeAdmin, getAllUsers);
router.delete('/:userId', authenticateUser, authorizeAdmin, deleteUser);

module.exports = router;
