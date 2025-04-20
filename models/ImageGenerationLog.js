const mongoose = require('mongoose');

const ImageGenerationLogSchema = new mongoose.Schema(
  {
    novel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Novel',
      required: [true, 'Novel is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    page: {
      type: Number,
      required: [true, 'Page number is required'],
    },
    imageUrl: {
      type: String,
      required: [true, 'Image URL is required'],
    },
    style: {
      type: String,
      default: 'default',
    },
    prompt: {
      type: String,
      required: [true, 'Prompt is required'],
    },
    error: {
      type: String,
      default: null,
    },
    generationMethod: {
      type: String,
      enum: ['cloudflare', 'huggingface', 'mock'],
      default: 'cloudflare',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ImageGenerationLog', ImageGenerationLogSchema);
