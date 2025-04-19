const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const {
  getSharedContent,
  sharePassage,
  shareProgress,
  generateSocialImage,
  getUserSharedContent,
  deleteSharedContent,
} = require('../controllers/sharingController');

// Public routes
router.get('/:shareId', getSharedContent);

// Protected routes
router.use(authenticateUser);
router.get('/user/all', getUserSharedContent);
router.post('/novels/:novelId/passage', sharePassage);
router.post('/novels/:novelId/progress', shareProgress);
router.post('/:shareId/social-image', generateSocialImage);
router.delete('/:shareId', deleteSharedContent);

module.exports = router;
