const express = require('express');
const router = express.Router();

const { 
  startCategorization, 
  getJobStatus, 
  getJobResults, 
  cancelJob 
} = require('../services/categorization');

const { summarizeComments, testCategorization } = require('../services/summary');
const { validateApiKey, validateComments } = require('../utils/validation');

// Start categorization job
router.post('/categorize', async (req, res) => {
  try {
    const { comments, apiKey } = req.body;
    
    // Enhanced validation
    const apiKeyValidation = validateApiKey(apiKey);
    if (!apiKeyValidation.valid) {
      return res.status(400).json(apiKeyValidation.error);
    }
    
    const commentsValidation = validateComments(comments);
    if (!commentsValidation.valid) {
      return res.status(400).json(commentsValidation.error);
    }

    // Warn for very large datasets
    if (comments.length > 3000) {
      console.warn(`Large dataset detected: ${comments.length} comments. This may take a very long time to process.`);
    }

    const result = await startCategorization(comments, apiKey);
    res.json(result);
    
  } catch (error) {
    console.error('Error starting categorization job:', error);
    res.status(500).json({
      error: 'Failed to start categorization job',
      details: error.message,
      suggestion: 'Please try again with a smaller dataset or check your API key.'
    });
  }
});

// Get job status
router.get('/categorize/:jobId/status', (req, res) => {
  try {
    const result = getJobStatus(req.params.jobId);
    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        details: 'The specified job ID does not exist or has expired.'
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({
      error: 'Failed to get job status',
      details: error.message
    });
  }
});

// Get job results
router.get('/categorize/:jobId/results', (req, res) => {
  try {
    const result = getJobResults(req.params.jobId);
    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        details: 'The specified job ID does not exist or has expired.'
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error getting job results:', error);
    res.status(500).json({
      error: 'Failed to get job results',
      details: error.message
    });
  }
});

// Cancel job
router.post('/categorize/:jobId/cancel', (req, res) => {
  try {
    const result = cancelJob(req.params.jobId);
    if (!result) {
      return res.status(404).json({
        error: 'Job not found',
        details: 'The specified job ID does not exist or has expired.'
      });
    }
    res.json(result);
  } catch (error) {
    console.error('Error cancelling job:', error);
    res.status(500).json({
      error: 'Failed to cancel job',
      details: error.message
    });
  }
});

// Summarize categorized comments
router.post('/summarize', async (req, res) => {
  try {
    const { categorizedComments, extractedTopics, apiKey } = req.body;
    
    const apiKeyValidation = validateApiKey(apiKey);
    if (!apiKeyValidation.valid) {
      return res.status(400).json(apiKeyValidation.error);
    }
    
    if (!categorizedComments || !Array.isArray(categorizedComments)) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: 'Categorized comments must be provided as an array' 
      });
    }
    
    const result = await summarizeComments(categorizedComments, extractedTopics, apiKey);
    res.json(result);
    
  } catch (error) {
    console.error('Error summarizing comments:', error);
    res.status(500).json({
      error: 'Failed to summarize with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Test categorization endpoint
router.post('/test-categorize', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    const apiKeyValidation = validateApiKey(apiKey);
    if (!apiKeyValidation.valid) {
      return res.status(400).json(apiKeyValidation.error);
    }
    
    const result = await testCategorization(apiKey);
    res.json(result);
    
  } catch (error) {
    console.error('Test categorization error:', error);
    res.status(500).json({
      status: 'ERROR',
      error: 'Test failed',
      details: error.response?.data?.error || error.message,
      recommendation: 'Check your API key and internet connection. Review server logs for more details.'
    });
  }
});

module.exports = router;