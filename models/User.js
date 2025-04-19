const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Please provide an email'],
      match: [
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        'Please provide a valid email',
      ],
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [6, 'Password must be at least 6 characters'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    bio: {
      type: String,
      maxlength: [500, 'Bio cannot be more than 500 characters'],
      default: '',
    },
    readingStats: {
      totalReadingTime: {
        type: Number,
        default: 0,
      },
      pagesRead: {
        type: Number,
        default: 0,
      },
      novelsCompleted: {
        type: Number,
        default: 0,
      },
      imagesGenerated: {
        type: Number,
        default: 0,
      },
    },
    readingPreferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'sepia'],
        default: 'light',
      },
      fontSize: {
        type: Number,
        default: 16,
      },
      fontFamily: {
        type: String,
        enum: ['system-ui', 'serif', 'sans-serif', 'monospace', 'dyslexic'],
        default: 'system-ui',
      },
      lineSpacing: {
        type: Number,
        default: 1.5,
      },
      letterSpacing: {
        type: Number,
        default: 0,
      },
      dyslexiaFriendly: {
        type: Boolean,
        default: false,
      },
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
