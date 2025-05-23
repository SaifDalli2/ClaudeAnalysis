/**
 * Detect language of comments
 * @param {Array<string>} comments - Array of comment strings
 * @returns {string} Detected language code ('ar' or 'en')
 */
function detectLanguage(comments) {
  const arabicPattern = /[\u0600-\u06FF]/;
  let arabicCount = 0;
  
  for (const comment of comments) {
    if (arabicPattern.test(comment)) {
      arabicCount++;
    }
  }
  
  // If more than 50% of comments contain Arabic characters, treat as Arabic
  return (arabicCount / comments.length > 0.5) ? 'ar' : 'en';
}

/**
 * Create a delay (Promise-based timeout)
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after the delay
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate unique job ID
 * @returns {string} Unique job identifier
 */
function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Clean JSON string for parsing
 * @param {string} jsonString - JSON string to clean
 * @returns {string} Cleaned JSON string
 */
function cleanJsonString(jsonString) {
  return jsonString
    .replace(/\\"/g, '"')      // Fix escaped quotes
    .replace(/\\n/g, ' ')      // Replace newlines with spaces
    .replace(/\\/g, '\\\\')    // Escape backslashes
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
    .replace(/,\s*}/g, '}')    // Remove trailing commas
    .replace(/,\s*]/g, ']')    // Remove trailing commas in arrays
    .replace(/[\u0600-\u06FF]+/g, function(match) {
      // Keep Arabic text but make sure it's properly escaped
      return match;
    })
    .replace(/…/g, '...')      // Replace ellipsis
    .replace(/[^\x00-\x7F]+:/g, function(match) {
      // Fix non-ASCII characters in property names
      const cleanKey = match.replace(/[^\x00-\x7F]/g, '').replace(/:/g, '');
      return `"${cleanKey}":`;
    });
}

/**
 * Fix broken JSON string
 * @param {string} jsonString - Broken JSON string
 * @returns {string} Fixed JSON string
 */
function fixJsonString(jsonString) {
  // Check for balanced braces
  const openBraces = (jsonString.match(/{/g) || []).length;
  const closeBraces = (jsonString.match(/}/g) || []).length;
  
  let fixedString = jsonString;
  
  // If unbalanced, try to complete the JSON
  if (openBraces > closeBraces) {
    const missingBraces = openBraces - closeBraces;
    fixedString += '}'.repeat(missingBraces);
  }
  
  // Check for balanced square brackets
  const openBrackets = (fixedString.match(/\[/g) || []).length;
  const closeBrackets = (fixedString.match(/\]/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    const missingBrackets = openBrackets - closeBrackets;
    fixedString += ']'.repeat(missingBrackets);
  }
  
  // Replace problematic characters in property values
  fixedString = fixedString
    .replace(/:\s*([^",\{\[\}\]]+)(\s*[,\}\]])/g, function(match, value, ending) {
      // If value doesn't start with a quote and isn't a number, boolean, or null, wrap it in quotes
      const trimmedValue = value.trim();
      if (!trimmedValue.match(/^(true|false|null|\d+|\d+\.\d+)$/)) {
        return ': "' + trimmedValue + '"' + ending;
      }
      return match;
    });
  
  return fixedString;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Format file size to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Sanitize input to prevent injection attacks
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
}

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }
  return obj;
}

/**
 * Rate limiter utility
 */
class RateLimiter {
  constructor(maxRequests = 100, windowMs = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.requests = new Map();
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const userRequests = this.requests.get(identifier);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart);
    this.requests.set(identifier, validRequests);
    
    // Check if under limit
    if (validRequests.length < this.maxRequests) {
      validRequests.push(now);
      return true;
    }
    
    return false;
  }

  getRemainingRequests(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      return this.maxRequests;
    }
    
    const userRequests = this.requests.get(identifier);
    const validRequests = userRequests.filter(time => time > windowStart);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }
}

module.exports = {
  detectLanguage,
  delay,
  generateJobId,
  cleanJsonString,
  fixJsonString,
  escapeHtml,
  formatFileSize,
  sanitizeInput,
  deepClone,
  RateLimiter
};