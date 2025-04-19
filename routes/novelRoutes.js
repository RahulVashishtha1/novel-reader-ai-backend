const express = require('express');
const router = express.Router();
const {
  uploadNovel,
  getUserNovels,
  getNovel,
  getNovelPage,
  deleteNovel,
  addBookmark,
  removeBookmark,
  addNote,
  updateNote,
  deleteNote,
  updateReadingProgress,
  getAllNovels,
} = require('../controllers/novelController');
const { authenticateUser, authorizeAdmin } = require('../middlewares/auth');
const { uploadNovel: uploadNovelMiddleware } = require('../middlewares/upload');

// Protected routes
// Handle file upload errors
router.post('/', authenticateUser, (req, res, next) => {
  uploadNovelMiddleware.single('novel')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ message: err.message });
    }
    next();
  });
}, uploadNovel);
router.get('/', authenticateUser, getUserNovels);
router.get('/:id', authenticateUser, getNovel);
router.get('/:id/page/:page', authenticateUser, getNovelPage);
router.delete('/:id', authenticateUser, deleteNovel);

// Bookmark routes
router.post('/:id/bookmarks', authenticateUser, addBookmark);
router.delete('/:id/bookmarks/:bookmarkId', authenticateUser, removeBookmark);

// Note routes
router.post('/:id/notes', authenticateUser, addNote);
router.patch('/:id/notes/:noteId', authenticateUser, updateNote);
router.delete('/:id/notes/:noteId', authenticateUser, deleteNote);

// Reading progress
router.patch('/:id/progress', authenticateUser, updateReadingProgress);

// Admin routes
router.get('/admin/all', authenticateUser, authorizeAdmin, getAllNovels);

module.exports = router;
