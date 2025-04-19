const mongoose = require('mongoose');

const NovelSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    filePath: {
      type: String,
      required: [true, 'File path is required'],
    },
    fileType: {
      type: String,
      enum: ['txt', 'epub'],
      required: [true, 'File type is required'],
    },
    totalPages: {
      type: Number,
      required: [true, 'Total pages is required'],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner is required'],
    },
    bookmarks: [
      {
        page: {
          type: Number,
          required: true,
        },
        name: {
          type: String,
          default: '',
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    notes: [
      {
        page: {
          type: Number,
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastReadPage: {
      type: Number,
      default: 1,
    },
    totalReadingTime: {
      type: Number,
      default: 0,
    },
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Novel', NovelSchema);
