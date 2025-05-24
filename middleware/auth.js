const jwt = require('jsonwebtoken');

// Safe database function imports
let findSessionByToken, findUserById;

try {
  const database = require('../utils/database');
  findSessionByToken = database.findSessionByToken;
  findUserById = database.findUserById;
  console.log('✅ Database functions loaded for auth middleware');
} catch (error) {
  console.warn('⚠️ Database module not available, using fallback auth');
  
  // Fallback functions
  findSessionByToken = async () => null;
  findUserById = async () => null;
}

/**
 * Middleware to authenticate users using JWT tokens
 */
async function authenticateToken(req, res, next) {
  try {
    // Check if JWT_SECRET is configured
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        error: 'Authentication not configured',
        message: 'JWT_SECRET environment variable not set',
        suggestion: 'Contact administrator to configure authentication'
      });
    }

    // Get token from Authorization header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        error: 'Access token required',
        message: 'Please log in to access this resource',
        redirectUrl: '/login'
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Token expired',
          message: 'Your session has expired. Please log in again.',
          redirectUrl: '/login'
        });
      }
      
      return res.status(401).json({
        error: 'Invalid token',
        message: 'Please log in again',
        redirectUrl: '/login'
      });
    }
    
    // Try to get user from database session
    let user = null;
    
    if (findSessionByToken && decoded.sessionToken) {
      try {
        const session = await findSessionByToken(decoded.sessionToken);
        
        if (session) {
          user = {
            id: session.user_id,
            email: session.email,
            firstName: session.first_name,
            lastName: session.last_name,
            company: session.company,
            industry: session.industry
          };
        }
      } catch (dbError) {
        console.warn('Database session check failed:', dbError.message);
        // Continue with token-only validation
      }
    }
    
    // Fallback to JWT data if no database session
    if (!user) {
      user = {
        id: decoded.userId,
        email: decoded.email || 'user@example.com',
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        company: decoded.company,
        industry: decoded.industry
      };
    }

    req.user = user;
    next();
    
  } catch (error) {
    console.error('Authentication error:', error);
    
    return res.status(500).json({
      error: 'Authentication failed',
      message: 'Internal server error during authentication'
    });
  }
}

/**
 * Optional authentication middleware
 * Sets req.user if token is valid, but doesn't block requests
 */
async function optionalAuth(req, res, next) {
  try {
    // Skip if no JWT_SECRET
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

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Try database first
      let user = null;
      
      if (findSessionByToken && decoded.sessionToken) {
        try {
          const session = await findSessionByToken(decoded.sessionToken);
          
          if (session) {
            user = {
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
        }
      }
      
      // Fallback to JWT data
      if (!user) {
        user = {
          id: decoded.userId,
          email: decoded.email || 'user@example.com',
          firstName: decoded.firstName,
          lastName: decoded.lastName,
          company: decoded.company,
          industry: decoded.industry
        };
      }
      
      req.user = user;
    } catch (jwtError) {
      // Invalid token, continue without user
      req.user = null;
    }
    
    next();
  } catch (error) {
    // In optional auth, always continue
    console.warn('Optional auth error:', error.message);
    req.user = null;
    next();
  }
}

/**
 * Rate limiting for auth endpoints
 */
const loginAttempts = new Map();

function rateLimitAuth(req, res, next) {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10; // Increased for development

  if (!loginAttempts.has(clientId)) {
    loginAttempts.set(clientId, []);
  }

  const attempts = loginAttempts.get(clientId);
  
  // Remove old attempts
  const validAttempts = attempts.filter(time => now - time < windowMs);
  loginAttempts.set(clientId, validAttempts);

  if (validAttempts.length >= maxAttempts) {
    return res.status(429).json({
      error: 'Too many attempts',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil((validAttempts[0] + windowMs - now) / 1000)
    });
  }

  // Add current attempt
  validAttempts.push(now);
  loginAttempts.set(clientId, validAttempts);

  next();
}

/**
 * Require specific roles (placeholder for future use)
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
    // TODO: Implement role-based access control
    next();
  };
}

/**
 * Get user from token without requiring authentication
 */
async function getUserFromToken(req, res, next) {
  try {
    req.user = null;
    
    if (!process.env.JWT_SECRET) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      if (findUserById) {
        try {
          const user = await findUserById(decoded.userId);
          req.user = user || {
            id: decoded.userId,
            email: decoded.email || 'user@example.com'
          };
        } catch (dbError) {
          req.user = {
            id: decoded.userId,
            email: decoded.email || 'user@example.com'
          };
        }
      } else {
        req.user = {
          id: decoded.userId,
          email: decoded.email || 'user@example.com'
        };
      }
    } catch (jwtError) {
      // Token invalid, continue without user
      req.user = null;
    }
    
    next();
  } catch (error) {
    console.warn('getUserFromToken error:', error.message);
    req.user = null;
    next();
  }
}

// Clean up old login attempts periodically
setInterval(() => {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  
  for (const [clientId, attempts] of loginAttempts.entries()) {
    const validAttempts = attempts.filter(time => now - time < windowMs);
    if (validAttempts.length === 0) {
      loginAttempts.delete(clientId);
    } else {
      loginAttempts.set(clientId, validAttempts);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

module.exports = {
  authenticateToken,
  optionalAuth,
  requireRoles,
  rateLimitAuth,
  getUserFromToken
};