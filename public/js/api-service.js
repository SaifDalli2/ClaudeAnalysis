/**
 * Enhanced API service with robust retry logic and error handling
 * Can be used to update the existing api-service.js file
 */
import { SERVER_URL, API_ENDPOINTS, TIMEOUTS, RETRY } from './config.js';
import { addLogEntry, delay } from './utils.js';

/**
 * Calculates backoff delay with jitter for retry attempts
 * @param {number} attempt - Current attempt number (1-based)
 * @returns {number} - Milliseconds to wait before next attempt
 */
function calculateBackoff(attempt) {
  // Calculate base delay with exponential backoff
  const baseDelay = RETRY.BASE_DELAY * Math.pow(RETRY.BACKOFF_FACTOR, attempt - 1);
  
  // Add random jitter (±JITTER ms)
  const jitter = Math.random() * RETRY.JITTER * 2 - RETRY.JITTER;
  
  return baseDelay + jitter;
}

/**
 * Wrapper for fetch with retry capabilities
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} - Promise resolving to fetch response
 */
async function fetchWithRetry(url, options = {}) {
  let lastError;
  
  for (let attempt = 1; attempt <= RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      // Attempt the fetch
      const response = await fetch(url, options);
      
      // If response is successful or not in the retry status codes, return it
      if (response.ok || !RETRY.STATUS_CODES.includes(response.status)) {
        return response;
      }
      
      // Store error info for retry
      lastError = new Error(`HTTP status ${response.status}`);
      lastError.status = response.status;
      lastError.response = response;
      
      // If this is a 503 or 429, we should retry
      addLogEntry(`Received status ${response.status}, attempt ${attempt}/${RETRY.MAX_ATTEMPTS}`, 'warning');
      
    } catch (error) {
      // Store network error for retry
      lastError = error;
      addLogEntry(`Fetch error: ${error.message}, attempt ${attempt}/${RETRY.MAX_ATTEMPTS}`, 'error');
    }
    
    // If this was the last attempt, throw the error
    if (attempt === RETRY.MAX_ATTEMPTS) {
      break;
    }
    
    // Calculate and wait the backoff time
    const backoffTime = calculateBackoff(attempt);
    addLogEntry(`Retrying in ${(backoffTime/1000).toFixed(1)} seconds...`, 'info');
    await delay(backoffTime);
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Maximum retry attempts reached');
}

/**
 * Attempt to wake up the Heroku server before making API calls
 * @returns {Promise<boolean>} Promise resolving to true if server was awakened
 */
export async function wakeupServer() {
  addLogEntry('Attempting to wake up the server...', 'info');
  
  try {
    // Send wake-up ping with increased timeout
    const response = await fetchWithRetry(`${SERVER_URL}${API_ENDPOINTS.PING}?wakeup=true`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUTS.WAKEUP
    });
    
    if (response.ok) {
      addLogEntry('Server is awake and ready to process requests! ✅', 'success');
      return true;
    } else {
      addLogEntry(`Server wake-up failed with status: ${response.status} ❌`, 'error');
      return false;
    }
  } catch (error) {
    addLogEntry(`Server wake-up error: ${error.message} ❌`, 'error');
    return false;
  }
}

/**
 * Check if the server is available
 * @returns {Promise<boolean>} Promise resolving to server availability
 */
export async function checkServerAvailability() {
  addLogEntry('Checking server availability...', 'info');
  
  try {
    // First try to wake up the server if it's in sleep mode
    const isAwake = await wakeupServer();
    
    if (isAwake) {
      return true;
    }
    
    // If wake-up didn't succeed, try a normal ping
    const pingResponse = await fetchWithRetry(`${SERVER_URL}${API_ENDPOINTS.PING}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (pingResponse.ok) {
      addLogEntry('Server is available! ✅', 'success');
      return true;
    } else {
      addLogEntry(`Server returned status: ${pingResponse.status} ❌`, 'error');
      return false;
    }
  } catch (error) {
    addLogEntry(`Error connecting to server: ${error.message} ❌`, 'error');
    
    // Additional diagnostic information
    addLogEntry(`Server URL: ${SERVER_URL}`, 'info');
    addLogEntry('Trying no-cors mode as fallback...', 'info');
    
    // Try a simpler fetch that might work better for CORS issues
    try {
      await fetch(SERVER_URL, {
        method: 'GET',
        mode: 'no-cors'
      });
      
      addLogEntry('Server responded to no-cors request, may be a CORS issue', 'warning');
    } catch (directError) {
      addLogEntry(`Direct connection also failed: ${directError.message}`, 'error');
    }
    
    return false;
  }
}

/**
 * Categorize a list of comments using the API
 * @param {Array<string>} comments - List of comments to categorize
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} Promise resolving to categorization results
 */
export async function categorizeComments(comments, apiKey) {
  if (!comments || !comments.length) {
    throw new Error('No comments provided');
  }
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  addLogEntry(`Categorizing ${comments.length} comments...`, 'info');
  
  try {
    // Check if server is available first
    const isServerAvailable = await checkServerAvailability();
    if (!isServerAvailable) {
      throw new Error('Server is currently unavailable. Please try again later or use simulation mode.');
    }
    
    const categorizeUrl = `${SERVER_URL}${API_ENDPOINTS.CATEGORIZE}`;
    addLogEntry(`Sending request to: ${categorizeUrl}`, 'info');
    
    const response = await fetchWithRetry(categorizeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        comments: comments,
        apiKey: apiKey
      }),
      timeout: TIMEOUTS.EXTENDED
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    
    const successRate = Math.round((result.categorizedComments?.length || 0) / comments.length * 100);
    addLogEntry(`Categorization successful: ${result.categorizedComments?.length || 0} of ${comments.length} comments (${successRate}%)`, 'success');
    
    if (result.extractedTopics?.length) {
      addLogEntry(`Extracted ${result.extractedTopics.length} topics`, 'success');
    }
    
    return result;
  } catch (error) {
    addLogEntry(`Categorization error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Summarize categorized comments using the API
 * @param {Array<Object>} categorizedComments - Categorized comments
 * @param {Array<Object>} extractedTopics - Extracted topics
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} Promise resolving to summary results
 */
export async function summarizeComments(categorizedComments, extractedTopics, apiKey) {
  if (!categorizedComments || !categorizedComments.length) {
    throw new Error('No categorized comments provided');
  }
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  addLogEntry(`Summarizing ${categorizedComments.length} categorized comments...`, 'info');
  
  try {
    const summarizeUrl = `${SERVER_URL}${API_ENDPOINTS.SUMMARIZE}`;
    addLogEntry(`Sending request to: ${summarizeUrl}`, 'info');
    
    const response = await fetchWithRetry(summarizeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        categorizedComments: categorizedComments,
        extractedTopics: extractedTopics,
        apiKey: apiKey
      }),
      timeout: TIMEOUTS.EXTENDED
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API returned status ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    addLogEntry('Summary generation successful ✅', 'success');
    
    return result;
  } catch (error) {
    addLogEntry(`Summarization error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Process comments with Claude API (two-step approach)
 * @param {Array<string>} comments - List of comments to process
 * @param {string} apiKey - Claude API key 
 * @returns {Promise<Object>} Promise resolving to processing results
 */
export async function processCommentsWithAPI(comments, apiKey) {
  // First, wake up the server
  await wakeupServer();
  
  // Step 1: Categorize all comments
  const categorizationResult = await categorizeComments(comments, apiKey);
  
  // Store the extracted topics
  const extractedTopics = categorizationResult.extractedTopics || [];
  
  // Step 2: Summarize categorized comments
  const summaryResult = await summarizeComments(
    categorizationResult.categorizedComments,
    extractedTopics,
    apiKey
  );
  
  // Convert summary format to match the expected format for display
  const processedResult = {
    categories: (summaryResult.summaries || []).map(summary => {
      // Find all comments for this category
      const categoryComments = categorizationResult.categorizedComments
        .filter(item => item.category === summary.category)
        .map(item => item.id);
      
      return {
        name: summary.category,
        comments: categoryComments,
        summary: summary.summary,
        sentiment: summary.sentiment || 0,
        commonIssues: summary.commonIssues,
        suggestedActions: summary.suggestedActions
      };
    }),
    topTopics: summaryResult.topTopics || [],
    extractedTopics: extractedTopics
  };
  
  return processedResult;
}