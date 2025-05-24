const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables first
require('dotenv').config();

// Import middleware
const { corsMiddleware, requestLogger, errorHandler } = require('./middleware');

// Import routes
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const claudeRoutes = require('./routes/claude');
const authRoutes = require('./routes/auth');

// Import authentication middleware (but make it optional to avoid crashes)
let optionalAuth;
try {
  const authMiddleware = require('./middleware/auth');
  optionalAuth = authMiddleware.optionalAuth;
} catch (error) {
  console.warn('Authentication middleware not available:', error.message);
  // Create a no-op middleware if auth is not available
  optionalAuth = (req, res, next) => next();
}

const app = express();
const PORT = process.env.PORT || 3000;

// CRITICAL: Ensure the server binds to the correct host and port for Heroku
const HOST = process.env.HOST || '0.0.0.0';

console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Configured to start on: ${HOST}:${PORT}`);

// Apply CORS middleware
try {
  corsMiddleware(app);
} catch (error) {
  console.error('CORS middleware failed:', error);
  // Apply basic CORS as fallback
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
  }));
}

// Apply request logging
try {
  requestLogger(app);
} catch (error) {
  console.error('Request logger failed:', error);
  // Basic logging fallback
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
  });
}

// Body parsing middleware with large limits for batch processing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Add optional authentication (with error handling)
try {
  app.use(optionalAuth);
} catch (error) {
  console.warn('Optional auth middleware failed:', error.message);
}

// Serve static files with error handling
try {
  app.use(express.static(path.join(__dirname, 'public')));
} catch (error) {
  console.error('Static files middleware failed:', error);
}

// Health check endpoint FIRST (before other routes)
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});


// API Routes with error handling
try {
  app.use('/api/auth', authRoutes);
  console.log('✅ Auth routes loaded');
} catch (error) {
  console.warn('Auth routes failed to load:', error.message);
}

try {
  app.use('/api', apiRoutes);
  console.log('✅ API routes loaded');
} catch (error) {
  console.error('API routes failed to load:', error);
}

try {
  app.use('/api', healthRoutes);
  console.log('✅ Health routes loaded');
} catch (error) {
  console.warn('Health routes failed to load:', error.message);
}

try {
  app.use('/api', claudeRoutes);
  console.log('✅ Claude routes loaded');
} catch (error) {
  console.warn('Claude routes failed to load:', error.message);
}

// Add this to your server.js after the middleware setup and before the catch-all route

// Import authentication middleware for route protection
const { authenticateToken, optionalAuth } = require('./middleware/auth');

// Root route - smart routing based on authentication
app.get('/', optionalAuth, (req, res) => {
  // If user is authenticated, redirect to dashboard
  if (req.user) {
    console.log(`Authenticated user ${req.user.email} accessing root - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  // If not authenticated, show the main landing page (comment tool)
  console.log('Unauthenticated user accessing root - showing comment tool');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard route - requires authentication
app.get('/dashboard', authenticateToken, (req, res) => {
  console.log(`User ${req.user.email} accessing dashboard`);
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Comment analysis tool - public access (can be used without login)
app.get('/comment-tool', (req, res) => {
  console.log('Comment tool accessed (public)');
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

app.get('/comment-analysis', (req, res) => {
  console.log('Comment analysis accessed (public)');
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

// Auth pages - only for non-authenticated users
app.get('/login', optionalAuth, (req, res) => {
  // If already logged in, redirect to dashboard
  if (req.user) {
    console.log(`Already authenticated user ${req.user.email} accessing login - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  console.log('Showing login page');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', optionalAuth, (req, res) => {
  // If already logged in, redirect to dashboard
  if (req.user) {
    console.log(`Already authenticated user ${req.user.email} accessing register - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  console.log('Showing register page');
  res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

// API endpoint to check auth status (useful for frontend)
app.get('/api/auth-status', optionalAuth, (req, res) => {
  res.json({
    authenticated: !!req.user,
    user: req.user || null,
    redirectUrl: req.user ? '/dashboard' : '/login'
  });
});

// Logout endpoint that redirects
app.post('/logout', (req, res) => {
  // Clear any session data if needed
  console.log('User logged out - redirecting to home');
  res.redirect('/');
});

// Catch-all route - handle unmatched routes intelligently
app.get('*', optionalAuth, (req, res) => {
  console.log(`Catch-all route hit: ${req.url}`);
  
  // If user is authenticated, redirect to dashboard
  if (req.user) {
    console.log(`Authenticated user accessing unknown route - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  // If not authenticated, show the main landing page
  console.log('Unauthenticated user accessing unknown route - showing comment tool');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard route
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Main routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/comment-tool', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

app.get('/comment-analysis', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

// Auth pages
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

// Error handling middleware
try {
  errorHandler(app);
} catch (error) {
  console.error('Error handler failed:', error);
  // Basic error handler fallback
  app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
  });
}

// Server monitoring (optional)
try {
  const { setupServerMonitoring } = require('./utils/monitoring');
  setupServerMonitoring();
  console.log('✅ Server monitoring initialized');
} catch (error) {
  console.warn('Server monitoring failed to initialize:', error.message);
}

// Database connection test (optional)
let testConnection;
try {
  const database = require('./utils/database');
  testConnection = database.testConnection;
} catch (error) {
  console.warn('Database module not available:', error.message);
  testConnection = null;
}

// CRITICAL: Proper error handling for server startup
const server = app.listen(PORT, HOST, async () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Process ID: ${process.pid}`);
  
  // Test database connection if available
  if (testConnection) {
    try {
      console.log('Testing database connection...');
      const dbConnected = await testConnection();
      
      if (dbConnected) {
        console.log('✅ Database connected successfully');
        console.log('🚀 Authentication system ready');
      } else {
        console.log('❌ Database connection failed');
        console.log('⚠️  Authentication features may not work properly');
      }
    } catch (dbError) {
      console.warn('Database test failed:', dbError.message);
    }
  } else {
    console.log('ℹ️  Database connection test skipped (module not available)');
  }
  
  console.log('🚀 Application fully initialized and ready to serve requests');
});

// CRITICAL: Handle server startup errors
server.on('error', (error) => {
  console.error('❌ Server startup error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${PORT}`);
  }
  
  process.exit(1);
});

// CRITICAL: Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// CRITICAL: Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;