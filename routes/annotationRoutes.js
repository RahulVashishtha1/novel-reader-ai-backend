const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middlewares/auth');
const {
  getAnnotations,
  getPageAnnotations,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
} = require('../controllers/annotationController');

// All routes require authentication
router.use(authenticateUser);

// Get all annotations for a novel
router.get('/novels/:novelId', getAnnotations);

// Get annotations for a specific page
router.get('/novels/:novelId/pages/:page', getPageAnnotations);

// Create a new annotation
router.post('/novels/:novelId', createAnnotation);

// Update an annotation
router.patch('/:annotationId', updateAnnotation);

// Delete an annotation
router.delete('/:annotationId', deleteAnnotation);

module.exports = router;
