const multer = require('multer');
const path = require('path');

// Configure storage for novels
const novelStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/novels');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Configure storage for images
const imageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/images');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter for novels
const novelFilter = (req, file, cb) => {
  console.log('Uploaded file:', file.originalname, file.mimetype);

  // Get the file extension and check if it's valid
  const extension = path.extname(file.originalname).toLowerCase();

  // Check if the extension is valid (.txt or .epub)
  if (extension !== '.txt' && extension !== '.epub') {
    console.log('Invalid extension:', extension);
    return cb(new Error('Only .txt and .epub files are allowed!'));
  }

  // If we get here, the file is valid
  return cb(null, true);
};

// File filter for images
const imageFilter = (req, file, cb) => {
  console.log('Uploaded image:', file.originalname, file.mimetype);

  // Get the file extension and check if it's valid
  const extension = path.extname(file.originalname).toLowerCase();

  // Check if the extension is valid (image file)
  if (extension !== '.jpg' && extension !== '.jpeg' && extension !== '.png' && extension !== '.gif') {
    console.log('Invalid image extension:', extension);
    return cb(new Error('Only image files (jpg, jpeg, png, gif) are allowed!'));
  }

  // If we get here, the file is valid
  return cb(null, true);
};

// Create upload middleware for novels
const uploadNovel = multer({
  storage: novelStorage,
  fileFilter: novelFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// Create upload middleware for images
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

module.exports = { uploadNovel, uploadImage };
