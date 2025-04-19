const fs = require('fs');
const path = require('path');
const Novel = require('../models/Novel');
const User = require('../models/User');
const epub = require('epub');

// Helper function to count pages in a text file
const countPagesInTextFile = (filePath, wordsPerPage = 600) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      const words = data.split(/\s+/).filter(word => word.length > 0);
      const totalPages = Math.ceil(words.length / wordsPerPage);
      resolve(totalPages);
    });
  });
};

// Helper function to count pages in an EPUB file
const countPagesInEpubFile = (filePath, wordsPerPage = 600) => {
  return new Promise((resolve, reject) => {
    const epubBook = new epub(filePath);

    epubBook.on('error', err => {
      reject(err);
    });

    epubBook.on('end', () => {
      let totalWords = 0;

      // Get the total word count from all chapters
      epubBook.flow.forEach(chapter => {
        epubBook.getChapter(chapter.id, (err, text) => {
          if (err) {
            reject(err);
            return;
          }

          // Remove HTML tags and count words
          const plainText = text.replace(/<[^>]*>/g, '');
          const words = plainText.split(/\s+/).filter(word => word.length > 0);
          totalWords += words.length;

          // If this is the last chapter, calculate total pages
          if (chapter.id === epubBook.flow[epubBook.flow.length - 1].id) {
            const totalPages = Math.ceil(totalWords / wordsPerPage);
            resolve(totalPages);
          }
        });
      });
    });

    epubBook.parse();
  });
};

// Upload a novel
const uploadNovel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { title } = req.body;
    if (!title || title.trim() === '') {
      return res.status(400).json({ message: 'Title is required' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    const fileType = fileExtension === '.epub' ? 'epub' : 'txt';

    console.log('File uploaded:', {
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      path: filePath,
      extension: fileExtension,
      type: fileType
    });

    // Count pages based on file type
    let totalPages;
    try {
      if (fileType === 'epub') {
        totalPages = await countPagesInEpubFile(filePath);
      } else {
        totalPages = await countPagesInTextFile(filePath);
      }
    } catch (err) {
      console.error('Error counting pages:', err);
      // If we can't count pages, set a default value
      totalPages = 1;
    }

    // Create novel
    const novel = await Novel.create({
      title,
      filePath,
      fileType,
      totalPages,
      owner: req.user.userId,
    });

    res.status(201).json({ novel });
  } catch (error) {
    console.error('Error uploading novel:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get all novels for the current user
const getUserNovels = async (req, res) => {
  try {
    const novels = await Novel.find({ owner: req.user.userId })
      .sort({ createdAt: -1 });

    res.status(200).json({ novels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get a single novel
const getNovel = async (req, res) => {
  try {
    const { id } = req.params;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this novel' });
    }

    res.status(200).json({ novel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get novel content for a specific page
const getNovelPage = async (req, res) => {
  try {
    const { id, page } = req.params;
    const pageNum = parseInt(page);

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to access this novel' });
    }

    // Check if page is valid
    if (pageNum < 1 || pageNum > novel.totalPages) {
      return res.status(400).json({ message: 'Invalid page number' });
    }

    // Get content based on file type
    let pageContent, metadata = {};
    if (novel.fileType === 'epub') {
      const epubContent = await getEpubPageContent(novel.filePath, pageNum);
      pageContent = epubContent.content;
      metadata = {
        isHtml: epubContent.isHtml,
        chapterIndex: epubContent.chapterIndex,
        chapterTitle: epubContent.chapterTitle,
        wordOffset: epubContent.wordOffset,
        wordsToTake: epubContent.wordsToTake,
        totalChapters: epubContent.totalChapters
      };
    } else {
      pageContent = await getTextPageContent(novel.filePath, pageNum);
      metadata = { isHtml: false };
    }

    // Update last read page
    novel.lastReadPage = pageNum;
    await novel.save();

    res.status(200).json({
      page: pageNum,
      content: pageContent,
      totalPages: novel.totalPages,
      metadata
    });
  } catch (error) {
    console.error('Error getting novel page:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function to get content from a text file for a specific page
const getTextPageContent = (filePath, pageNum, wordsPerPage = 600) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(err);
        return;
      }

      // Split the text into words while preserving newlines and formatting
      const words = data.split(/\s+/);
      const totalWords = words.length;
      const startIndex = (pageNum - 1) * wordsPerPage;
      const endIndex = Math.min(startIndex + wordsPerPage, totalWords);

      if (startIndex >= totalWords) {
        resolve('');
        return;
      }

      // Extract the content for this page
      const pageWords = words.slice(startIndex, endIndex);

      // Instead of joining with spaces, which loses formatting,
      // we'll extract the original text segment
      const startCharIndex = data.indexOf(pageWords[0]);
      let endCharIndex;

      if (endIndex < totalWords) {
        // If not the last page, find where the next page would start
        const nextPageStartWord = words[endIndex];
        endCharIndex = data.indexOf(nextPageStartWord, startCharIndex);
      } else {
        // If it's the last page, go to the end of the file
        endCharIndex = data.length;
      }

      // Extract the text segment with original formatting
      const pageContent = data.substring(startCharIndex, endCharIndex);

      resolve(pageContent);
    });
  });
};

// Helper function to get content from an EPUB file for a specific page
const getEpubPageContent = (filePath, pageNum, wordsPerPage = 600) => {
  return new Promise((resolve, reject) => {
    const epubBook = new epub(filePath);

    epubBook.on('error', err => {
      reject(err);
    });

    epubBook.on('end', () => {
      // Store all chapters with their HTML content
      const chapters = [];
      let processedChapters = 0;
      let totalWords = 0;
      let chapterWordCounts = [];

      // Get text from all chapters
      epubBook.flow.forEach(chapter => {
        epubBook.getChapter(chapter.id, (err, text) => {
          if (err) {
            reject(err);
            return;
          }

          // Store the chapter with its HTML content
          chapters.push({
            id: chapter.id,
            content: text,
            // Also store plain text for word counting
            plainText: text.replace(/<[^>]*>/g, '')
          });

          // Count words for pagination
          const words = text.replace(/<[^>]*>/g, '').split(/\s+/).filter(word => word.length > 0);
          chapterWordCounts.push(words.length);
          totalWords += words.length;

          processedChapters++;

          // If all chapters are processed, get the page content
          if (processedChapters === epubBook.flow.length) {
            // Sort chapters by their order in the book
            chapters.sort((a, b) => {
              return epubBook.flow.findIndex(ch => ch.id === a.id) -
                     epubBook.flow.findIndex(ch => ch.id === b.id);
            });

            // Calculate which chapter contains the requested page
            const startWordIndex = (pageNum - 1) * wordsPerPage;
            let currentWordCount = 0;
            let targetChapterIndex = -1;
            let wordOffsetInChapter = 0;

            for (let i = 0; i < chapterWordCounts.length; i++) {
              if (startWordIndex < currentWordCount + chapterWordCounts[i]) {
                targetChapterIndex = i;
                wordOffsetInChapter = startWordIndex - currentWordCount;
                break;
              }
              currentWordCount += chapterWordCounts[i];
            }

            if (targetChapterIndex === -1 || startWordIndex >= totalWords) {
              resolve({ content: '', isHtml: true });
              return;
            }

            // Get the target chapter
            const targetChapter = chapters[targetChapterIndex];
            const chapterWords = targetChapter.plainText.split(/\s+/).filter(word => word.length > 0);

            // Calculate word range for this page
            const wordsToTake = Math.min(wordsPerPage, chapterWords.length - wordOffsetInChapter);

            // For HTML content, we need to extract a section that approximately contains these words
            // This is a simplified approach - a more sophisticated approach would parse the HTML properly
            const htmlContent = targetChapter.content;

            // Return both HTML content and information about the chapter
            resolve({
              content: htmlContent,
              isHtml: true,
              chapterIndex: targetChapterIndex,
              chapterTitle: epubBook.flow[targetChapterIndex].title || `Chapter ${targetChapterIndex + 1}`,
              wordOffset: wordOffsetInChapter,
              wordsToTake: wordsToTake,
              totalChapters: chapters.length
            });
          }
        });
      });
    });

    epubBook.parse();
  });
};

// Delete a novel
const deleteNovel = async (req, res) => {
  try {
    const { id } = req.params;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this novel' });
    }

    // Delete the file
    fs.unlink(novel.filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      }
    });

    // Delete the novel from the database
    await Novel.findByIdAndDelete(id);

    res.status(200).json({ message: 'Novel deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a bookmark
const addBookmark = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, name } = req.body;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to add bookmarks to this novel' });
    }

    // Check if page is valid
    if (page < 1 || page > novel.totalPages) {
      return res.status(400).json({ message: 'Invalid page number' });
    }

    // Check if bookmark already exists
    const existingBookmark = novel.bookmarks.find(b => b.page === page);
    if (existingBookmark) {
      return res.status(400).json({ message: 'Bookmark already exists for this page' });
    }

    // Add bookmark
    novel.bookmarks.push({ page, name });
    await novel.save();

    res.status(200).json({ bookmarks: novel.bookmarks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Remove a bookmark
const removeBookmark = async (req, res) => {
  try {
    const { id, bookmarkId } = req.params;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to remove bookmarks from this novel' });
    }

    // Remove bookmark
    novel.bookmarks = novel.bookmarks.filter(b => b._id.toString() !== bookmarkId);
    await novel.save();

    res.status(200).json({ bookmarks: novel.bookmarks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Add a note
const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, content } = req.body;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to add notes to this novel' });
    }

    // Check if page is valid
    if (page < 1 || page > novel.totalPages) {
      return res.status(400).json({ message: 'Invalid page number' });
    }

    // Add note
    novel.notes.push({ page, content });
    await novel.save();

    res.status(200).json({ notes: novel.notes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update a note
const updateNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const { content } = req.body;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update notes for this novel' });
    }

    // Find and update note
    const noteIndex = novel.notes.findIndex(n => n._id.toString() === noteId);
    if (noteIndex === -1) {
      return res.status(404).json({ message: 'Note not found' });
    }

    novel.notes[noteIndex].content = content;
    novel.notes[noteIndex].updatedAt = Date.now();
    await novel.save();

    res.status(200).json({ notes: novel.notes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete a note
const deleteNote = async (req, res) => {
  try {
    const { id, noteId } = req.params;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete notes for this novel' });
    }

    // Remove note
    novel.notes = novel.notes.filter(n => n._id.toString() !== noteId);
    await novel.save();

    res.status(200).json({ notes: novel.notes });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update reading progress
const updateReadingProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { page, readingTime, completed } = req.body;

    const novel = await Novel.findById(id);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }

    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update progress for this novel' });
    }

    // Update progress
    if (page) {
      novel.lastReadPage = page;
    }

    if (readingTime) {
      novel.totalReadingTime += readingTime;

      // Update user's reading stats
      const user = await User.findById(req.user.userId);
      user.readingStats.totalReadingTime += readingTime;
      user.readingStats.pagesRead += 1;
      await user.save();
    }

    if (completed !== undefined) {
      novel.completed = completed;

      // If novel is completed, update user's stats
      if (completed && !novel.completed) {
        const user = await User.findById(req.user.userId);
        user.readingStats.novelsCompleted += 1;
        await user.save();
      }
    }

    await novel.save();

    res.status(200).json({ novel });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all novels
const getAllNovels = async (req, res) => {
  try {
    const novels = await Novel.find()
      .populate('owner', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ novels });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
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
  // Export helper functions for use in other controllers
  getEpubPageContent,
  getTextPageContent,
};
