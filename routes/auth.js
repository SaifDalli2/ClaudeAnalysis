const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();

const { 
  createUser, 
  findUserByEmail, 
  findUserById,
  updateUser,
  createSession, 
  deleteSession,
  getAllIndustryConfigs 
} = require('../utils/database');

const { authenticateToken, rateLimitAuth } = require('../middleware/auth');

/**
 * Register new user
 */
router.post('/register', rateLimitAuth, async (req, res) => {
  try {
    const { email, password, firstName, lastName, company, industry } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Email and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password too short',
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(email.toLowerCase());
    if (existingUser) {
      return res.status(409).json({
        error: 'User already exists',
        message: 'An account with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const newUser = await createUser({
      email: email.toLowerCase(),
      passwordHash,
      firstName: firstName || null,
      lastName: lastName || null,
      company: company || null,
      industry: industry || null
    });

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await createSession(newUser.id, sessionToken, expiresAt);

    // Create JWT
    const jwtToken = jwt.sign(
      { 
        userId: newUser.id, 
        sessionToken: sessionToken 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove sensitive data before sending response
    delete newUser.password_hash;

    res.status(201).json({
      message: 'User registered successfully',
      user: newUser,
      token: jwtToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Registration failed',
      message: 'Internal server error during registration'
    });
  }
});

/**
 * Login user
 */
router.post('/login', rateLimitAuth, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Missing credentials',
        message: 'Email and password are required'
      });
    }

    // Find user
    const user = await findUserByEmail(email.toLowerCase());
    if (!user) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Invalid credentials',
        message: 'Invalid email or password'
      });
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await createSession(user.id, sessionToken, expiresAt);

    // Create JWT
    const jwtToken = jwt.sign(
      { 
        userId: user.id, 
        sessionToken: sessionToken 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Remove sensitive data
    delete user.password_hash;

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        company: user.company,
        industry: user.industry
      },
      token: jwtToken,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed',
      message: 'Internal server error during login'
    });
  }
});

/**
 * Logout user
 */
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Extract session token from JWT
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await deleteSession(decoded.sessionToken);
    }

    res.json({
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed',
      message: 'Internal server error during logout'
    });
  }
});

/**
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    res.json({
      user: req.user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Failed to get profile',
      message: 'Internal server error'
    });
  }
});

/**
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, company, industry } = req.body;

    const updatedUser = await updateUser(req.user.id, {
      firstName,
      lastName,
      company,
      industry
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        company: updatedUser.company,
        industry: updatedUser.industry
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile',
      message: 'Internal server error'
    });
  }
});

/**
 * Get available industries
 */
router.get('/industries', async (req, res) => {
  try {
    const industries = await getAllIndustryConfigs();
    
    res.json({
      industries: industries.map(industry => ({
        name: industry.industry_name,
        categories: industry.categories,
        npsFactors: industry.nps_factors
      }))
    });

  } catch (error) {
    console.error('Get industries error:', error);
    res.status(500).json({
      error: 'Failed to get industries',
      message: 'Internal server error'
    });
  }
});

/**
 * Verify token (for frontend to check if user is still logged in)
 */
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

module.exports = router;