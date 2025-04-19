const SharedContent = require('../models/SharedContent');
const Novel = require('../models/Novel');
const User = require('../models/User');
const ImageGenerationLog = require('../models/ImageGenerationLog');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

// Generate a unique share ID
const generateShareId = () => {
  return crypto.randomBytes(8).toString('hex');
};

// Get a shared content by ID
const getSharedContent = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    // Find the shared content
    const sharedContent = await SharedContent.findOne({ shareId })
      .populate('user', 'name')
      .populate('novel', 'title');
    
    if (!sharedContent) {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    
    // Check if it's expired
    if (sharedContent.expiresAt && new Date() > sharedContent.expiresAt) {
      return res.status(410).json({ message: 'This shared content has expired' });
    }
    
    // Check if it's public or the user is the owner
    if (!sharedContent.isPublic && 
        (!req.user || sharedContent.user.toString() !== req.user.userId)) {
      return res.status(403).json({ message: 'You do not have permission to view this content' });
    }
    
    res.status(200).json({ sharedContent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Share a passage
const sharePassage = async (req, res) => {
  try {
    const { novelId } = req.params;
    const { content, page, imageId, expiresIn, isPublic = true } = req.body;
    
    // Validate required fields
    if (!content || !page) {
      return res.status(400).json({ message: 'Content and page are required' });
    }
    
    // Check if novel exists and user has access
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is the owner or an admin
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to share content from this novel' });
    }
    
    // Generate a unique share ID
    const shareId = generateShareId();
    
    // Set expiration date if provided
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
    }
    
    // Get image URL if provided
    let imageUrl = null;
    if (imageId) {
      const image = await ImageGenerationLog.findById(imageId);
      if (image) {
        imageUrl = image.imageUrl;
      }
    }
    
    // Create share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareId}`;
    
    // Create shared content
    const sharedContent = await SharedContent.create({
      type: 'passage',
      user: req.user.userId,
      novel: novelId,
      content,
      page,
      imageUrl,
      shareUrl,
      shareId,
      expiresAt,
      isPublic,
    });
    
    res.status(201).json({ sharedContent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Share reading progress
const shareProgress = async (req, res) => {
  try {
    const { novelId } = req.params;
    const { expiresIn, isPublic = true } = req.body;
    
    // Check if novel exists and user has access
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is the owner
    if (novel.owner.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to share progress for this novel' });
    }
    
    // Get user stats
    const user = await User.findById(req.user.userId);
    
    // Calculate progress stats
    const progress = {
      currentPage: novel.lastReadPage || 1,
      totalPages: novel.totalPages,
      percentComplete: Math.round(((novel.lastReadPage || 1) / novel.totalPages) * 100),
      totalReadingTime: novel.totalReadingTime || 0, // in minutes
      bookmarksCount: novel.bookmarks.length,
      notesCount: novel.notes.length,
    };
    
    // Generate a unique share ID
    const shareId = generateShareId();
    
    // Set expiration date if provided
    let expiresAt = null;
    if (expiresIn) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiresIn));
    }
    
    // Create share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareId}`;
    
    // Create shared content
    const sharedContent = await SharedContent.create({
      type: 'progress',
      user: req.user.userId,
      novel: novelId,
      stats: progress,
      shareUrl,
      shareId,
      expiresAt,
      isPublic,
    });
    
    res.status(201).json({ sharedContent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate a social media image for a passage
const generateSocialImage = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    // Find the shared content
    const sharedContent = await SharedContent.findOne({ shareId })
      .populate('user', 'name')
      .populate('novel', 'title');
    
    if (!sharedContent) {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    
    // Check if it's a passage
    if (sharedContent.type !== 'passage') {
      return res.status(400).json({ message: 'Can only generate images for passages' });
    }
    
    // Create a canvas
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');
    
    // Draw background
    context.fillStyle = '#f8f9fa';
    context.fillRect(0, 0, width, height);
    
    // Draw border
    context.strokeStyle = '#3b82f6';
    context.lineWidth = 10;
    context.strokeRect(10, 10, width - 20, height - 20);
    
    // Draw app logo and name
    context.fillStyle = '#3b82f6';
    context.font = 'bold 40px Arial';
    context.fillText('VisNovel', 50, 80);
    
    // Draw novel title
    context.fillStyle = '#1f2937';
    context.font = 'bold 36px Arial';
    context.fillText(`From "${sharedContent.novel.title}"`, 50, 150);
    
    // Draw passage content
    context.font = '24px Arial';
    const maxWidth = width - 100;
    const lineHeight = 36;
    
    // Wrap text function
    const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
      const words = text.split(' ');
      let line = '';
      let testLine = '';
      let lineCount = 0;
      
      for (let n = 0; n < words.length; n++) {
        testLine = line + words[n] + ' ';
        const metrics = context.measureText(testLine);
        const testWidth = metrics.width;
        
        if (testWidth > maxWidth && n > 0) {
          context.fillText(line, x, y + (lineCount * lineHeight));
          line = words[n] + ' ';
          lineCount++;
          
          // Limit to 8 lines
          if (lineCount >= 8) {
            line += '...';
            context.fillText(line, x, y + (lineCount * lineHeight));
            break;
          }
        } else {
          line = testLine;
        }
      }
      
      if (lineCount < 8) {
        context.fillText(line, x, y + (lineCount * lineHeight));
      }
      
      return lineCount;
    };
    
    const lineCount = wrapText(context, sharedContent.content, 50, 200, maxWidth, lineHeight);
    
    // Draw user attribution
    context.fillStyle = '#6b7280';
    context.font = 'italic 24px Arial';
    context.fillText(`Shared by ${sharedContent.user.name}`, 50, 200 + ((lineCount + 2) * lineHeight));
    
    // Draw QR code or URL
    context.fillStyle = '#3b82f6';
    context.font = '20px Arial';
    context.fillText(sharedContent.shareUrl, 50, height - 50);
    
    // If there's an image, try to include it
    if (sharedContent.imageUrl) {
      try {
        const imagePath = path.join(__dirname, '..', sharedContent.imageUrl);
        if (fs.existsSync(imagePath)) {
          const image = await loadImage(imagePath);
          
          // Calculate dimensions to maintain aspect ratio
          const imgWidth = 400;
          const imgHeight = (image.height / image.width) * imgWidth;
          
          // Draw image on the right side
          context.drawImage(image, width - imgWidth - 50, 200, imgWidth, imgHeight);
        }
      } catch (err) {
        console.error('Error loading image:', err);
      }
    }
    
    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');
    
    // Save the image
    const imageDir = path.join(__dirname, '..', 'uploads', 'social');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }
    
    const imageName = `social_${shareId}.png`;
    const imagePath = path.join(imageDir, imageName);
    fs.writeFileSync(imagePath, buffer);
    
    // Update shared content with image URL
    const socialImageUrl = `uploads/social/${imageName}`;
    sharedContent.socialImageUrl = socialImageUrl;
    await sharedContent.save();
    
    res.status(200).json({ 
      socialImageUrl,
      fullUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/${socialImageUrl}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get all shared content for a user
const getUserSharedContent = async (req, res) => {
  try {
    const sharedContent = await SharedContent.find({ user: req.user.userId })
      .populate('novel', 'title')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ sharedContent });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete shared content
const deleteSharedContent = async (req, res) => {
  try {
    const { shareId } = req.params;
    
    // Find the shared content
    const sharedContent = await SharedContent.findOne({ shareId });
    
    if (!sharedContent) {
      return res.status(404).json({ message: 'Shared content not found' });
    }
    
    // Check if user is the owner or an admin
    if (sharedContent.user.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to delete this shared content' });
    }
    
    // Delete the social image if it exists
    if (sharedContent.socialImageUrl) {
      const imagePath = path.join(__dirname, '..', sharedContent.socialImageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    // Delete the shared content
    await SharedContent.findByIdAndDelete(sharedContent._id);
    
    res.status(200).json({ message: 'Shared content deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getSharedContent,
  sharePassage,
  shareProgress,
  generateSocialImage,
  getUserSharedContent,
  deleteSharedContent,
};
