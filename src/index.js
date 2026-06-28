const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize JSON database (seeds default profile automatically)
require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Request logging
app.use(morgan('dev'));

// Parse JSON bodies
app.use(express.json());

// Routes
const chatRouter = require('./routes/chat');
const farmerRouter = require('./routes/farmer');

app.use('/api/chat', chatRouter);
app.use('/api/farmer', farmerRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', app: 'Kisaan Sahyog Backend', time: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    error: {
      code: 'UNHANDLED_ERROR',
      message: 'An unexpected error occurred on the server.'
    }
  });
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` Kisaan Sahyog Backend Server running on port ${PORT}`);
  console.log(` Env: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});
