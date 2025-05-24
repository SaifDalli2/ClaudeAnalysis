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

// Start categorization job with industry-specific categories
router.post('/categorize', async (req, res) => {
  try {
    const { comments, apiKey, industry } = req.body;
    
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

    // Get user information and industry
    let userInfo = null;
    let selectedIndustry = industry;
    let userEmail = null;
    
    // Check if request has authentication
    const authHeader = req.headers['authorization'];
    if (authHeader) {
      try {
        const { authenticateToken } = require('../middleware/auth');
        // Create a mock request object for authentication
        const mockReq = { headers: req.headers };
        let authenticated = false;
        
        await new Promise((resolve) => {
          authenticateToken(mockReq, {
            status: () => ({ json: () => {} }),
            json: () => {}
          }, () => {
            authenticated = true;
            userInfo = mockReq.user;
            resolve();
          });
        }).catch(() => {
          // Authentication failed, continue without user info
        });
        
        if (authenticated && userInfo) {
          userEmail = userInfo.email;
          console.log(`Processing request for authenticated user: ${userEmail}`);
          
          // Use user's industry if not explicitly provided
          if (!selectedIndustry && userInfo.industry) {
            selectedIndustry = userInfo.industry;
            console.log(`Using user's industry: ${selectedIndustry}`);
          }
        }
      } catch (authError) {
        console.log('Authentication check failed, proceeding without user context');
      }
    }

    // Load industry-specific categories
    let industryCategories = null;
    if (selectedIndustry) {
      try {
        const { getCategoriesForIndustry } = require('../services/industry-categories');
        industryCategories = await getCategoriesForIndustry(selectedIndustry);
        
        if (industryCategories && industryCategories.length > 0) {
          console.log(`✅ Loaded ${industryCategories.length} categories for ${selectedIndustry} industry`);
        } else {
          console.log(`⚠️ No categories found for: ${selectedIndustry}, using default categories`);
          selectedIndustry = 'Default';
        }
      } catch (industryError) {
        console.error('Failed to load industry categories:', industryError);
        selectedIndustry = 'Default';
      }
    } else {
      selectedIndustry = 'Default';
      console.log('No industry specified, using default categories');
    }

    // Start categorization with enhanced industry context
    const result = await startCategorization(comments, apiKey, {
      industry: selectedIndustry,
      categories: industryCategories,
      userId: userInfo?.id,
      userEmail: userEmail
    });
    
    // Add industry information to response
    result.industry = selectedIndustry;
    result.categoriesUsed = industryCategories ? industryCategories.length : 'default';
    result.userIndustry = userInfo?.industry || null;
    result.isUserIndustry = userInfo?.industry === selectedIndustry;
    
    // Add helpful messaging
    if (selectedIndustry === 'Default') {
      result.message = 'Using general categories. Set your industry in your profile for specialized categorization.';
    } else {
      result.message = `Using ${selectedIndustry} industry-specific categories for enhanced accuracy.`;
    }
    
    console.log(`🚀 Categorization job started for ${selectedIndustry} industry with ${result.totalComments} comments`);
    
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
    
    // Log results being returned
    console.log(`Returning results for job ${req.params.jobId}: ${result.categorizedComments.length} comments, status: ${result.status}`);
    
    res.json(result);
  } catch (error) {
    // If job not completed but we want to try returning partial results
    if (error.message.includes('Job not completed yet')) {
      try {
        const jobStatus = getJobStatus(req.params.jobId);
        if (jobStatus && jobStatus.hasPartialResults) {
          console.log(`Returning partial results for incomplete job ${req.params.jobId}: ${jobStatus.partialResultsCount} comments`);
          return res.json({
            categorizedComments: jobStatus.categorizedComments || [],
            extractedTopics: jobStatus.extractedTopics || [],
            status: 'partial',
            processedComments: jobStatus.processedComments || 0,
            totalComments: jobStatus.totalComments || 0,
            error: 'Job still processing, returning partial results',
            isPartial: true
          });
        }
      } catch (partialError) {
        console.error('Error getting partial results:', partialError);
      }
    }
    
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

// Debug endpoint to inspect job state directly
router.get('/debug/job/:jobId', (req, res) => {
  const { processingJobs } = require('../services/categorization');
  const job = processingJobs.get(req.params.jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  // Return raw job data for debugging
  res.json({
    jobId: req.params.jobId,
    rawJobData: {
      status: job.status,
      categorizedComments: job.categorizedComments ? job.categorizedComments.length : 0,
      extractedTopics: job.extractedTopics ? job.extractedTopics.length : 0,
      processedComments: job.processedComments,
      totalComments: job.totalComments,
      error: job.error,
      hasResults: !!(job.categorizedComments && job.categorizedComments.length > 0)
    },
    // Include first few results for verification
    sampleResults: job.categorizedComments ? job.categorizedComments.slice(0, 3) : []
  });
});

module.exports = router;