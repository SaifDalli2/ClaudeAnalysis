// routes/industry.js
const express = require('express');
const router = express.Router();
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  getCategoriesForIndustry,
  getNpsFactorsForIndustry,
  getAvailableIndustries,
  updateIndustryConfig,
  validateIndustryConfig,
  getCategorySuggestions
} = require('../services/industry-categories');

/**
 * Get available industries
 */
router.get('/industries', (req, res) => {
  try {
    const industries = getAvailableIndustries();
    res.json({
      industries: industries.map(industry => ({
        name: industry,
        displayName: industry,
        code: industry.toLowerCase().replace(/[^a-z0-9]/g, '-')
      })),
      count: industries.length
    });
  } catch (error) {
    console.error('Error getting industries:', error);
    res.status(500).json({
      error: 'Failed to get industries',
      message: 'Internal server error'
    });
  }
});

/**
 * Get categories for a specific industry
 */
router.get('/industries/:industry/categories', optionalAuth, async (req, res) => {
  try {
    const { industry } = req.params;
    
    // If user is authenticated and has an industry, use that as default
    const targetIndustry = industry || req.user?.industry || 'Default';
    
    const categories = await getCategoriesForIndustry(targetIndustry);
    
    res.json({
      industry: targetIndustry,
      categories: categories,
      count: categories.length,
      userIndustry: req.user?.industry || null
    });
    
  } catch (error) {
    console.error('Error getting categories:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: 'Internal server error'
    });
  }
});

/**
 * Get NPS factors for a specific industry
 */
router.get('/industries/:industry/factors', optionalAuth, async (req, res) => {
  try {
    const { industry } = req.params;
    
    // If user is authenticated and has an industry, use that as default
    const targetIndustry = industry || req.user?.industry || 'Default';
    
    const factors = await getNpsFactorsForIndustry(targetIndustry);
    
    res.json({
      industry: targetIndustry,
      npsFactors: factors,
      count: factors.length,
      userIndustry: req.user?.industry || null
    });
    
  } catch (error) {
    console.error('Error getting NPS factors:', error);
    res.status(500).json({
      error: 'Failed to get NPS factors',
      message: 'Internal server error'
    });
  }
});

/**
 * Get both categories and factors for an industry
 */
router.get('/industries/:industry/config', optionalAuth, async (req, res) => {
  try {
    const { industry } = req.params;
    
    // If user is authenticated and has an industry, use that as default
    const targetIndustry = industry || req.user?.industry || 'Default';
    
    const [categories, factors] = await Promise.all([
      getCategoriesForIndustry(targetIndustry),
      getNpsFactorsForIndustry(targetIndustry)
    ]);
    
    res.json({
      industry: targetIndustry,
      categories: categories,
      npsFactors: factors,
      categoriesCount: categories.length,
      factorsCount: factors.length,
      userIndustry: req.user?.industry || null,
      isUserIndustry: req.user?.industry === targetIndustry
    });
    
  } catch (error) {
    console.error('Error getting industry config:', error);
    res.status(500).json({
      error: 'Failed to get industry configuration',
      message: 'Internal server error'
    });
  }
});

/**
 * Get categories for current user's industry (authenticated endpoint)
 */
router.get('/my-categories', authenticateToken, async (req, res) => {
  try {
    const userIndustry = req.user.industry || 'Default';
    const categories = await getCategoriesForIndustry(userIndustry);
    
    res.json({
      industry: userIndustry,
      categories: categories,
      count: categories.length,
      message: userIndustry === 'Default' 
        ? 'Using default categories. Update your profile to get industry-specific categories.'
        : `Using ${userIndustry} industry categories`
    });
    
  } catch (error) {
    console.error('Error getting user categories:', error);
    res.status(500).json({
      error: 'Failed to get categories',
      message: 'Internal server error'
    });
  }
});

/**
 * Get NPS factors for current user's industry (authenticated endpoint)
 */
router.get('/my-factors', authenticateToken, async (req, res) => {
  try {
    const userIndustry = req.user.industry || 'Default';
    const factors = await getNpsFactorsForIndustry(userIndustry);
    
    res.json({
      industry: userIndustry,
      npsFactors: factors,
      count: factors.length,
      message: userIndustry === 'Default' 
        ? 'Using default factors. Update your profile to get industry-specific factors.'
        : `Using ${userIndustry} industry factors`
    });
    
  } catch (error) {
    console.error('Error getting user factors:', error);
    res.status(500).json({
      error: 'Failed to get NPS factors',
      message: 'Internal server error'
    });
  }
});

/**
 * Update industry configuration (admin endpoint)
 */
router.put('/industries/:industry/config', authenticateToken, async (req, res) => {
  try {
    const { industry } = req.params;
    const { categories, npsFactors } = req.body;
    
    // Validate the configuration
    const validation = validateIndustryConfig({ categories, npsFactors });
    
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid configuration',
        details: validation.errors,
        message: 'Please check your categories and NPS factors'
      });
    }
    
    // Update the configuration
    const success = await updateIndustryConfig(industry, { categories, npsFactors });
    
    if (success) {
      res.json({
        message: `Industry configuration updated for ${industry}`,
        industry: industry,
        categoriesCount: categories.length,
        factorsCount: npsFactors.length
      });
    } else {
      res.status(500).json({
        error: 'Failed to update configuration',
        message: 'Internal server error'
      });
    }
    
  } catch (error) {
    console.error('Error updating industry config:', error);
    res.status(500).json({
      error: 'Failed to update industry configuration',
      message: 'Internal server error'
    });
  }
});

/**
 * Get category suggestions based on partial input
 */
router.get('/industries/:industry/categories/suggest', optionalAuth, async (req, res) => {
  try {
    const { industry } = req.params;
    const { q: query } = req.query;
    
    if (!query || query.trim().length === 0) {
      return res.json({
        suggestions: [],
        message: 'Please provide a search query'
      });
    }
    
    if (query.length < 2) {
      return res.json({
        suggestions: [],
        message: 'Query must be at least 2 characters'
      });
    }
    
    const targetIndustry = industry || req.user?.industry || 'Default';
    const suggestions = await getCategorySuggestions(targetIndustry, query);
    
    res.json({
      query: query,
      industry: targetIndustry,
      suggestions: suggestions,
      count: suggestions.length
    });
    
  } catch (error) {
    console.error('Error getting category suggestions:', error);
    res.status(500).json({
      error: 'Failed to get suggestions',
      message: 'Internal server error'
    });
  }
});

/**
 * Validate industry configuration
 */
router.post('/industries/validate-config', (req, res) => {
  try {
    const { categories, npsFactors } = req.body;
    
    const validation = validateIndustryConfig({ categories, npsFactors });
    
    res.json({
      valid: validation.valid,
      errors: validation.errors,
      categoriesCount: categories ? categories.length : 0,
      factorsCount: npsFactors ? npsFactors.length : 0
    });
    
  } catch (error) {
    console.error('Error validating config:', error);
    res.status(500).json({
      error: 'Failed to validate configuration',
      message: 'Internal server error'
    });
  }
});

/**
 * Get industry statistics
 */
router.get('/industries/stats', (req, res) => {
  try {
    const industries = getAvailableIndustries();
    
    const stats = {
      totalIndustries: industries.length,
      industries: industries.map(industry => ({
        name: industry,
        categoriesCount: 0, // This would be populated from database
        factorsCount: 0,    // This would be populated from database
        usersCount: 0       // This would be populated from database
      }))
    };
    
    res.json(stats);
    
  } catch (error) {
    console.error('Error getting industry stats:', error);
    res.status(500).json({
      error: 'Failed to get industry statistics',
      message: 'Internal server error'
    });
  }
});

module.exports = router;