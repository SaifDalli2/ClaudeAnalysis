const express = require('express');
const router = express.Router();
const { processCommentsLegacy } = require('../services/claude-legacy');
const { validateApiKey } = require('../utils/validation');

// Legacy Claude API endpoint (kept for backward compatibility)
router.post('/claude', async (req, res) => {
  try {
    const { comments, apiKey } = req.body;
    
    const apiKeyValidation = validateApiKey(apiKey);
    if (!apiKeyValidation.valid) {
      return res.status(400).json(apiKeyValidation.error);
    }
    
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: 'Comments must be provided as a non-empty array' 
      });
    }
    
    const result = await processCommentsLegacy(comments, apiKey);
    res.json(result);
    
  } catch (error) {
    console.error('Error in legacy Claude endpoint:', error);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    
    res.status(500).json({
      error: 'Failed to process with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

module.exports = router;