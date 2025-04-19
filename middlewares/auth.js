const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to authenticate user
const authenticateUser = async (req, res, next) => {
  // Check for token in headers
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication invalid' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    // Verify token
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user to request object
    req.user = { userId: payload.userId, name: payload.name, role: payload.role };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Authentication invalid' });
  }
};

// Middleware to authorize admin
const authorizeAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Unauthorized to access this route' });
  }
  next();
};

module.exports = { authenticateUser, authorizeAdmin };
