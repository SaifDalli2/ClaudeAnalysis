/**
 * API service functions for the Comment Categorization application
 */
import { SERVER_URL, API_ENDPOINTS, TIMEOUTS } from './config.js';
import { addLogEntry } from './utils.js';

/**
 * Check if the server is available
 * @returns {Promise<boolean>} Promise resolving to server availability
 */
export async function checkServerAvailability() {
  addLogEntry('Checking server availability...');
  
  try {
    // Try to connect to the ping endpoint
    const pingResponse = await fetch(`${SERVER_URL}${API_ENDPOINTS.PING}`, {
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
    addLogEntry('Trying to access server directly...', 'info');
    
    // Try a simpler fetch that might work better for CORS issues
    try {
      const directFetch = await fetch(SERVER_URL, {
        method: 'GET',
        mode: 'no-cors' // This might help with CORS issues
      });
      
      addLogEntry(`Direct connection with no-cors: ${directFetch.type}`, 'warning');
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
  
  addLogEntry(`Categorizing ${comments.length} comments...`);
  
  try {
    const categorizeUrl = `${SERVER_URL}${API_ENDPOINTS.CATEGORIZE}`;
    addLogEntry(`Sending request to: ${categorizeUrl}`);
    
    const response = await fetch(categorizeUrl, {
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
      const statusCode = response.status;
      
      addLogEntry(`API Error: Status ${statusCode}`, 'error');
      addLogEntry(`Response: ${errorText}`, 'error');
      
      // Check specifically for 503 Service Unavailable
      if (statusCode === 503) {
        throw new Error(`Server unavailable (503). The server is likely not running or is in sleep mode. Please try again in a moment or use simulation mode.`);
      } else {
        throw new Error(`API returned status ${statusCode}: ${errorText}`);
      }
    }
    
    const result = await response.json();
    
    const successRate = Math.round((result.categorizedComments?.length || 0) / comments.length * 100);
    addLogEntry(`Categorization successful: ${result.categorizedComments?.length || 0} of ${comments.length} comments (${successRate}%)`, 'success');
    
    if (result.extractedTopics?.length) {
      addLogEntry(`Extracted ${result.extractedTopics.length} topics`);
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
  
  addLogEntry(`Summarizing ${categorizedComments.length} categorized comments...`);
  
  try {
    const summarizeUrl = `${SERVER_URL}${API_ENDPOINTS.SUMMARIZE}`;
    addLogEntry(`Sending request to: ${summarizeUrl}`);
    
    const response = await fetch(summarizeUrl, {
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
    addLogEntry('Summary generation successful', 'success');
    
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
  // Check server availability before proceeding
  const isServerAvailable = await checkServerAvailability();
  
  if (!isServerAvailable) {
    throw new Error("Server is not available. Please try again later or use simulation mode.");
  }
  
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