const User = require('../models/User');
const Novel = require('../models/Novel');
const ImageGenerationLog = require('../models/ImageGenerationLog');

// Get user profile
const getUserProfile = async (req, res) => {
  try {
    console.log('⭐ getUserProfile called with userId:', req.user.userId);

    const user = await User.findById(req.user.userId).select('-password');
    if (!user) {
      console.log('❌ User not found with ID:', req.user.userId);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('✅ User found:', JSON.stringify(user, null, 2));
    console.log('📊 User readingStats:', JSON.stringify(user.readingStats, null, 2));

    // Get additional stats
    const novels = await Novel.find({ owner: req.user.userId });
    const totalNovels = novels.length;
    console.log(`📚 Found ${totalNovels} novels for user`);

    // Original response - just sending the user object directly
    const originalResponse = { user };
    console.log('🔄 Original response structure:', JSON.stringify(originalResponse, null, 2));

    // Add stats to user object
    const userObj = user.toObject({ getters: true });
    userObj.stats = {
      ...userObj.readingStats,
      totalNovels
    };

    // Modified response with stats
    const modifiedResponse = { user: userObj };
    console.log('🔄 Modified response structure:', JSON.stringify(modifiedResponse, null, 2));

    // Send the modified response with stats
    res.status(200).json({ user: userObj });
  } catch (error) {
    console.error('❌ Error getting user profile:', error);
    res.status(500).json({ message: error.message });
  }
};

// Update user profile
const updateUserProfile = async (req, res) => {
  try {
    const { name, bio } = req.body;

    // Get current user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields
    if (name) user.name = name;
    if (bio !== undefined) user.bio = bio;

    await user.save();

    // Get additional stats
    const novels = await Novel.find({ owner: req.user.userId });
    const totalNovels = novels.length;

    // Add stats to user object
    const userObj = user.toObject({ getters: true });
    userObj.stats = {
      ...userObj.readingStats,
      totalNovels
    };

    res.status(200).json({ user: userObj });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: error.message });
  }
};

// Get user reading statistics
const getUserStats = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('readingStats');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get additional stats
    const novels = await Novel.find({ owner: req.user.userId });
    const totalNovels = novels.length;

    // Get reading progress for each novel
    const novelsWithProgress = novels.map(novel => {
      const progress = (novel.lastReadPage / novel.totalPages) * 100;
      return {
        id: novel._id,
        title: novel.title,
        progress: Math.round(progress),
        lastReadPage: novel.lastReadPage,
        totalPages: novel.totalPages,
        completed: novel.completed,
      };
    });

    res.status(200).json({
      stats: user.readingStats,
      totalNovels,
      novelsWithProgress,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update user reading statistics
const updateReadingStats = async (req, res) => {
  try {
    const { readingTime, pagesRead, novelCompleted, imagesGenerated } = req.body;

    // Get current stats
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update stats
    const updatedStats = {
      totalReadingTime: user.readingStats.totalReadingTime + (readingTime || 0),
      pagesRead: user.readingStats.pagesRead + (pagesRead || 0),
      novelsCompleted: user.readingStats.novelsCompleted + (novelCompleted ? 1 : 0),
      imagesGenerated: user.readingStats.imagesGenerated + (imagesGenerated || 0),
    };

    // Save updated stats
    user.readingStats = updatedStats;
    await user.save();

    res.status(200).json({ stats: user.readingStats });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all users
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');

    // Get additional info for each user
    const usersWithInfo = await Promise.all(
      users.map(async (user) => {
        const novelCount = await Novel.countDocuments({ owner: user._id });
        const imageCount = await ImageGenerationLog.countDocuments({ user: user._id });

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          novelCount,
          imageCount,
          readingStats: user.readingStats,
          createdAt: user.createdAt,
        };
      })
    );

    res.status(200).json({ users: usersWithInfo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete user's novels
    await Novel.deleteMany({ owner: userId });

    // Delete user's image generation logs
    await ImageGenerationLog.deleteMany({ user: userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update reading preferences
const updateReadingPreferences = async (req, res) => {
  try {
    const { theme, fontSize, fontFamily, lineSpacing, letterSpacing, dyslexiaFriendly } = req.body;

    // Get current user
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update preferences
    if (theme) user.readingPreferences.theme = theme;
    if (fontSize) user.readingPreferences.fontSize = fontSize;
    if (fontFamily) user.readingPreferences.fontFamily = fontFamily;
    if (lineSpacing !== undefined) user.readingPreferences.lineSpacing = lineSpacing;
    if (letterSpacing !== undefined) user.readingPreferences.letterSpacing = letterSpacing;
    if (dyslexiaFriendly !== undefined) user.readingPreferences.dyslexiaFriendly = dyslexiaFriendly;

    await user.save();

    res.status(200).json({ preferences: user.readingPreferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get reading preferences
const getReadingPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('readingPreferences');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ preferences: user.readingPreferences });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  getUserStats,
  updateReadingStats,
  updateReadingPreferences,
  getReadingPreferences,
  getAllUsers,
  deleteUser,
};
