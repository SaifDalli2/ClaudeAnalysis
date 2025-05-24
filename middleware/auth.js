const jwt = require('jsonwebtoken');

// Mock database functions if database module is not available
let findSessionByToken, findUserById;

try {
  const database = require('../utils/database');
  findSessionByToken = database.findSessionByToken;
  findUserById = database.findUserById;
} catch (error) {
  console.warn('Database module not available, using mock functions');
  
  // Mock functions for when database is not available
  findSessionByToken = async (token) => {
    // In production, you'd want to properly handle this
    return null;
  };
  
  findUserById = async (userId) => {
    // In production, you'd want to properly handle this
    return null;
  };
}

/**
 * Middleware to authenticate users using JWT tokens
 */
async function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please log in to access this page',
        redirectUrl: '/login'
      });
    }

    // Check if JWT_SECRET is available
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET not configured');
      return res.status(500).json({
        error: 'Authentication system not configured',
        message: 'Please contact support'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if session still exists in database (if database is available)
    let user = null;
    
    if (findSessionByToken) {
      try {
        const session = await findSessionByToken(decoded.sessionToken);
        
        if (!session) {
          return res.status(401).json({
            error: 'Invalid session',
            message: 'Your session has expired. Please log in again.',
            redirectUrl: '/login'
          });
        }

        // Add user information to request object
        user = {
          id: session.user_id,
          email: session.email,
          firstName: session.first_name,
          lastName: session.last_name,
          company: session.company,
          industry: session.industry
        };
      } catch (dbError) {
        console.warn('Database session check failed:', dbError.message);
        // Continue with token-only validation
        user = {
          id: decoded.userId,
          email: decoded.email || 'user@example.com'
        };
      }
    } else {
      // Fallback: Use data from JWT token directly
      user = {
        id: decoded.userId,
        email: decoded.email || 'user@example.com'
      };
    }

    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please log in again',
        redirectUrl: '/login'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Your session has expired. Please log in again.',
        redirectUrl: '/login'
      });
    }

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
    
    if (token && process.env.JWT_SECRET) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (findSessionByToken) {
          try {
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
          } catch (dbError) {
            console.warn('Optional auth database check failed:', dbError.message);
            // Continue without user info
          }
        } else {
          // Fallback: Use data from JWT token directly
          req.user = {
            id: decoded.userId,
            email: decoded.email || 'user@example.com'
          };
        }
      } catch (jwtError) {
        // Token is invalid, continue without user info
        console.warn('Optional auth JWT verification failed:', jwtError.message);
      }
    }
    
    next();
  } catch (error) {
    // In optional auth, we just continue without user info if there's an error
    console.warn('Optional auth error:', error.message);
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
        message: 'Please log in to access this resource',
        redirectUrl: '/login'
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
    
    if (!token || !process.env.JWT_SECRET) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (findUserById) {
      try {
        const user = await findUserById(decoded.userId);
        req.user = user || null;
      } catch (dbError) {
        console.warn('getUserFromToken database error:', dbError.message);
        req.user = null;
      }
    } else {
      req.user = {
        id: decoded.userId,
        email: decoded.email || 'user@example.com'
      };
    }
    
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