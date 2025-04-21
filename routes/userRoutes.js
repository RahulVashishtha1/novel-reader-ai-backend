const express = require('express');
const router = express.Router();
const {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  updateReadingStats,
  updateReadingPreferences,
  getReadingPreferences,
  getAllUsers,
  deleteUser,
  resetReadingStats,
} = require('../controllers/userController');
const { authenticateUser, authorizeAdmin } = require('../middlewares/auth');

// Protected routes
router.get('/profile', authenticateUser, getUserProfile);
router.patch('/profile', authenticateUser, updateUserProfile);
router.get('/stats', authenticateUser, getUserStats);
router.patch('/stats', authenticateUser, updateReadingStats);
router.get('/preferences', authenticateUser, getReadingPreferences);
router.patch('/preferences', authenticateUser, updateReadingPreferences);
router.post('/stats/reset', authenticateUser, resetReadingStats);

// Admin routes
router.get('/all', authenticateUser, authorizeAdmin, getAllUsers);
router.delete('/:userId', authenticateUser, authorizeAdmin, deleteUser);

module.exports = router;
