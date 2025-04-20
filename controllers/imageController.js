const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { generateImageWithCloudflare } = require('../utils/cloudflareAI');
const ImageGenerationLog = require('../models/ImageGenerationLog');
const Novel = require('../models/Novel');
const User = require('../models/User');

// Optional: Keep Hugging Face for backward compatibility
let hf;
try {
  const { HfInference } = require('@huggingface/inference');
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY || '');
} catch (error) {
  console.log('Hugging Face inference package not available, using Cloudflare AI only');
}

// Function for AI image generation using Cloudflare Workers AI (with Hugging Face fallback)
const generateImageWithAI = async (prompt, style) => {
  console.log(`Generating image with prompt: "${prompt}" and style: ${style}`);

  try {
    // Create directory if it doesn't exist
    const imageDir = path.join('uploads', 'images');
    if (!fs.existsSync(imageDir)) {
      fs.mkdirSync(imageDir, { recursive: true });
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const imageName = `generated_${timestamp}.png`;
    const imagePath = path.join(imageDir, imageName);

    // Try to generate image with Cloudflare Workers AI first
    let imageBuffer;
    let generationMethod = 'cloudflare';

    try {
      console.log('Attempting to generate image with Cloudflare Workers AI');
      imageBuffer = await generateImageWithCloudflare(prompt, style);
      console.log('Successfully generated image with Cloudflare Workers AI');
    } catch (cloudflareError) {
      console.error('Cloudflare Workers AI generation failed:', cloudflareError.message);

      // Add specific error handling for common Cloudflare issues
      let errorMessage = cloudflareError.message;

      // Check for specific Cloudflare error patterns
      if (errorMessage.includes('num_steps') && errorMessage.includes('must be <=')) {
        console.log('Detected num_steps error, this is a configuration issue');
        errorMessage = 'Image generation parameter error: num_steps value too high';
      } else if (errorMessage.includes('Authentication Error')) {
        console.log('Detected authentication error, check Cloudflare credentials');
        errorMessage = 'Cloudflare authentication failed. Please check your account ID and API token.';
      } else if (errorMessage.includes('Rate Limit')) {
        console.log('Detected rate limit error');
        errorMessage = 'Cloudflare rate limit reached. Please try again later.';
      }

      generationMethod = 'huggingface';
      console.log(`Switching to ${generationMethod} due to Cloudflare error: ${errorMessage}`);

      // Fall back to Hugging Face if Cloudflare fails and HF is available
      if (hf) {
        console.log('Falling back to Hugging Face API');

        // Select model and adjust prompt based on style
        let model;
        let adjustedPrompt;

        switch (style) {
          case 'anime':
            model = 'Linaqruf/anything-v3.0';
            adjustedPrompt = `${prompt}, anime style, detailed, vibrant colors, high quality illustration, masterpiece`;
            break;
          case 'realistic':
            model = 'stabilityai/stable-diffusion-2-1';
            adjustedPrompt = `${prompt}, realistic, detailed, photorealistic, 4k, high resolution photography`;
            break;
          case 'artistic':
            model = 'prompthero/openjourney';
            adjustedPrompt = `${prompt}, artistic style, vibrant, detailed, mdjrny-v4 style, digital painting`;
            break;
          case 'fantasy':
            model = 'stabilityai/stable-diffusion-xl-base-1.0';
            adjustedPrompt = `${prompt}, fantasy art style, magical, ethereal, detailed fantasy scene`;
            break;
          default:
            model = 'stabilityai/stable-diffusion-2';
            adjustedPrompt = `${prompt}, detailed, high quality`;
            break;
        }

        console.log(`Using Hugging Face model: ${model} with adjusted prompt: "${adjustedPrompt}"`);

        // Try with API key if available
        if (process.env.HUGGINGFACE_API_KEY) {
          console.log('Using Hugging Face API with provided key');
          imageBuffer = await hf.textToImage({
            model: model,
            inputs: adjustedPrompt,
            parameters: {
              negative_prompt: 'blurry, bad quality, distorted, disfigured'
            }
          });
        } else {
          console.log('No Hugging Face API key provided, using public API');
          // Use the public API endpoint
          const response = await axios({
            method: 'post',
            url: `https://api-inference.huggingface.co/models/${model}`,
            data: { inputs: adjustedPrompt },
            responseType: 'arraybuffer'
          });
          imageBuffer = response.data;
        }
      } else {
        // If both Cloudflare and Hugging Face fail, throw the original error
        throw cloudflareError;
      }
    }

    // Save the image to disk
    fs.writeFileSync(imagePath, imageBuffer);
    console.log(`Image saved to ${imagePath} using ${generationMethod}`);

    // Return the relative path to the image
    // Use forward slashes for URLs, not path.join which uses OS-specific separators
    const relativePath = `images/${imageName}`;
    return {
      imageUrl: relativePath,
      prompt: prompt,
      style,
      generationMethod
    };
  } catch (error) {
    console.error('Error generating image:', error);

    // Check for specific error types
    let errorMessage = error.message;

    if (error.response) {
      // Handle API response errors
      if (error.response.status === 429) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
      } else if (error.response.status === 503) {
        errorMessage = 'AI service is currently unavailable. Please try again later.';
      }
      console.log(`API error (${error.response.status}): ${errorMessage}`);
    }

    // Fallback to appropriate mock image based on style
    console.log('Falling back to mock image');

    // Create the images directory if it doesn't exist
    const mockDir = path.join(process.cwd(), 'uploads', 'images');
    if (!fs.existsSync(mockDir)) {
      fs.mkdirSync(mockDir, { recursive: true });
    }

    // Determine which mock image to use
    let mockImagePath;

    // For default style or if there's an error, use the existing cat image
    if (style === 'default' || !style) {
      mockImagePath = 'images/mock-cat-image.jpeg';
      console.log('Using existing mock cat image');
    } else {
      // For other styles, create style-specific mock images
      const mockFileName = `mock-${style}.jpeg`;
      const mockFilePath = path.join(mockDir, mockFileName);

      // Check if the style-specific mock image already exists
      if (fs.existsSync(mockFilePath)) {
        console.log(`Using existing mock image for style: ${style}`);
        mockImagePath = `images/${mockFileName}`;
      } else {
        try {
          console.log(`Creating mock image for style: ${style}`);
          const canvas = require('canvas');
          const c = canvas.createCanvas(400, 300);
          const ctx = c.getContext('2d');

          // Different colors for different styles
          let bgColor, textColor;
          switch(style) {
            case 'anime':
              bgColor = '#FF9FF3';
              textColor = '#0A0A0A';
              break;
            case 'realistic':
              bgColor = '#A3CB38';
              textColor = '#1B1464';
              break;
            case 'artistic':
              bgColor = '#FD7272';
              textColor = '#FFFFFF';
              break;
            case 'fantasy':
              bgColor = '#9980FA';
              textColor = '#FFFFFF';
              break;
            default:
              bgColor = '#3498db';
              textColor = '#FFFFFF';
          }

          // Draw background
          ctx.fillStyle = bgColor;
          ctx.fillRect(0, 0, 400, 300);

          // Draw text
          ctx.fillStyle = textColor;
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`Mock ${style} Image`, 200, 140);
          ctx.font = '16px Arial';
          ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 200, 170);

          // Save the image
          const buffer = c.toBuffer('image/jpeg');
          fs.writeFileSync(mockFilePath, buffer);
          console.log(`Mock image created at ${mockFilePath}`);

          // Set the relative path for the image URL
          mockImagePath = `images/${mockFileName}`;
        } catch (err) {
          console.error('Error creating mock image:', err);
          // Fallback to the existing cat image if image creation fails
          mockImagePath = 'images/mock-cat-image.jpeg';
          errorMessage += ' Failed to create mock image.';
        }
      }
    }

    console.log('Using mock image:', mockImagePath);

    return {
      imageUrl: mockImagePath,
      prompt,
      style,
      error: errorMessage,
      generationMethod: 'mock'
    };
  }
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
    // Import the functions from novelController
    const { getEpubPageContent, getTextPageContent } = require('./novelController');

    // Variable to store EPUB content information if applicable
    let epubContent = null;

    if (novel.fileType === 'epub') {
      epubContent = await getEpubPageContent(novel.filePath, pageNum);
      // Extract plain text from HTML for the prompt
      if (epubContent.isHtml) {
        pageContent = epubContent.content.replace(/<[^>]*>/g, '');
      } else {
        pageContent = epubContent.content;
      }
    } else {
      pageContent = await getTextPageContent(novel.filePath, pageNum);
    }

    // Create a better prompt for the AI by analyzing the content
    // First, clean up the content
    const cleanContent = pageContent
      .replace(/\s+/g, ' ')  // Replace multiple spaces with a single space
      .replace(/[\r\n]+/g, ' ')  // Replace newlines with spaces
      .trim();

    // Extract key information for a better prompt
    let promptContent = '';
    let chapterInfo = '';

    // If it's an EPUB, we might have chapter information
    if (novel.fileType === 'epub' && epubContent) {
      // Extract chapter information if available
      if (epubContent.chapterTitle) {
        chapterInfo = epubContent.chapterTitle;
      }
    }

    // Try to extract a meaningful scene description
    // Look for sentences that contain descriptive elements
    const sentences = cleanContent.split(/[.!?]\s+/);

    // Keywords that might indicate descriptive content
    const descriptiveKeywords = [
      'looked', 'appeared', 'saw', 'scene', 'view', 'landscape',
      'room', 'stood', 'sat', 'walked', 'forest', 'sky', 'mountain',
      'river', 'building', 'castle', 'house', 'street', 'city',
      'village', 'field', 'garden', 'beach', 'ocean', 'sea',
      'wearing', 'dressed', 'clothes', 'face', 'eyes', 'hair',
      'tall', 'short', 'large', 'small', 'beautiful', 'handsome',
      'ugly', 'dark', 'light', 'bright', 'dim', 'red', 'blue',
      'green', 'yellow', 'black', 'white', 'color'
    ];

    // Find sentences with descriptive content
    const descriptiveSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase();
      return descriptiveKeywords.some(keyword => lowerSentence.includes(keyword));
    });

    if (descriptiveSentences.length > 0) {
      // Use the most descriptive sentence (usually the longest one with keywords)
      promptContent = descriptiveSentences.sort((a, b) => b.length - a.length)[0];
    } else if (sentences.length > 0) {
      // If no descriptive sentences found, use the first non-empty sentence
      promptContent = sentences.find(s => s.trim().length > 20) || sentences[0];
    } else {
      // Fallback to first 100 characters
      promptContent = cleanContent.substring(0, 100);
    }

    // Ensure the prompt isn't too long (max 200 chars for the content part)
    if (promptContent.length > 200) {
      promptContent = promptContent.substring(0, 197) + '...';
    }

    // Create a descriptive prompt for better image generation
    let prompt;
    if (chapterInfo) {
      prompt = `Scene from "${novel.title}" (${chapterInfo}): ${promptContent}`;
    } else {
      prompt = `Scene from "${novel.title}": ${promptContent}`;
    }

    // Generate image with AI
    console.log('Calling generateImageWithAI with prompt:', prompt.substring(0, 50) + '...');
    const imageResult = await generateImageWithAI(prompt, style);
    console.log('Image generation result:', {
      imageUrl: imageResult.imageUrl,
      style: imageResult.style,
      error: imageResult.error || 'none'
    });

    // Check if the image path exists
    const fullImagePath = path.join(process.cwd(), 'uploads', imageResult.imageUrl);
    const imageExists = fs.existsSync(fullImagePath);
    console.log(`Image path ${fullImagePath} exists: ${imageExists}`);

    // Check if the image exists, and use a fallback if needed
    if (!imageExists) {
      console.log(`Image file not found at ${fullImagePath}, using fallback image`);

      // Create the images directory if it doesn't exist
      const fallbackDir = path.join(process.cwd(), 'uploads', 'images');
      if (!fs.existsSync(fallbackDir)) {
        fs.mkdirSync(fallbackDir, { recursive: true });
      }

      // Check if the mock cat image exists
      const fallbackPath = path.join(fallbackDir, 'mock-cat-image.jpeg');
      if (fs.existsSync(fallbackPath)) {
        console.log('Using existing mock cat image');
        imageResult.imageUrl = 'images/mock-cat-image.jpeg';
      } else {
        // If the default mock image doesn't exist, try to create a style-specific one
        try {
          // Create a style-specific mock image
          const mockFileName = `mock-${style || 'default'}.jpeg`;
          const mockFilePath = path.join(fallbackDir, mockFileName);

          console.log(`Creating style-specific mock image for: ${style}`);
          const canvas = require('canvas');
          const c = canvas.createCanvas(400, 300);
          const ctx = c.getContext('2d');

          // Draw a gradient background
          const gradient = ctx.createLinearGradient(0, 0, 400, 300);
          gradient.addColorStop(0, '#3498db');
          gradient.addColorStop(1, '#2980b9');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 400, 300);

          // Draw text
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 24px Arial';
          ctx.textAlign = 'center';
          ctx.fillText(`Mock ${style || 'default'} Image`, 200, 140);
          ctx.font = '16px Arial';
          ctx.fillText(`Generated: ${new Date().toLocaleString()}`, 200, 170);

          // Save the image
          const buffer = c.toBuffer('image/jpeg');
          fs.writeFileSync(mockFilePath, buffer);
          console.log(`Mock image created at ${mockFilePath}`);

          // Update the image URL to use the mock image
          imageResult.imageUrl = `images/${mockFileName}`;
        } catch (err) {
          console.error('Error creating mock image:', err);
          // If we can't create the image, set an error
          imageResult.error = 'Failed to create mock image: ' + err.message;
        }
      }
    }

    // Log the image generation
    const imageLog = await ImageGenerationLog.create({
      novel: novelId,
      user: req.user.userId,
      page: pageNum,
      imageUrl: imageResult.imageUrl,
      style,
      prompt,
      error: imageResult.error || null,
      generationMethod: imageResult.generationMethod || 'mock'
    });

    // Update user's image generation count
    const user = await User.findById(req.user.userId);
    user.readingStats.imagesGenerated += 1;
    await user.save();

    console.log('Sending response with image:', imageLog);
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
const getAllImageLogs = async (_, res) => {
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
