const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { corsMiddleware, requestLogger, errorHandler } = require('./middleware');

// Import routes
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const claudeRoutes = require('./routes/claude');
const authRoutes = require('./routes/auth'); // NEW: Authentication routes

// Import authentication middleware
const { optionalAuth } = require('./middleware/auth'); // NEW

const app = express();
const PORT = process.env.PORT || 3000;

// Apply middleware
corsMiddleware(app);
requestLogger(app);

// Body parsing middleware with large limits for batch processing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add optional authentication to all routes (sets req.user if logged in)
app.use(optionalAuth); // NEW

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes); // NEW: Authentication routes
app.use('/api', apiRoutes);
app.use('/api', healthRoutes);
app.use('/api', claudeRoutes);

// Root route - serve main app or login page
// In your server.js or main route file
a// Dashboard route (authenticated users will see this)
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Keep existing routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Comment analysis tool as separate route (for iframe embedding)
app.get('/comment-tool', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

app.get('/comment-analysis', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html')); // Your existing tool
});


// NEW: Login and register pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
errorHandler(app);

// Server monitoring
const { setupServerMonitoring } = require('./utils/monitoring');
setupServerMonitoring();

// NEW: Database connection test on startup
const { testConnection } = require('./utils/database');

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
  
  // Test database connection
  console.log('Testing database connection...');
  const dbConnected = await testConnection();
  
  if (dbConnected) {
    console.log('✅ Database connected successfully');
    console.log('🚀 Authentication system ready');
  } else {
    console.log('❌ Database connection failed');
    console.log('⚠️  Authentication features may not work properly');
  }
});

module.exports = app;