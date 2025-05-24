const express = require('express');
const cors = require('cors');
const path = require('path');

// Load environment variables first
require('dotenv').config();

console.log('🚀 Starting Comment Analyzer Server...');
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

console.log(`Server will bind to: ${HOST}:${PORT}`);

// Basic CORS setup (simplified)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Basic request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: false
}));

// Health check endpoints FIRST
app.get('/ping', (req, res) => {
  console.log('Ping received');
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

// Optional authentication middleware (safe version)
function optionalAuth(req, res, next) {
  try {
    // Skip authentication if JWT_SECRET is not configured
    if (!process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    // Simple token validation without database
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email || 'user@example.com'
    };
    
    next();
  } catch (error) {
    // On any error, just continue without user
    req.user = null;
    next();
  }
}

// Load routes with error handling
try {
  // API routes
  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);
  console.log('✅ API routes loaded');
} catch (error) {
  console.warn('⚠️ API routes failed to load:', error.message);
}

try {
  // Health routes
  const healthRoutes = require('./routes/health');
  app.use('/api', healthRoutes);
  console.log('✅ Health routes loaded');
} catch (error) {
  console.warn('⚠️ Health routes failed to load:', error.message);
}

try {
  // Claude routes (legacy)
  const claudeRoutes = require('./routes/claude');
  app.use('/api', claudeRoutes);
  console.log('✅ Claude routes loaded');
} catch (error) {
  console.warn('⚠️ Claude routes failed to load:', error.message);
}

try {
  // Auth routes (if database is available)
  if (process.env.DATABASE_URL && process.env.JWT_SECRET) {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
  } else {
    console.log('ℹ️ Auth routes skipped (DATABASE_URL or JWT_SECRET not configured)');
  }
} catch (error) {
  console.warn('⚠️ Auth routes failed to load:', error.message);
}

// Page routes with smart routing
app.get('/', optionalAuth, (req, res) => {
  console.log('Root route accessed');
  if (req.user) {
    console.log(`Authenticated user ${req.user.email} - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/dashboard', optionalAuth, (req, res) => {
  console.log('Dashboard route accessed');
  if (!req.user && process.env.JWT_SECRET) {
    console.log('Unauthenticated user trying to access dashboard - redirecting to login');
    return res.redirect('/login');
  }
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/comment-tool', (req, res) => {
  console.log('Comment tool accessed');
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

app.get('/login', optionalAuth, (req, res) => {
  console.log('Login page accessed');
  if (req.user) {
    console.log(`Already authenticated user - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  // Check if login page exists
  const loginPath = path.join(__dirname, 'public', 'login.html');
  const fs = require('fs');
  
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    console.log('Login page not found, redirecting to main page');
    res.redirect('/');
  }
});

app.get('/register', optionalAuth, (req, res) => {
  console.log('Register page accessed');
  if (req.user) {
    console.log(`Already authenticated user - redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  // Check if register page exists
  const registerPath = path.join(__dirname, 'public', 'register.html');
  const fs = require('fs');
  
  if (fs.existsSync(registerPath)) {
    res.sendFile(registerPath);
  } else {
    console.log('Register page not found, redirecting to main page');
    res.redirect('/');
  }
});

// API endpoint to check auth status
app.get('/api/auth-status', optionalAuth, (req, res) => {
  res.json({
    authenticated: !!req.user,
    user: req.user || null,
    redirectUrl: req.user ? '/dashboard' : '/',
    authEnabled: !!process.env.JWT_SECRET
  });
});

const industryRoutes = require('./routes/industry');
try {
  app.use('/api', industryRoutes);
  console.log('✅ Industry routes loaded');
} catch (error) {
  console.warn('Industry routes failed to load:', error.message);
}



// Catch-all route
app.get('*', (req, res) => {
  console.log(`Catch-all route: ${req.url} - serving main page`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  if (res.headersSent) {
    return next(err);
  }
  
  // Handle specific errors
  if (err.code === 'ECONNRESET') {
    return res.status(503).json({
      error: 'Connection Error',
      message: 'Connection was reset'
    });
  }
  
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid Token',
      message: 'Authentication token is invalid'
    });
  }
  
  // Default error
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.url} not found`
  });
});

// Start server with proper error handling
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔐 Auth: ${process.env.JWT_SECRET ? 'Enabled' : 'Disabled'}`);
  console.log(`🚀 Application ready to serve requests`);
});

// Handle server errors
server.on('error', (error) => {
  console.error('❌ Server error:', error);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
    process.exit(1);
  } else if (error.code === 'EACCES') {
    console.error(`Permission denied to bind to port ${PORT}`);
    process.exit(1);
  } else {
    console.error('Unknown server error');
    process.exit(1);
  }
});

// Graceful shutdown
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

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Promise Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

module.exports = app;