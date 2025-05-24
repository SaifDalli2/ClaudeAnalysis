const jwt = require('jsonwebtoken');
const { findSessionByToken, findUserById } = require('../utils/database');

/**
 * Middleware to authenticate users using JWT tokens
 */
async function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header or cookies
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please provide a valid authentication token'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session still exists in database
    const session = await findSessionByToken(decoded.sessionToken);
    
    if (!session) {
      return res.status(401).json({
        error: 'Invalid session',
        message: 'Session has expired or is invalid'
      });
    }

    // Add user information to request object
    req.user = {
      id: session.user_id,
      email: session.email,
      firstName: session.first_name,
      lastName: session.last_name,
      company: session.company,
      industry: session.industry
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'The provided token is invalid'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'The provided token has expired'
      });
    }

    console.error('Authentication error:', error);
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't block unauthenticated requests
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const session = await findSessionByToken(decoded.sessionToken);
      
      if (session) {
        req.user = {
          id: session.user_id,
          email: session.email,
          firstName: session.first_name,
          lastName: session.last_name,
          company: session.company,
          industry: session.industry
        };
      }
    }
    
    next();
  } catch (error) {
    // In optional auth, we just continue without user info if there's an error
    next();
  }
}

/**
 * Middleware to check if user has specific permissions
 * @param {Array} requiredRoles - Array of required roles
 */
function requireRoles(requiredRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      });
    }

    // For now, all authenticated users have access
    // In the future, you can add role checking here
    next();
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
const loginAttempts = new Map();

function rateLimitAuth(req, res, next) {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 5;

  if (!loginAttempts.has(clientId)) {
    loginAttempts.set(clientId, []);
  }

  const attempts = loginAttempts.get(clientId);
  
  // Remove old attempts outside the window
  const validAttempts = attempts.filter(time => now - time < windowMs);
  loginAttempts.set(clientId, validAttempts);

  if (validAttempts.length >= maxAttempts) {
    return res.status(429).json({
      error: 'Too many attempts',
      message: 'Too many login attempts. Please try again later.',
      retryAfter: Math.ceil((validAttempts[0] + windowMs - now) / 1000)
    });
  }

  // Add current attempt
  validAttempts.push(now);
  loginAttempts.set(clientId, validAttempts);

  next();
}

/**
 * Middleware to extract user info from token without requiring authentication
 */
async function getUserFromToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await findUserById(decoded.userId);
    
    req.user = user || null;
    next();
  } catch (error) {
    req.user = null;
    next();
  }
}

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRoles,
  rateLimitAuth,
  getUserFromToken
};