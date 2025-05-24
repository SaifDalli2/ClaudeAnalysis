/**
 * Fixed API service with proper timeout handling
 */
import { SERVER_URL, API_ENDPOINTS, TIMEOUTS } from './config.js';
import { addLogEntry, delay } from './utils.js';

// Default retry configuration
const DEFAULT_RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY: 2000,
  BACKOFF_FACTOR: 1.5,
  JITTER: 500,
  STATUS_CODES: [429, 503, 504]
};

let RETRY = DEFAULT_RETRY;

/**
 * Create a fetch request with timeout using AbortController
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} - Promise resolving to fetch response
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  }
}

/**
 * Wrapper for fetch with retry capabilities
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Response>} - Promise resolving to fetch response
 */
async function fetchWithRetry(url, options = {}, timeoutMs = 30000) {
  let lastError;
  
  for (let attempt = 1; attempt <= RETRY.MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);
      
      // If response is successful or not in the retry status codes, return it
      if (response.ok || !RETRY.STATUS_CODES.includes(response.status)) {
        return response;
      }
      
      // Store error info for retry
      lastError = new Error(`HTTP status ${response.status}`);
      lastError.status = response.status;
      lastError.response = response;
      
      addLogEntry(`Received status ${response.status}, attempt ${attempt}/${RETRY.MAX_ATTEMPTS}`, 'warning');
      
    } catch (error) {
      lastError = error;
      addLogEntry(`Fetch error: ${error.message}, attempt ${attempt}/${RETRY.MAX_ATTEMPTS}`, 'error');
    }
    
    // If this was the last attempt, throw the error
    if (attempt === RETRY.MAX_ATTEMPTS) {
      break;
    }
    
    // Calculate and wait the backoff time
    const backoffTime = RETRY.BASE_DELAY * Math.pow(RETRY.BACKOFF_FACTOR, attempt - 1);
    addLogEntry(`Retrying in ${(backoffTime/1000).toFixed(1)} seconds...`, 'info');
    await delay(backoffTime);
  }
  
  // If we've exhausted all retries, throw the last error
  throw lastError || new Error('Maximum retry attempts reached');
}

/**
 * Attempt to wake up the Heroku server
 */
export async function wakeupServer() {
  addLogEntry('Attempting to wake up the server...', 'info');
  
  try {
    const wakeupUrl = `${SERVER_URL}${API_ENDPOINTS.PING}?wakeup=true`;
    addLogEntry(`Sending wake-up request to: ${wakeupUrl}`, 'info');

    const response = await fetchWithTimeout(wakeupUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      }
    }, 60000);
    
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
 */
export async function checkServerAvailability() {
  addLogEntry('Checking server availability...', 'info');
  
  try {
    const isAwake = await wakeupServer();
    if (isAwake) {
      return true;
    }
    
    const pingResponse = await fetchWithTimeout(`${SERVER_URL}${API_ENDPOINTS.PING}`, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      }
    }, 30000);
    
    if (pingResponse.ok) {
      addLogEntry('Server is available! ✅', 'success');
      return true;
    } else {
      addLogEntry(`Server returned status: ${pingResponse.status} ❌`, 'error');
      return false;
    }
  } catch (error) {
    addLogEntry(`Error connecting to server: ${error.message} ❌`, 'error');
    return false;
  }
}

/**
 * Start async categorization job with user authentication and industry-specific categories
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
    
    // Get authentication headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add authentication if user is logged in
    if (window.isAuthenticated && window.isAuthenticated()) {
      headers['Authorization'] = `Bearer ${window.authToken}`;
      addLogEntry('Including user authentication in request', 'info');
    }
    
    const requestBody = {
      comments: comments,
      apiKey: apiKey
    };
    
    // Add user's industry for category selection
    if (window.getCurrentUser && window.getCurrentUser()) {
      const user = window.getCurrentUser();
      if (user.industry) {
        requestBody.industry = user.industry;
        addLogEntry(`Using industry-specific categories: ${user.industry}`, 'info');
      }
    }
    
    const response = await fetchWithTimeout(categorizeUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    }, 30000);
    
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
 * Get job results
 */
export async function getJobResults(jobId) {
  try {
    const resultsUrl = `${SERVER_URL}/api/categorize/${jobId}/results`;
    
    const response = await fetchWithTimeout(resultsUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    }, 30000);
    
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
 * Summarize categorized comments using the API
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
    
    const response = await fetchWithTimeout(summarizeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        categorizedComments: categorizedComments,
        extractedTopics: extractedTopics,
        apiKey: apiKey
      })
    }, 120000); // 2 minute timeout for summarization
    
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
    addLogEntry('Summary generation successful ✅', 'success');
    
    return result;
  } catch (error) {
    addLogEntry(`Summarization error: ${error.message}`, 'error');
    throw error;
  }
}

// Add these fixes to your api-service.js file

/**
 * Enhanced processCommentsWithAPI with user authentication
 */
export async function processCommentsWithAPI(comments, apiKey) {
  try {
    // Check if user is authenticated and has an industry
    if (window.isAuthenticated && window.isAuthenticated()) {
      const user = window.getCurrentUser();
      addLogEntry(`Processing comments for user: ${user.email}`, 'info');
      
      if (user.industry) {
        addLogEntry(`Using ${user.industry} industry categories`, 'info');
      } else {
        addLogEntry('User has no industry set - using default categories', 'warning');
      }
    } else {
      addLogEntry('Processing comments without user authentication', 'info');
    }

    // Step 1: Start the categorization job
    const jobInfo = await startCategorizationJob(comments, apiKey);
    const jobId = jobInfo.jobId;
    
    addLogEntry(`Job started with ID: ${jobId}`, 'success');
    addLogEntry(`Estimated processing time: ${jobInfo.estimatedTimeMinutes} minutes`, 'info');
    addLogEntry(`Processing ${comments.length} comments in ${jobInfo.estimatedBatches} batches`, 'info');
    
    // Step 2: Enhanced polling with better error handling
    let attempts = 0;
    const maxAttempts = 600; // 50 minutes max (5-second intervals)
    let lastProgress = 0;
    let stuckCounter = 0;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;
    
    while (attempts < maxAttempts) {
      await delay(5000); // Wait 5 seconds between checks
      attempts++;
      
      try {
        const status = await checkJobStatus(jobId);
        consecutiveErrors = 0; // Reset error counter on successful status check
        
        // Update progress display with enhanced information
        if (window.updateProgressDisplay) {
          const progressMessage = status.status === 'processing' 
            ? `Processing batch ${status.batchesCompleted}/${status.totalBatches}... (${status.processedComments} comments completed)`
            : status.status === 'completed' 
              ? 'Processing completed successfully!'
              : status.status === 'failed'
                ? `Processing failed: ${status.error}`
                : 'Starting processing...';
          
          window.updateProgressDisplay(status.progress, progressMessage, {
            batchesCompleted: status.batchesCompleted,
            totalBatches: status.totalBatches,
            processedComments: status.processedComments,
            totalComments: status.totalComments,
            elapsedMinutes: status.elapsedMinutes
          });
        }
        
        addLogEntry(`Progress: ${status.progress}% (${status.batchesCompleted}/${status.totalBatches} batches, ${status.elapsedMinutes}min elapsed)`, 'info');
        
        // Display partial results in real-time if available
        if (status.categorizedComments && status.categorizedComments.length > 0) {
          addLogEntry(`Real-time update: ${status.categorizedComments.length} comments processed so far`, 'info');
          
          // Create partial results object for real-time display
          const partialResults = {
            categories: generateCategoriesFromComments(status.categorizedComments, comments),
            extractedTopics: status.extractedTopics || []
          };
          
          // Update display with partial results
          if (window.displayProcessingResults) {
            window.displayProcessingResults(partialResults, comments, true); // true = partial results
          }
        }
        
        // Check completion status
        if (status.status === 'completed') {
          addLogEntry('Job completed successfully!', 'success');
          break;
        } else if (status.status === 'failed') {
          // Don't immediately fail - check if we have partial results
          if (status.categorizedComments && status.categorizedComments.length > 0) {
            addLogEntry(`Job failed but recovered ${status.categorizedComments.length} comments`, 'warning');
            break; // Continue with partial results
          } else {
            throw new Error(`Job failed: ${status.error}`);
          }
        } else if (status.status === 'cancelled') {
          throw new Error('Job was cancelled');
        }
        
        // Enhanced stuck detection with more sophisticated logic
        if (status.progress === lastProgress) {
          stuckCounter++;
          if (stuckCounter >= 12) { // 1 minute of no progress
            addLogEntry(`No progress for ${stuckCounter * 5} seconds. Job may be processing a difficult batch...`, 'warning');
            
            if (stuckCounter >= 36) { // 3 minutes of no progress
              addLogEntry('Long delay detected. This is normal for large batches or during high API load.', 'warning');
            }
            
            // Reset stuck counter periodically to avoid false alarms
            if (stuckCounter >= 60) { // 5 minutes
              stuckCounter = 0;
              addLogEntry('Resetting stuck counter. Continuing to monitor...', 'info');
            }
          }
        } else {
          stuckCounter = 0; // Reset if progress is made
        }
        lastProgress = status.progress;
        
        // Adaptive polling - slow down if job is taking long
        if (status.elapsedMinutes > 20) {
          await delay(5000); // Extra 5 second delay for long-running jobs
        }
        
      } catch (statusError) {
        consecutiveErrors++;
        addLogEntry(`Status check error (${consecutiveErrors}/${maxConsecutiveErrors}): ${statusError.message}`, 'warning');
        
        // If job not found after several attempts, it may have been cleaned up
        if (statusError.message.includes('not found')) {
          if (consecutiveErrors >= 3) {
            throw new Error('Job was not found. It may have been cleaned up due to inactivity or server restart.');
          }
        }
        
        // If too many consecutive errors, give up
        if (consecutiveErrors >= maxConsecutiveErrors) {
          throw new Error(`Too many consecutive status check failures: ${statusError.message}`);
        }
        
        // Wait longer before next attempt after error
        await delay(10000);
        continue;
      }
    }
    
    if (attempts >= maxAttempts) {
      throw new Error('Job timed out after 50 minutes. This may indicate an issue with the processing.');
    }
    
    // Step 3: Get the final results
    addLogEntry('Retrieving final results...', 'info');
    let finalResults;
    
    try {
      finalResults = await getJobResults(jobId);
    } catch (resultsError) {
      // If we can't get final results but have partial results from status, use those
      const lastStatus = await checkJobStatus(jobId).catch(() => null);
      if (lastStatus && lastStatus.categorizedComments && lastStatus.categorizedComments.length > 0) {
        addLogEntry('Using partial results from last status check', 'warning');
        finalResults = {
          categorizedComments: lastStatus.categorizedComments,
          extractedTopics: lastStatus.extractedTopics || []
        };
      } else {
        throw resultsError;
      }
    }
    
    addLogEntry(`Final results: ${finalResults.categorizedComments.length} comments categorized`, 'success');
    
    // Step 4: Generate summaries if we have enough results
    if (finalResults.categorizedComments.length > 0) {
      try {
        addLogEntry('Generating summaries...', 'info');
        const summaryResult = await summarizeComments(
          finalResults.categorizedComments,
          finalResults.extractedTopics,
          apiKey
        );
        
        // Convert to expected format
        const processedResult = {
          categories: (summaryResult.summaries || []).map(summary => {
            const categoryComments = finalResults.categorizedComments
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
          extractedTopics: finalResults.extractedTopics
        };
        
        return processedResult;
      } catch (summaryError) {
        addLogEntry(`Summary generation failed, returning categorization only: ${summaryError.message}`, 'warning');
        
        // Return just categorization results if summary fails
        return generateCategoriesFromComments(finalResults.categorizedComments, comments);
      }
    } else {
      throw new Error('No comments were successfully categorized');
    }
    
  } catch (error) {
    addLogEntry(`API processing error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Helper function to generate categories from categorized comments
 */
function generateCategoriesFromComments(categorizedComments, originalComments) {
  const categoryMap = new Map();
  
  // Group comments by category
  categorizedComments.forEach(item => {
    if (!categoryMap.has(item.category)) {
      categoryMap.set(item.category, []);
    }
    categoryMap.get(item.category).push(item.id);
  });
  
  // Convert to expected format
  const categories = Array.from(categoryMap.entries()).map(([categoryName, commentIds]) => {
    const categoryComments = categorizedComments.filter(item => item.category === categoryName);
    const avgSentiment = categoryComments.length > 0 
      ? categoryComments.reduce((sum, item) => sum + (item.sentiment || 0), 0) / categoryComments.length 
      : 0;
    
    return {
      name: categoryName,
      comments: commentIds,
      summary: `Category containing ${commentIds.length} comments about ${categoryName.toLowerCase()}.`,
      sentiment: avgSentiment
    };
  });
  
  return {
    categories: categories,
    extractedTopics: []
  };
}

/**
 * Enhanced checkJobStatus with retry logic
 */
export async function checkJobStatus(jobId, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const statusUrl = `${SERVER_URL}/api/categorize/${jobId}/status`;
      
      const response = await fetchWithTimeout(statusUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      }, 30000); // 30 second timeout
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Job not found or expired');
        }
        throw new Error(`Status check failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt === retries - 1) {
        throw error; // Last attempt, throw the error
      }
      
      addLogEntry(`Status check attempt ${attempt + 1} failed, retrying...`, 'warning');
      await delay(2000 * (attempt + 1)); // Progressive delay
    }
  }
}

/**
 * Enhanced job cancellation
 */
export async function cancelJob(jobId) {
  try {
    const cancelUrl = `${SERVER_URL}/api/categorize/${jobId}/cancel`;
    
    const response = await fetchWithTimeout(cancelUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json'
      }
    }, 15000);
    
    if (!response.ok) {
      throw new Error(`Cancel request failed: ${response.status}`);
    }
    
    const result = await response.json();
    addLogEntry('Job cancelled successfully', 'info');
    
    return result.partialResults || null;
  } catch (error) {
    addLogEntry(`Failed to cancel job: ${error.message}`, 'error');
    throw error;
  }
}