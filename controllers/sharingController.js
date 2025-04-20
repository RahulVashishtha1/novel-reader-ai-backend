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

// Helper function to draw a placeholder image when the actual image can't be loaded
const drawPlaceholderImage = (context, canvasWidth) => {
  const imgWidth = 400;
  const imgHeight = 300;
  const imgX = canvasWidth - imgWidth - 50;
  const imgY = 200;

  // Draw a placeholder background
  context.fillStyle = '#f3f4f6';
  context.fillRect(imgX, imgY, imgWidth, imgHeight);

  // Draw a decorative frame
  context.fillStyle = '#ffffff';
  context.fillRect(imgX - 10, imgY - 10, imgWidth + 20, imgHeight + 20);

  // Draw a border
  context.strokeStyle = '#d1d5db';
  context.lineWidth = 3;
  context.strokeRect(imgX, imgY, imgWidth, imgHeight);

  // Draw placeholder text
  context.fillStyle = '#6b7280';
  context.font = 'italic 24px Arial';
  context.textAlign = 'center';
  context.fillText('Image not available', imgX + imgWidth/2, imgY + imgHeight/2 - 15);
  context.font = 'italic 16px Arial';
  context.fillText('VisNovel AI Image', imgX + imgWidth/2, imgY + imgHeight/2 + 15);

  // Reset text alignment
  context.textAlign = 'left';
};

// Helper function to wrap text in the canvas
const wrapText = (context, text, x, y, maxWidth, lineHeight) => {
  // Clean text - ensure no HTML tags
  const cleanText = text.replace(/<[^>]*>/g, '');

  const words = cleanText.split(' ');
  let line = '';
  let testLine = '';
  let lineCount = 0;

  // Add a subtle text shadow for better readability
  context.shadowColor = 'rgba(0, 0, 0, 0.1)';
  context.shadowBlur = 2;
  context.shadowOffsetX = 1;
  context.shadowOffsetY = 1;

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

  // Reset shadow
  context.shadowColor = 'transparent';
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;

  return lineCount;
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
    let { content, page, imageId, expiresIn, isPublic = true } = req.body;

    // Validate required fields
    if (!content || !page) {
      return res.status(400).json({ message: 'Content and page are required' });
    }

    // Clean HTML tags from content if present
    if (content && typeof content === 'string' && content.includes('<')) {
      // Simple HTML tag removal (more sophisticated sanitization could be used)
      content = content.replace(/<[^>]*>/g, '');
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
        console.log('Found image URL for sharing:', imageUrl);
      } else {
        console.log('Image not found with ID:', imageId);
      }
    }

    // Create share URL
    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/share/${shareId}`;

    // Check if we have a preview image URL
    let socialImageUrl = null;
    if (req.body.previewImageUrl) {
      try {
        console.log('Using preview image as social image:', req.body.previewImageUrl);

        // Extract the filename from the URL
        const previewUrl = req.body.previewImageUrl;
        const urlParts = previewUrl.split('/');
        const filename = urlParts[urlParts.length - 1];

        // Create the social image path
        socialImageUrl = `uploads/social/social_${shareId}.png`;

        // Get the full path to the preview image
        let previewPath;
        if (previewUrl.startsWith('http')) {
          // Extract the path from the URL
          const urlObj = new URL(previewUrl);
          const pathPart = urlObj.pathname;
          previewPath = path.join(__dirname, '..', pathPart.replace(/^\/+/, ''));
        } else {
          // It's a relative path
          previewPath = path.join(__dirname, '..', previewUrl.replace(/^\/+/, ''));
        }

        // Get the full path to the social image
        const socialPath = path.join(__dirname, '..', socialImageUrl);

        // Ensure the directory exists
        const socialDir = path.dirname(socialPath);
        if (!fs.existsSync(socialDir)) {
          fs.mkdirSync(socialDir, { recursive: true });
        }

        console.log('Preview path:', previewPath);
        console.log('Social path:', socialPath);

        // Copy the file if it exists
        if (fs.existsSync(previewPath)) {
          fs.copyFileSync(previewPath, socialPath);
          console.log('Copied preview image to social image location');
        } else {
          console.error('Preview image not found at path:', previewPath);
          socialImageUrl = null;
        }
      } catch (err) {
        console.error('Error copying preview image:', err);
        socialImageUrl = null;
      }
    }

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
      socialImageUrl, // Add the social image URL if we have one
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
    let sharedContent;
    let isPreview = false;
    let previewImageUrl = null;

    // Check if this is a preview request or a real social image generation
    if (req.path === '/preview') {
      // This is a preview request
      isPreview = true;
      console.log('Generating preview social image');

      const { content, novelId, page, imageId, imageUrl } = req.body;

      // Create a temporary shared content object
      sharedContent = {
        content,
        type: 'passage',
        page,
        user: { name: req.user.name || 'You' },
        novel: { title: 'Preview' },
        imageUrl: null
      };

      // If we have a direct imageUrl (from the frontend), use it
      if (imageUrl) {
        console.log('Using provided image URL for preview:', imageUrl);
        previewImageUrl = imageUrl;
      } else if (imageId) {
        // If we have an imageId, try to find the image
        console.log('Looking up image by ID for preview:', imageId);
        const image = await ImageGenerationLog.findById(imageId);
        if (image) {
          sharedContent.imageUrl = image.imageUrl;
          console.log('Found image URL for preview:', image.imageUrl);
        }
      }

      // If we have a novelId, try to get the novel title
      if (novelId) {
        try {
          const novel = await Novel.findById(novelId);
          if (novel) {
            sharedContent.novel.title = novel.title;
          }
        } catch (err) {
          console.error('Error finding novel:', err);
          // Continue with default title
        }
      }
    } else {
      // This is a real social image generation
      const { shareId } = req.params;
      console.log('Generating social image for share ID:', shareId);

      // Find the shared content
      sharedContent = await SharedContent.findOne({ shareId })
        .populate('user', 'name')
        .populate('novel', 'title');

      if (!sharedContent) {
        return res.status(404).json({ message: 'Shared content not found' });
      }

      // Check if it's a passage
      if (sharedContent.type !== 'passage') {
        return res.status(400).json({ message: 'Can only generate images for passages' });
      }
    }

    // Create a canvas
    const width = 1200;
    const height = 630;
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d');

    // Draw gradient background
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#f8f9fa');
    gradient.addColorStop(1, '#e9ecef');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);

    // Draw border with rounded corners
    context.strokeStyle = '#3b82f6';
    context.lineWidth = 10;

    // Check if roundRect is supported, otherwise use regular rect with arc for corners
    if (typeof context.roundRect === 'function') {
      context.beginPath();
      context.roundRect(10, 10, width - 20, height - 20, 20);
      context.stroke();
    } else {
      // Fallback for older canvas implementations
      const x = 10;
      const y = 10;
      const w = width - 20;
      const h = height - 20;
      const r = 20;

      context.beginPath();
      context.moveTo(x + r, y);
      context.lineTo(x + w - r, y);
      context.arcTo(x + w, y, x + w, y + r, r);
      context.lineTo(x + w, y + h - r);
      context.arcTo(x + w, y + h, x + w - r, y + h, r);
      context.lineTo(x + r, y + h);
      context.arcTo(x, y + h, x, y + h - r, r);
      context.lineTo(x, y + r);
      context.arcTo(x, y, x + r, y, r);
      context.closePath();
      context.stroke();
    }

    // Draw app logo and name with shadow
    context.shadowColor = 'rgba(0, 0, 0, 0.2)';
    context.shadowBlur = 10;
    context.shadowOffsetX = 2;
    context.shadowOffsetY = 2;
    context.fillStyle = '#3b82f6';
    context.font = 'bold 48px Arial';
    context.fillText('VisNovel', 50, 80);

    // Reset shadow
    context.shadowColor = 'transparent';
    context.shadowBlur = 0;
    context.shadowOffsetX = 0;
    context.shadowOffsetY = 0;

    // Draw novel title with gradient
    const titleGradient = context.createLinearGradient(50, 0, width - 50, 0);
    titleGradient.addColorStop(0, '#1e3a8a');
    titleGradient.addColorStop(1, '#3b82f6');
    context.fillStyle = titleGradient;
    context.font = 'bold 36px Arial';

    // Truncate title if too long
    const title = sharedContent.novel.title.length > 40
      ? sharedContent.novel.title.substring(0, 40) + '...'
      : sharedContent.novel.title;

    context.fillText(`From "${title}"`, 50, 150);

    // Determine if we have an image to include
    let hasImage = false;
    let imageWidth = 0;
    let textWidth = width - 100;

    // If we have an image URL (either in shared content or preview), adjust text width
    if (sharedContent.imageUrl || previewImageUrl) {
      hasImage = true;
      imageWidth = 450; // Match the image width used later
      textWidth = width - imageWidth - 120; // Give more space to the image
    }

    // Draw passage content with improved styling
    context.fillStyle = '#1f2937';
    context.font = '24px Arial';
    const maxWidth = textWidth;
    const lineHeight = 36;

    // Use the wrapText function to draw the passage content
    const lineCount = wrapText(context, sharedContent.content, 50, 200, maxWidth, lineHeight);

    // Draw user attribution in the bottom left corner
    context.fillStyle = '#6b7280';
    context.font = 'italic 18px Arial';
    const attributionText = `Shared by ${sharedContent.user.name}`;
    context.fillText(attributionText, 50, height - 60); // Positioned at bottom left

    // Add a subtle VisNovel branding at the bottom right
    context.fillStyle = '#6b7280';
    context.font = 'italic 16px Arial';
    context.textAlign = 'right';
    context.fillText('Shared via VisNovel Reader', width - 50, height - 30);
    context.textAlign = 'left';

    // Check if we have an image URL in the shared content or preview
    console.log('Checking for image URL:', sharedContent.imageUrl || previewImageUrl);
    if (sharedContent.imageUrl || previewImageUrl) {
      try {
        // Get the full path to the image - handle both relative and absolute paths
        let imageToUse;

        // Handle preview image URL differently
        if (isPreview && previewImageUrl) {
          console.log('Using preview image URL:', previewImageUrl);

          // If it's a full URL (http/https), extract the path part
          if (previewImageUrl.startsWith('http')) {
            try {
              console.log('Extracting path from URL for preview');
              // Extract the path from the URL
              const urlObj = new URL(previewImageUrl);
              const pathPart = urlObj.pathname;

              // Try to find the image locally based on the path
              const localPath = path.join(__dirname, '..', pathPart.replace(/^\/+/, ''));
              console.log('Trying local path:', localPath);

              if (fs.existsSync(localPath)) {
                imageToUse = localPath;
                console.log('Found image at local path:', imageToUse);
              } else {
                // Try other possible paths
                const basename = path.basename(pathPart);
                const altPath = path.join(__dirname, '..', 'uploads', 'images', basename);

                if (fs.existsSync(altPath)) {
                  imageToUse = altPath;
                  console.log('Found image at alt path:', imageToUse);
                } else {
                  console.log('Could not find image locally, using placeholder');
                  imageToUse = null;
                }
              }
            } catch (err) {
              console.error('Error processing image URL:', err);
              // Fall back to placeholder
              imageToUse = null;
            }
          } else {
            // It's a relative path, clean it up
            const cleanUrl = previewImageUrl.replace(/\\/g, '/').replace(/^\/+/, '');
            console.log('Cleaned preview URL:', cleanUrl);

            // Try different paths
            const possiblePaths = [
              path.join(__dirname, '..', cleanUrl),
              path.join(__dirname, '..', 'uploads', cleanUrl),
              path.join(__dirname, '..', 'uploads', 'images', path.basename(cleanUrl))
            ];

            for (const p of possiblePaths) {
              if (fs.existsSync(p)) {
                imageToUse = p;
                console.log('Found preview image at:', imageToUse);
                break;
              }
            }

            if (!imageToUse) {
              console.log('Could not find preview image, using standard path');
              imageToUse = path.join(__dirname, '..', cleanUrl);
            }
          }
        } else {
          // Regular shared content image
          // Clean up the image URL to ensure it's properly formatted
          const cleanImageUrl = sharedContent.imageUrl.replace(/\\/g, '/').replace(/^\/+/, '');
          console.log('Cleaned image URL:', cleanImageUrl);

          // Check if the image URL is for an 'uploads/images' path or just 'images'
          const fullPath = path.join(__dirname, '..', 'uploads', cleanImageUrl);
          const altPath = path.join(__dirname, '..', cleanImageUrl);

          // Try both possible paths
          if (fs.existsSync(fullPath)) {
            console.log('Image found at full path:', fullPath);
            imageToUse = fullPath;
          } else if (fs.existsSync(altPath)) {
            console.log('Image found at alt path:', altPath);
            imageToUse = altPath;
          } else {
            // If the image is in 'images' folder but not in 'uploads/images'
            const imagesPath = path.join(__dirname, '..', 'uploads', 'images', path.basename(cleanImageUrl));
            if (fs.existsSync(imagesPath)) {
              console.log('Image found in uploads/images folder:', imagesPath);
              imageToUse = imagesPath;
            } else {
              console.log('Trying standard path construction');
              imageToUse = path.join(__dirname, '..', cleanImageUrl);
            }
          }
        }

        console.log('Final image path to use:', imageToUse);

        // Check if the image exists
        if (fs.existsSync(imageToUse)) {
          console.log('Image file exists, loading it');
          try {
            console.log('Attempting to load image from:', imageToUse);

            // Check if file exists and has content
            const stats = fs.statSync(imageToUse);
            if (stats.size === 0) {
              console.error('Image file exists but is empty');
              throw new Error('Image file is empty');
            }

            // Try to load the image
            const image = await loadImage(imageToUse).catch(err => {
              console.error('Error loading image with node-canvas:', err);
              throw err;
            });

            console.log('Image loaded successfully, dimensions:', image.width, 'x', image.height);

          // Calculate dimensions to maintain aspect ratio but allow for larger images
          const imgWidth = 450; // Increased from 400
          const imgHeight = (image.height / image.width) * imgWidth;
          const imgX = width - imgWidth - 50;
          const imgY = 180; // Moved up slightly

          // Draw a decorative frame around the image
          context.fillStyle = '#ffffff';
          context.fillRect(imgX - 10, imgY - 10, imgWidth + 20, imgHeight + 20);

          // Draw a shadow for the image
          context.shadowColor = 'rgba(0, 0, 0, 0.3)';
          context.shadowBlur = 15;
          context.shadowOffsetX = 5;
          context.shadowOffsetY = 5;

          // Draw image on the right side
          context.drawImage(image, imgX, imgY, imgWidth, imgHeight);

          // Reset shadow
          context.shadowColor = 'transparent';
          context.shadowBlur = 0;
          context.shadowOffsetX = 0;
          context.shadowOffsetY = 0;

          // Draw a border around the image
          context.strokeStyle = '#3b82f6';
          context.lineWidth = 3;
          context.strokeRect(imgX, imgY, imgWidth, imgHeight);

          // Add a small caption for the image
          context.fillStyle = '#4b5563';
          context.font = 'italic 16px Arial';
          context.textAlign = 'center';
          context.fillText('AI Generated Image', imgX + imgWidth/2, imgY + imgHeight + 20);
          context.textAlign = 'left'; // Reset text alignment
          } catch (err) {
            console.error('Error drawing image:', err);
          }
        } else {
          console.error('Image file does not exist at path:', imageToUse);
          // Draw a placeholder image instead
          drawPlaceholderImage(context, width);
        }
      } catch (err) {
        console.error('Error processing image:', err);
        // Draw a placeholder image instead
        drawPlaceholderImage(context, width);
      }
    } else {
      console.log('No image URL provided in shared content');
    }

    // Convert canvas to buffer
    const buffer = canvas.toBuffer('image/png');

    // Save the image
    const imageDir = path.join(__dirname, '..', 'uploads', 'social');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Different handling for preview vs. real social image
    if (isPreview) {
      // For preview, save with a temporary name
      const previewName = `preview_${Date.now()}.png`;
      const previewPath = path.join(imageDir, previewName);
      fs.writeFileSync(previewPath, buffer);

      // Return the preview URL
      const previewUrl = `uploads/social/${previewName}`;
      res.status(200).json({
        previewUrl,
        fullUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/${previewUrl}`
      });
    } else {
      // For real social image, save with the share ID
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
    }
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
