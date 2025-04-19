const fs = require('fs');
const path = require('path');
const ImageGenerationLog = require('../models/ImageGenerationLog');
const Novel = require('../models/Novel');
const User = require('../models/User');

// Mock function for AI image generation (to be replaced with actual API)
const generateImageWithAI = async (prompt, style) => {
  // In a real implementation, this would call an external API like Stability AI, DALL-E, etc.
  // For now, we'll return a mock response
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Return a mock image URL (in production, this would be the URL returned by the AI service)
  const mockImageName = `mock_${Date.now()}.jpg`;
  const mockImagePath = path.join('uploads', 'images', mockImageName);
  
  // Create an empty file as a placeholder
  fs.writeFileSync(mockImagePath, '');
  
  return {
    imageUrl: mockImagePath,
    prompt,
    style,
  };
};

// Generate an image for a novel page
const generateImage = async (req, res) => {
  try {
    const { novelId, page } = req.params;
    const { style = 'default' } = req.body;
    
    // Check if novel exists
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is authorized
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to generate images for this novel' });
    }
    
    // Check if page is valid
    const pageNum = parseInt(page);
    if (pageNum < 1 || pageNum > novel.totalPages) {
      return res.status(400).json({ message: 'Invalid page number' });
    }
    
    // Get page content to use as prompt
    let pageContent;
    if (novel.fileType === 'epub') {
      // This would use the getEpubPageContent function from novelController
      // For simplicity, we'll use a placeholder
      pageContent = `Content from ${novel.title}, page ${pageNum}`;
    } else {
      // This would use the getTextPageContent function from novelController
      // For simplicity, we'll use a placeholder
      pageContent = `Content from ${novel.title}, page ${pageNum}`;
    }
    
    // Create a prompt for the AI
    const prompt = `${novel.title}, page ${pageNum}: ${pageContent.substring(0, 200)}...`;
    
    // Generate image with AI
    const { imageUrl } = await generateImageWithAI(prompt, style);
    
    // Log the image generation
    const imageLog = await ImageGenerationLog.create({
      novel: novelId,
      user: req.user.userId,
      page: pageNum,
      imageUrl,
      style,
      prompt,
    });
    
    // Update user's image generation count
    const user = await User.findById(req.user.userId);
    user.readingStats.imagesGenerated += 1;
    await user.save();
    
    res.status(200).json({ image: imageLog });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get images for a novel page
const getImagesForPage = async (req, res) => {
  try {
    const { novelId, page } = req.params;
    
    // Check if novel exists
    const novel = await Novel.findById(novelId);
    if (!novel) {
      return res.status(404).json({ message: 'Novel not found' });
    }
    
    // Check if user is authorized
    if (novel.owner.toString() !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to view images for this novel' });
    }
    
    // Get images for the page
    const images = await ImageGenerationLog.find({
      novel: novelId,
      page: parseInt(page),
      user: req.user.userId,
    }).sort({ createdAt: -1 });
    
    res.status(200).json({ images });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Admin: Get all image generation logs
const getAllImageLogs = async (req, res) => {
  try {
    const logs = await ImageGenerationLog.find()
      .populate('user', 'name email')
      .populate('novel', 'title')
      .sort({ createdAt: -1 });
    
    res.status(200).json({ logs });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  generateImage,
  getImagesForPage,
  getAllImageLogs,
};
