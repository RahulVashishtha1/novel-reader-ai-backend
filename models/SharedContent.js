const mongoose = require('mongoose');

const SharedContentSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['passage', 'progress'],
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    novel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Novel',
      required: true,
    },
    content: {
      type: String,
      // Required for passage type
    },
    page: {
      type: Number,
      // Required for passage type
    },
    imageUrl: {
      type: String,
      // Optional, for passage with image
    },
    stats: {
      type: Object,
      // For progress cards
    },
    shareUrl: {
      type: String,
      required: true,
    },
    shareId: {
      type: String,
      required: true,
      unique: true,
    },
    expiresAt: {
      type: Date,
      // Optional expiration
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('SharedContent', SharedContentSchema);
