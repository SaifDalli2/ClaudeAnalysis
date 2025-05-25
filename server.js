// Fixed server.js - Remove duplicate routes and fix authentication logic

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

// Basic CORS setup
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

// Health check endpoints
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

    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.userId,
      email: decoded.email || 'user@example.com'
    };
    
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

// Load routes with error handling
try {
  const apiRoutes = require('./routes/api');
  app.use('/api', apiRoutes);
  console.log('✅ API routes loaded');
} catch (error) {
  console.warn('⚠️ API routes failed to load:', error.message);
}

try {
  const healthRoutes = require('./routes/health');
  app.use('/api', healthRoutes);
  console.log('✅ Health routes loaded');
} catch (error) {
  console.warn('⚠️ Health routes failed to load:', error.message);
}

try {
  const claudeRoutes = require('./routes/claude');
  app.use('/api', claudeRoutes);
  console.log('✅ Claude routes loaded');
} catch (error) {
  console.warn('⚠️ Claude routes failed to load:', error.message);
}

try {
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

try {
  const industryRoutes = require('./routes/industry');
  app.use('/api', industryRoutes);
  console.log('✅ Industry routes loaded');
} catch (error) {
  console.warn('⚠️ Industry routes failed to load:', error.message);
}

// FIXED PAGE ROUTES - Single definition for each route

// Dashboard route - FIXED to always allow access
app.get('/dashboard', optionalAuth, (req, res) => {
  console.log('Dashboard route accessed');
  console.log('User:', req.user ? req.user.email : 'Not authenticated');
  
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  console.log('Dashboard path:', dashboardPath);
  
  // Check if file exists
  const fs = require('fs');
  if (!fs.existsSync(dashboardPath)) {
    console.error('❌ Dashboard file not found:', dashboardPath);
    return res.status(404).json({
      error: 'Dashboard not found',
      message: 'dashboard.html file is missing',
      expectedPath: dashboardPath
    });
  }
  
  // Always serve dashboard (no authentication required)
  res.sendFile(dashboardPath);
});

// Alternative dashboard routes
app.get('/nps-dashboard', (req, res) => {
  console.log('NPS Dashboard direct access');
  res.redirect('/dashboard');
});

app.get('/dash', (req, res) => {
  console.log('Short dashboard redirect');
  res.redirect('/dashboard');
});

// Root route
app.get('/', optionalAuth, (req, res) => {
  console.log('Root route accessed');
  if (req.user) {
    console.log(`Authenticated user ${req.user.email}`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Comment tool route
app.get('/comment-tool', (req, res) => {
  console.log('Comment tool accessed');
  res.sendFile(path.join(__dirname, 'public', 'comment-tool.html'));
});

// Auth pages - only if auth is enabled
app.get('/login', optionalAuth, (req, res) => {
  console.log('Login page accessed');
  
  if (req.user) {
    console.log('Already authenticated user - redirecting to dashboard');
    return res.redirect('/dashboard');
  }
  
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
    console.log('Already authenticated user - redirecting to dashboard');
    return res.redirect('/dashboard');
  }
  
  const registerPath = path.join(__dirname, 'public', 'register.html');
  const fs = require('fs');
  
  if (fs.existsSync(registerPath)) {
    res.sendFile(registerPath);
  } else {
    console.log('Register page not found, redirecting to main page');
    res.redirect('/');
  }
});

// API endpoints
app.get('/api/auth-status', optionalAuth, (req, res) => {
  res.json({
    authenticated: !!req.user,
    user: req.user || null,
    redirectUrl: req.user ? '/dashboard' : '/',
    authEnabled: !!process.env.JWT_SECRET
  });
});

app.get('/navigation', (req, res) => {
  res.json({
    pages: [
      { name: 'Comment Tool', url: '/', description: 'Analyze and categorize comments' },
      { name: 'NPS Dashboard', url: '/dashboard', description: 'View NPS analytics and trends' },
      { name: 'Comment Analysis', url: '/comment-tool', description: 'Advanced comment categorization' }
    ]
  });
});

// Debug endpoint
app.get('/test-dashboard', (req, res) => {
  const fs = require('fs');
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  
  if (fs.existsSync(dashboardPath)) {
    res.json({
      status: 'success',
      message: 'Dashboard file exists and should be accessible',
      path: dashboardPath,
      accessUrls: [
        `${req.protocol}://${req.get('host')}/dashboard`,
        `${req.protocol}://${req.get('host')}/nps-dashboard`
      ],
      fileSize: fs.statSync(dashboardPath).size + ' bytes'
    });
  } else {
    res.json({
      status: 'error',
      message: 'Dashboard file not found',
      expectedPath: dashboardPath,
      publicDir: path.join(__dirname, 'public'),
      publicFiles: fs.readdirSync(path.join(__dirname, 'public'))
    });
  }
});

// Catch-all route (must be last)
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

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`✅ Server running on ${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`💾 Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`);
  console.log(`🔐 Auth: ${process.env.JWT_SECRET ? 'Enabled' : 'Disabled'}`);
  console.log(`🚀 Application ready to serve requests`);
  
  // Check dashboard file on startup
  const fs = require('fs');
  const dashboardPath = path.join(__dirname, 'public', 'dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    console.log(`📊 Dashboard available at: http://${HOST}:${PORT}/dashboard`);
  } else {
    console.warn(`⚠️ Dashboard file not found: ${dashboardPath}`);
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

module.exports = app;