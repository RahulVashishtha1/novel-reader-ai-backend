// Script to list all users in the database
const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

// Function to list all users
async function listAllUsers() {
  try {
    // Find all users
    const users = await User.find({}, 'name email role');
    
    if (users.length === 0) {
      console.log('No users found in the database');
      process.exit(0);
    }
    
    console.log('Users in the database:');
    users.forEach(user => {
      console.log(`- ${user.name} (${user.email}) - Role: ${user.role}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error listing users:', error);
    process.exit(1);
  }
}

// Run the function
listAllUsers();
