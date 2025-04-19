const mongoose = require('mongoose');

const AnnotationSchema = new mongoose.Schema(
  {
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
    page: {
      type: Number,
      required: true,
    },
    textSelection: {
      startOffset: {
        type: Number,
        required: true,
      },
      endOffset: {
        type: Number,
        required: true,
      },
      selectedText: {
        type: String,
        required: true,
      },
    },
    color: {
      type: String,
      default: '#ffff00', // Default yellow
    },
    note: {
      type: String,
    },
    category: {
      type: String,
      enum: ['highlight', 'note', 'question', 'important', 'vocabulary', 'custom'],
      default: 'highlight',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Annotation', AnnotationSchema);
