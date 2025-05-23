/**
 * Enhanced API service with robust retry logic and error handling
 * Can be used to update the existing api-service.js file
 */
import { SERVER_URL, API_ENDPOINTS, TIMEOUTS } from './config.js';
import { addLogEntry, delay } from './utils.js';

// Default retry configuration if not provided in config.js
const DEFAULT_RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 2000,
  BACKOFF_FACTOR: 1.5,
  JITTER: 500,
  STATUS_CODES: [429, 503, 504]
};

// Import RETRY from config.js if available, otherwise use default
let RETRY;
try {
  // Dynamic import to handle potential missing export
  import('./config.js').then(config => {
    RETRY = config.RETRY || DEFAULT_RETRY;
    console.log("Using retry configuration from config.js");
  }).catch(() => {
    RETRY = DEFAULT_RETRY;
    console.log("Using default retry configuration");
  });
} catch (e) {
  RETRY = DEFAULT_RETRY;
  console.log("Using default retry configuration due to import error");
}

// Initialize RETRY immediately (will be replaced if dynamic import succeeds)
RETRY = DEFAULT_RETRY;

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
    const wakeupUrl = `${SERVER_URL}${API_ENDPOINTS.PING}?wakeup=true`;
    addLogEntry(`Sending wake-up request to: ${wakeupUrl}`, 'info');

    // First try with regular fetch
    const response = await fetchWithRetry(wakeupUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: TIMEOUTS.WAKEUP || 60000
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
    
    // Try with no-cors mode as a last resort
    try {
      addLogEntry('Attempting no-cors mode as fallback...', 'info');
      await fetch(`${SERVER_URL}/api/ping`, { 
        method: 'GET',
        mode: 'no-cors' 
      });
      addLogEntry('Sent no-cors request - cannot determine if successful', 'warning');
      // Wait a bit to give server time to wake up
      await delay(5000);
      return false;
    } catch(e) {
      addLogEntry('No-cors wake-up attempt also failed', 'error');
      return false;
    }
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
// Add this to your api-service.js - Replace the existing categorizeComments function

/**
 * Start async categorization job
 * @param {Array<string>} comments - List of comments to categorize
 * @param {string} apiKey - Claude API key
 * @returns {Promise<Object>} Promise resolving to job details
 */
export async function startCategorizationJob(comments, apiKey) {
  if (!comments || !comments.length) {
    throw new Error('No comments provided');
  }
  
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  addLogEntry(`Starting categorization job for ${comments.length} comments...`, 'info');
  
  try {
    const categorizeUrl = `${SERVER_URL}${API_ENDPOINTS.CATEGORIZE}`;
    addLogEntry(`Sending job start request to: ${categorizeUrl}`, 'info');
    
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
      timeout: 30000 // Short timeout since this just starts the job
    });
    
    if (!response.ok) {
      let errorText;
      try {
        const errorData = await response.json();
        errorText = errorData.details || errorData.error || `Status ${response.status}`;
      } catch {
        errorText = await response.text() || `Status ${response.status}`;
      }
      throw new Error(errorText);
    }
    
    const result = await response.json();
    addLogEntry(`Categorization job started successfully: ${result.jobId}`, 'success');
    addLogEntry(`Estimated processing time: ${result.estimatedTimeMinutes} minutes`, 'info');
    
    return result;
  } catch (error) {
    addLogEntry(`Failed to start categorization job: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Check job status
 * @param {string} jobId - Job ID to check
 * @returns {Promise<Object>} Promise resolving to job status
 */
export async function checkJobStatus(jobId) {
  try {
    const statusUrl = `${SERVER_URL}/api/categorize/${jobId}/status`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Job not found or expired');
      }
      throw new Error(`Status check failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    addLogEntry(`Status check failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Get job results
 * @param {string} jobId - Job ID to get results for
 * @returns {Promise<Object>} Promise resolving to job results
 */
export async function getJobResults(jobId) {
  try {
    const resultsUrl = `${SERVER_URL}/api/categorize/${jobId}/results`;
    
    const response = await fetch(resultsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Job not found or expired');
      }
      if (response.status === 425) {
        const statusData = await response.json();
        throw new Error(`Job not completed yet (${statusData.progress}% done)`);
      }
      throw new Error(`Failed to get results: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    addLogEntry(`Failed to get results: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Process comments with API using new async approach
 * @param {Array<string>} comments - List of comments to process
 * @param {string} apiKey - Claude API key 
 * @returns {Promise<Object>} Promise resolving to processing results
 */
export async function processCommentsWithAPI(comments, apiKey) {
  try {
    // Step 1: Start the categorization job
    const jobInfo = await startCategorizationJob(comments, apiKey);
    const jobId = jobInfo.jobId;
    
    addLogEntry(`Job started with ID: ${jobId}`, 'success');
    addLogEntry(`Estimated processing time: ${jobInfo.estimatedTimeMinutes} minutes`, 'info');
    
    // Step 2: Poll for status updates
    let attempts = 0;
    const maxAttempts = 120; // 10 minutes max (5-second intervals)
    
    while (attempts < maxAttempts) {
      await delay(5000); // Wait 5 seconds between checks
      attempts++;
      
      try {
        const status = await checkJobStatus(jobId);
        
        addLogEntry(`Progress: ${status.progress}% (${status.batchesCompleted}/${status.totalBatches} batches, ${status.elapsedMinutes}min elapsed)`, 'info');
        
        if (status.status === 'completed') {
          addLogEntry('Job completed successfully!', 'success');
          break;
        } else if (status.status === 'failed') {
          throw new Error(`Job failed: ${status.error}`);
        }
        
        // Update UI with progress if available
        updateProgressDisplay(status.progress, `Processing batch ${status.batchesCompleted}/${status.totalBatches}...`);
        
      } catch (statusError) {
        addLogEntry(`Status check error: ${statusError.message}`, 'warning');
        // Continue polling unless it's a fatal error
        if (statusError.message.includes('not found')) {
          throw statusError;
        }
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Job timed out after 10 minutes');
    }
    
    // Step 3: Get the results
    addLogEntry('Retrieving final results...', 'info');
    const results = await getJobResults(jobId);
    
    addLogEntry(`Results retrieved: ${results.categorizedComments.length} comments categorized (${results.processingStats.successRate}% success rate)`, 'success');
    
    // Step 4: Get summaries (if categorization was successful)
    if (results.categorizedComments.length > 0) {
      try {
        addLogEntry('Generating summaries...', 'info');
        const summaryResult = await summarizeComments(
          results.categorizedComments,
          results.extractedTopics,
          apiKey
        );
        
        // Convert to expected format
        const processedResult = {
          categories: (summaryResult.summaries || []).map(summary => {
            const categoryComments = results.categorizedComments
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
          extractedTopics: results.extractedTopics
        };
        
        return processedResult;
      } catch (summaryError) {
        addLogEntry(`Summary generation failed, returning categorization only: ${summaryError.message}`, 'warning');
        
        // Return just categorization results if summary fails
        return {
          categories: [{
            name: 'Categorized Comments',
            comments: results.categorizedComments.map(item => item.id),
            summary: `Successfully categorized ${results.categorizedComments.length} comments.`,
            sentiment: 0
          }],
          extractedTopics: results.extractedTopics
        };
      }
    } else {
      throw new Error('No comments were successfully categorized');
    }
    
  } catch (error) {
    addLogEntry(`API processing error: ${error.message}`, 'error');
    throw error;
  }
}

// Helper function to update progress display (add to ui-handlers.js)
function updateProgressDisplay(percentage, message) {
  // Update progress bar if it exists
  const progressBar = document.querySelector('.progress-bar');
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
  }
  
  // Update progress text if it exists
  const progressText = document.querySelector('.progress-text');
  if (progressText) {
    progressText.textContent = `${percentage}% - ${message}`;
  }
  
  // Update any other progress indicators
  const progressMessage = document.getElementById('progress-message');
  if (progressMessage) {
    progressMessage.textContent = message;
  }
  
  console.log(`Progress: ${percentage}% - ${message}`);
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
      timeout: TIMEOUTS.EXTENDED || 120000
    });
    
    if (!response.ok) {
      // Get error details if available
      let errorText;
      try {
        const errorData = await response.json();
        errorText = errorData.details || errorData.error || `Status ${response.status}`;
      } catch {
        errorText = await response.text() || `Status ${response.status}`;
      }
      
      throw new Error(errorText);
    }
    
    const result = await response.json();
    addLogEntry('Summary generation successful ✅', 'success');
    
    return result;
  } catch (error) {
    addLogEntry(`Summarization error: ${error.message}`, 'error');
    throw error;
  }
}
