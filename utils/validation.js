const { sanitizeInput } = require('./helpers');

/**
 * Validate API key
 * @param {string} apiKey - API key to validate
 * @returns {Object} Validation result
 */
function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 10) {
    return {
      valid: false,
      error: {
        error: 'Invalid API key',
        details: 'A valid Claude API key must be provided. The key should be at least 10 characters long.',
        suggestion: 'Get your API key from the Claude console at https://console.anthropic.com/'
      }
    };
  }

  // Basic format validation for Claude API keys
  const sanitizedKey = sanitizeInput(apiKey.trim());
  if (sanitizedKey !== apiKey.trim()) {
    return {
      valid: false,
      error: {
        error: 'Invalid API key format',
        details: 'API key contains invalid characters.',
        suggestion: 'Ensure you copied the API key correctly from the Claude console.'
      }
    };
  }

  return { valid: true };
}

/**
 * Validate comments array
 * @param {Array} comments - Comments to validate
 * @returns {Object} Validation result
 */
function validateComments(comments) {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return {
      valid: false,
      error: {
        error: 'Invalid request',
        details: 'Comments must be provided as a non-empty array',
        received: typeof comments
      }
    };
  }

  // Check for reasonable array size
  if (comments.length > 10000) {
    return {
      valid: false,
      error: {
        error: 'Too many comments',
        details: `Maximum 10,000 comments allowed. Received: ${comments.length}`,
        suggestion: 'Split your comments into smaller batches for processing.'
      }
    };
  }

  // Validate individual comments
  const invalidComments = [];
  const sanitizedComments = comments.map((comment, index) => {
    if (typeof comment !== 'string') {
      invalidComments.push(index);
      return '';
    }

    const sanitized = sanitizeInput(comment.trim());
    if (sanitized.length === 0) {
      invalidComments.push(index);
      return '';
    }

    if (sanitized.length > 5000) {
      invalidComments.push(index);
      return sanitized.substring(0, 5000);
    }

    return sanitized;
  });

  if (invalidComments.length > comments.length * 0.5) {
    return {
      valid: false,
      error: {
        error: 'Too many invalid comments',
        details: `${invalidComments.length} out of ${comments.length} comments are invalid or empty`,
        suggestion: 'Ensure comments are non-empty strings with reasonable length.'
      }
    };
  }

  return { 
    valid: true, 
    sanitizedComments: sanitizedComments.filter(comment => comment.length > 0)
  };
}

/**
 * Validate categorized comments for summarization
 * @param {Array} categorizedComments - Categorized comments to validate
 * @returns {Object} Validation result
 */
function validateCategorizedComments(categorizedComments) {
  if (!categorizedComments || !Array.isArray(categorizedComments)) {
    return {
      valid: false,
      error: {
        error: 'Invalid categorized comments',
        details: 'Categorized comments must be provided as an array',
        received: typeof categorizedComments
      }
    };
  }

  if (categorizedComments.length === 0) {
    return {
      valid: false,
      error: {
        error: 'Empty categorized comments',
        details: 'At least one categorized comment is required for summarization',
        suggestion: 'Ensure the categorization process completed successfully.'
      }
    };
  }

  // Validate structure of categorized comments
  const invalidItems = [];
  categorizedComments.forEach((item, index) => {
    if (!item || typeof item !== 'object') {
      invalidItems.push(index);
      return;
    }

    if (!item.id || !item.comment || !item.category) {
      invalidItems.push(index);
      return;
    }

    if (typeof item.comment !== 'string' || typeof item.category !== 'string') {
      invalidItems.push(index);
      return;
    }
  });

  if (invalidItems.length > 0) {
    return {
      valid: false,
      error: {
        error: 'Invalid categorized comment structure',
        details: `${invalidItems.length} items have invalid structure. Each item must have id, comment, and category fields.`,
        suggestion: 'Ensure categorization completed successfully before attempting summarization.'
      }
    };
  }

  return { valid: true };
}

/**
 * Validate job ID format
 * @param {string} jobId - Job ID to validate
 * @returns {Object} Validation result
 */
function validateJobId(jobId) {
  if (!jobId || typeof jobId !== 'string') {
    return {
      valid: false,
      error: {
        error: 'Invalid job ID',
        details: 'Job ID must be a non-empty string',
        received: typeof jobId
      }
    };
  }

  // Check basic format (job_timestamp_randomstring)
  const jobIdPattern = /^job_\d+_[a-zA-Z0-9]+$/;
  if (!jobIdPattern.test(jobId)) {
    return {
      valid: false,
      error: {
        error: 'Invalid job ID format',
        details: 'Job ID format is invalid',
        suggestion: 'Use the job ID returned from the categorization endpoint.'
      }
    };
  }

  return { valid: true };
}

/**
 * Validate request rate limiting
 * @param {string} clientId - Client identifier (IP, user ID, etc.)
 * @param {Object} rateLimiter - Rate limiter instance
 * @returns {Object} Validation result
 */
function validateRateLimit(clientId, rateLimiter) {
  if (!rateLimiter.isAllowed(clientId)) {
    const remaining = rateLimiter.getRemainingRequests(clientId);
    return {
      valid: false,
      error: {
        error: 'Rate limit exceeded',
        details: 'Too many requests. Please wait before making another request.',
        remainingRequests: remaining,
        suggestion: 'Implement delays between requests or reduce request frequency.'
      }
    };
  }

  return { 
    valid: true, 
    remainingRequests: rateLimiter.getRemainingRequests(clientId) 
  };
}

/**
 * Validate request body size
 * @param {Object} req - Express request object
 * @param {number} maxSizeMB - Maximum size in MB
 * @returns {Object} Validation result
 */
function validateRequestSize(req, maxSizeMB = 50) {
  const contentLength = parseInt(req.get('content-length') || '0');
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (contentLength > maxSizeBytes) {
    return {
      valid: false,
      error: {
        error: 'Request too large',
        details: `Request size (${Math.round(contentLength / 1024 / 1024)}MB) exceeds maximum allowed size (${maxSizeMB}MB)`,
        suggestion: 'Reduce the number of comments or split into smaller batches.'
      }
    };
  }

  return { valid: true };
}

/**
 * Validate extracted topics structure
 * @param {Array} extractedTopics - Topics to validate
 * @returns {Object} Validation result
 */
function validateExtractedTopics(extractedTopics) {
  if (!extractedTopics) {
    return { valid: true, topics: [] }; // Topics are optional
  }

  if (!Array.isArray(extractedTopics)) {
    return {
      valid: false,
      error: {
        error: 'Invalid topics format',
        details: 'Extracted topics must be an array',
        received: typeof extractedTopics
      }
    };
  }

  // Validate topic structure
  const validTopics = extractedTopics.filter(topic => {
    return topic && 
           typeof topic === 'object' && 
           typeof topic.topic === 'string' && 
           topic.topic.trim().length > 0;
  });

  return { 
    valid: true, 
    topics: validTopics.slice(0, 100) // Limit to 100 topics
  };
}

module.exports = {
  validateApiKey,
  validateComments,
  validateCategorizedComments,
  validateJobId,
  validateRateLimit,
  validateRequestSize,
  validateExtractedTopics
};