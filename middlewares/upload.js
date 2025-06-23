const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { v2: cloudinary } = require('cloudinary');
require('dotenv').config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// File filter for novels
const novelFilter = (req, file, cb) => {
  const extension = (file.originalname || '').split('.').pop().toLowerCase();
  if (extension !== 'txt' && extension !== 'epub') {
    return cb(new Error('Only .txt and .epub files are allowed!'));
  }
  return cb(null, true);
};

// File filter for images
const imageFilter = (req, file, cb) => {
  const extension = (file.originalname || '').split('.').pop().toLowerCase();
  if (!['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
    return cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed!'));
  }
  return cb(null, true);
};

// Cloudinary storage for novels
const novelStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'novels',
    resource_type: 'raw', // for txt/epub
    format: async (req, file) => file.originalname.split('.').pop(),
    public_id: (req, file) => `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  },
});

// Cloudinary storage for images
const imageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'images',
    resource_type: 'image',
    format: async (req, file) => file.originalname.split('.').pop(),
    public_id: (req, file) => `${Date.now()}-${Math.round(Math.random() * 1e9)}`,
  },
});

const uploadNovel = multer({
  storage: novelStorage,
  fileFilter: novelFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = { uploadNovel, uploadImage };
