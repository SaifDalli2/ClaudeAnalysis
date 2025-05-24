/**
 * Enhanced UI handler functions for real-time progress display
 * Fixed result display issues
 */
import { 
  getCurrentLanguage, 
  escapeHtml, 
  processCSVContent, 
  addLogEntry,
  clearLogs,
  getTranslation,
  formatFileSize
} from './utils.js';
import { displayTopics } from './topic-visualizer.js';

// Global variables to track processing state
let currentJobId = null;
let processedResults = { categorizedComments: [], extractedTopics: [] };

/**
 * Enhanced processComments function with real-time updates
 */
export async function enhancedProcessComments(comments, useSimulation = false) {
  clearLogs();
  addLogEntry('Starting comment processing...');
  
  try {
    // Get API key
    const apiKey = useSimulation ? null : document.getElementById('apiKeyInput').value;
    
    if (!useSimulation && (!apiKey || apiKey.trim() === '')) {
      throw new Error('Please provide a valid Claude API key for API processing');
    }
    
    let result;
    
    if (useSimulation) {
      // Import and use simulation
      const { processCommentsWithSimulation } = await import('./simulation.js');
      
      showProgressIndicator(true);
      updateProgressIndicator(50, 'Running simulation...', {
        batchesCompleted: 1,
        totalBatches: 2,
        processedComments: Math.floor(comments.length * 0.8),
        totalComments: comments.length,
        elapsedMinutes: 0.1
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      result = processCommentsWithSimulation(comments);
      
      updateProgressIndicator(100, 'Simulation completed!', {
        batchesCompleted: 2,
        totalBatches: 2,
        processedComments: comments.length,
        totalComments: comments.length,
        elapsedMinutes: 0.1
      });
      
    } else {
      // Use API with real-time progress tracking
      addLogEntry('Using Claude API with async processing');
      
      showProgressIndicator(true);
      
      try {
        result = await processCommentsWithAPI(comments, apiKey);
      } catch (error) {
        addLogEntry(`API processing failed: ${error.message}`, 'error');
        addLogEntry('Note: You can switch to simulation mode if API issues persist', 'warning');
        throw error;
      }
    }
    
    // Display final results with debugging
    addLogEntry('Processing complete! Displaying results...');
    addLogEntry(`Result structure: ${JSON.stringify(Object.keys(result || {}), null, 2)}`, 'info');
    
    if (result && result.categories) {
      addLogEntry(`Categories found: ${result.categories.length}`, 'info');
      result.categories.forEach((cat, index) => {
        addLogEntry(`Category ${index + 1}: ${cat.name} (${cat.comments ? cat.comments.length : 0} comments)`, 'info');
      });
    }
    
    displayProcessingResults(result, comments);
    
    return result;
    
  } catch (error) {
    console.error('Error processing comments:', error);
    addLogEntry(`Error: ${error.message}`, 'error');
    
    updateProgressIndicator(0, `Error: ${error.message}`, {});
    
    // Show error in results container
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
      categoriesContainer.innerHTML = `<div class="error">Error processing comments: ${error.message}</div>`;
    }
    
    throw error;
  } finally {
    // Hide progress indicator after delay
    setTimeout(() => {
      showProgressIndicator(false);
    }, 3000);
  }
}

/**
 * Process comments with API using enhanced real-time updates
 */
async function processCommentsWithAPI(comments, apiKey) {
  const { startCategorizationJob, checkJobStatus, getJobResults } = await import('./api-service.js');
  
  try {
    // Start the job
    const jobInfo = await startCategorizationJob(comments, apiKey);
    currentJobId = jobInfo.jobId;
    
    addLogEntry(`Job started with ID: ${currentJobId}`, 'success');
    addLogEntry(`Estimated processing time: ${jobInfo.estimatedTimeMinutes} minutes`, 'info');
    
    // Setup job cancellation
    setupJobCancellation(currentJobId);
    
    // Reset processed results
    processedResults = { categorizedComments: [], extractedTopics: [] };
    
    // Poll for status with enhanced real-time display
    let attempts = 0;
    const maxAttempts = 300; // 25 minutes max (5-second intervals)
    let lastProgress = 0;
    let stuckCounter = 0;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second intervals
      attempts++;
      
      try {
        const status = await checkJobStatus(currentJobId);
        
        // Update progress display
        updateProgressIndicator(status.progress, 
          `Processing batch ${status.batchesCompleted}/${status.totalBatches}...`, {
          batchesCompleted: status.batchesCompleted,
          totalBatches: status.totalBatches,
          processedComments: status.processedComments,
          totalComments: status.totalComments,
          elapsedMinutes: status.elapsedMinutes
        });
        
        addLogEntry(`Progress: ${status.progress}% (${status.batchesCompleted}/${status.totalBatches} batches, ${status.elapsedMinutes}min elapsed)`, 'info');
        
        // Check if job completed
        if (status.status === 'completed') {
          addLogEntry('Job completed successfully!', 'success');
          break;
        } else if (status.status === 'failed') {
          throw new Error(`Job failed: ${status.error}`);
        }
        
        // **REAL-TIME RESULTS DISPLAY**: Show partial results as they become available
        if (status.categorizedComments && status.categorizedComments.length > processedResults.categorizedComments.length) {
          // New results available - update the display
          processedResults.categorizedComments = status.categorizedComments;
          processedResults.extractedTopics = status.extractedTopics || [];
          
          addLogEntry(`Displaying partial results: ${processedResults.categorizedComments.length} comments processed so far`, 'info');
          
          // Generate partial categories for display
          const partialCategories = generateCategoriesFromComments(processedResults.categorizedComments, comments);
          displayProcessingResults(partialCategories, comments, true); // true = partial results
        }
        
        // Check for stuck job
        if (status.progress === lastProgress) {
          stuckCounter++;
          if (stuckCounter >= 6) { // 30 seconds of no progress
            addLogEntry('Job appears to be stuck, continuing to wait...', 'warning');
            stuckCounter = 0; // Reset counter
          }
        } else {
          stuckCounter = 0;
        }
        lastProgress = status.progress;
        
      } catch (statusError) {
        addLogEntry(`Status check error: ${statusError.message}`, 'warning');
        
        if (statusError.message.includes('not found')) {
          throw new Error('Job was not found. It may have been cleaned up or expired.');
        }
        
        continue; // Continue polling for other errors
      }
    }
    
    if (attempts >= maxAttempts) {
      // Timeout reached - but we may have partial results
      if (processedResults.categorizedComments.length > 0) {
        addLogEntry(`Job timed out after 25 minutes, but ${processedResults.categorizedComments.length} comments were successfully processed`, 'warning');
        return generateCategoriesFromComments(processedResults.categorizedComments, comments);
      } else {
        throw new Error('Job timed out after 25 minutes with no results');
      }
    }
    
    // Get final results
    addLogEntry('Retrieving final results...', 'info');
    const finalResults = await getJobResults(currentJobId);
    
    addLogEntry(`Final results retrieved: ${finalResults.categorizedComments.length} comments categorized`, 'success');
    
    // Generate summaries for final results
    return await generateSummariesForResults(finalResults, comments, apiKey);
    
  } catch (error) {
    addLogEntry(`API processing error: ${error.message}`, 'error');
    
    // If we have partial results, return them
    if (processedResults.categorizedComments.length > 0) {
      addLogEntry(`Returning partial results: ${processedResults.categorizedComments.length} comments processed`, 'warning');
      return generateCategoriesFromComments(processedResults.categorizedComments, comments);
    }
    
    throw error;
  } finally {
    currentJobId = null;
    hideJobCancellation();
  }
}

/**
 * Generate categories from categorized comments (FIXED VERSION)
 */
function generateCategoriesFromComments(categorizedComments, originalComments) {
  console.log('Generating categories from categorized comments:', categorizedComments.length);
  
  const categoryMap = new Map();
  
  // Group comments by category
  categorizedComments.forEach(item => {
    const categoryName = item.category || 'Uncategorized';
    if (!categoryMap.has(categoryName)) {
      categoryMap.set(categoryName, []);
    }
    categoryMap.get(categoryName).push(item.id);
  });
  
  console.log('Category map created:', Array.from(categoryMap.keys()));
  
  // Convert to expected format
  const categories = Array.from(categoryMap.entries()).map(([categoryName, commentIds]) => {
    const categoryComments = categorizedComments.filter(item => item.category === categoryName);
    const avgSentiment = categoryComments.length > 0 
      ? categoryComments.reduce((sum, item) => sum + (item.sentiment || 0), 0) / categoryComments.length 
      : 0;
    
    const category = {
      name: categoryName,
      comments: commentIds,
      summary: `Category containing ${commentIds.length} comments about ${categoryName.toLowerCase()}.`,
      sentiment: avgSentiment,
      commonIssues: [`Issues related to ${categoryName}`],
      suggestedActions: [`Address ${categoryName} concerns`, `Review ${categoryName} feedback`]
    };
    
    console.log(`Generated category: ${categoryName} with ${commentIds.length} comments`);
    return category;
  });
  
  return {
    categories: categories,
    extractedTopics: []
  };
}

/**
 * Generate summaries for results (either partial or final) - FIXED VERSION
 */
async function generateSummariesForResults(results, comments, apiKey) {
  try {
    const { summarizeComments } = await import('./api-service.js');
    
    addLogEntry('Generating summaries...', 'info');
    const summaryResult = await summarizeComments(
      results.categorizedComments,
      results.extractedTopics,
      apiKey
    );
    
    addLogEntry(`Summary result structure: ${JSON.stringify(Object.keys(summaryResult || {}), null, 2)}`, 'info');
    addLogEntry(`Summary result type: ${typeof summaryResult}`, 'info');
    
    // DEBUG: Log the entire summary result for troubleshooting
    if (window.debugMode) {
      console.log('🔍 Full summary result:', summaryResult);
    }
    
    let processedCategories = [];
    
    // Strategy 1: Check for summaries array (expected format)
    if (summaryResult && summaryResult.summaries && Array.isArray(summaryResult.summaries) && summaryResult.summaries.length > 0) {
      addLogEntry(`Found summaries array with ${summaryResult.summaries.length} summaries`, 'info');
      
      processedCategories = summaryResult.summaries.map(summary => {
        const categoryComments = results.categorizedComments
          .filter(item => item.category === summary.category)
          .map(item => item.id);
        
        return {
          name: summary.category,
          comments: categoryComments,
          summary: summary.summary || `Summary for ${summary.category}`,
          sentiment: summary.sentiment || 0,
          commonIssues: summary.commonIssues || [`Issues related to ${summary.category}`],
          suggestedActions: summary.suggestedActions || [`Review ${summary.category} feedback`]
        };
      });
      
    } 
    // Strategy 2: Check if summaryResult itself is the summaries array
    else if (summaryResult && Array.isArray(summaryResult) && summaryResult.length > 0) {
      addLogEntry(`Summary result is directly an array with ${summaryResult.length} items`, 'info');
      
      processedCategories = summaryResult.map(summary => {
        const categoryComments = results.categorizedComments
          .filter(item => item.category === summary.category)
          .map(item => item.id);
        
        return {
          name: summary.category,
          comments: categoryComments,
          summary: summary.summary || `Summary for ${summary.category}`,
          sentiment: summary.sentiment || 0,
          commonIssues: summary.commonIssues || [`Issues related to ${summary.category}`],
          suggestedActions: summary.suggestedActions || [`Review ${summary.category} feedback`]
        };
      });
    }
    // Strategy 3: Check for categorizedComments in summaryResult (fallback)
    else if (summaryResult && summaryResult.categorizedComments && Array.isArray(summaryResult.categorizedComments)) {
      addLogEntry('Found categorizedComments in summary result, using as fallback', 'warning');
      
      // Group by category
      const categoryMap = new Map();
      summaryResult.categorizedComments.forEach(item => {
        const categoryName = item.category || 'Uncategorized';
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, []);
        }
        categoryMap.get(categoryName).push(item.id);
      });
      
      processedCategories = Array.from(categoryMap.entries()).map(([categoryName, commentIds]) => {
        const categoryComments = summaryResult.categorizedComments.filter(item => item.category === categoryName);
        const avgSentiment = categoryComments.length > 0 
          ? categoryComments.reduce((sum, item) => sum + (item.sentiment || 0), 0) / categoryComments.length 
          : 0;
        
        return {
          name: categoryName,
          comments: commentIds,
          summary: `Category containing ${commentIds.length} comments about ${categoryName.toLowerCase()}.`,
          sentiment: avgSentiment,
          commonIssues: [`Issues related to ${categoryName}`],
          suggestedActions: [`Address ${categoryName} concerns`, `Review ${categoryName} feedback`]
        };
      });
    }
    // Strategy 4: FALLBACK - Use original categorized comments directly
    else {
      addLogEntry('No valid summary structure found, falling back to original categorized comments', 'warning');
      addLogEntry(`Available summary result keys: ${summaryResult ? Object.keys(summaryResult) : 'null'}`, 'warning');
      
      // Group original results by category
      const categoryMap = new Map();
      results.categorizedComments.forEach(item => {
        const categoryName = item.category || 'Uncategorized';
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, []);
        }
        categoryMap.get(categoryName).push(item.id);
      });
      
      processedCategories = Array.from(categoryMap.entries()).map(([categoryName, commentIds]) => {
        const categoryComments = results.categorizedComments.filter(item => item.category === categoryName);
        const avgSentiment = categoryComments.length > 0 
          ? categoryComments.reduce((sum, item) => sum + (item.sentiment || 0), 0) / categoryComments.length 
          : 0;
        
        return {
          name: categoryName,
          comments: commentIds,
          summary: `Category containing ${commentIds.length} comments about ${categoryName.toLowerCase()}.`,
          sentiment: avgSentiment,
          commonIssues: [`Issues related to ${categoryName}`],
          suggestedActions: [`Address ${categoryName} concerns`, `Review ${categoryName} feedback`]
        };
      });
    }
    
    // Ensure we have results
    if (processedCategories.length === 0) {
      addLogEntry('No processed categories found, generating from original data', 'error');
      return generateCategoriesFromComments(results.categorizedComments, comments);
    }
    
    const processedResult = {
      categories: processedCategories,
      topTopics: summaryResult?.topTopics || [],
      extractedTopics: results.extractedTopics || summaryResult?.extractedTopics || []
    };
    
    addLogEntry(`Final processed result has ${processedResult.categories.length} categories`, 'success');
    
    // Debug output
    if (window.debugMode) {
      console.log('🔍 Final processed categories:', processedResult.categories);
      processedResult.categories.forEach((cat, index) => {
        console.log(`Category ${index + 1}: ${cat.name} (${cat.comments.length} comments)`);
      });
    }
    
    return processedResult;
    
  } catch (summaryError) {
    addLogEntry(`Summary generation failed, returning categorization only: ${summaryError.message}`, 'error');
    console.error('Summary generation error:', summaryError);
    
    // Return just categorization results if summary fails
    return generateCategoriesFromComments(results.categorizedComments, comments);
  }
}

// In services/summary.js, update the summarizeComments function:
async function summarizeComments(categorizedComments, extractedTopics, apiKey) {
  console.log(`Summarizing ${categorizedComments.length} categorized comments...`);
  
  // ... existing code ...
  
  const summaryData = parseClaudeResponse(response);
  
  // DEBUG: Log the parsed summary data
  console.log('📊 Parsed summary data structure:', Object.keys(summaryData || {}));
  console.log('📊 Parsed summary data:', summaryData);
  
  // Add actual comment counts for each category
  if (summaryData.summaries && Array.isArray(summaryData.summaries)) {
    summaryData.summaries.forEach(summary => {
      if (commentsByCategory[summary.category]) {
        summary.commentCount = commentsByCategory[summary.category].length;
      }
    });
    console.log(`📊 Enhanced ${summaryData.summaries.length} summaries with comment counts`);
  } else {
    console.warn('⚠️ No summaries array found in parsed data');
    
    // If no summaries found, check if we have categorizedComments instead
    if (summaryData.categorizedComments) {
      console.log('📊 Found categorizedComments in summary data');
    }
  }
  
  return summaryData;
}

/**
 * THIRD FIX: Enhanced debugging for the main processing function
 */
// In ui-handlers.js, update processCommentsWithAPI function to add more logging:

// After getting final results, add this:
console.log('🔍 Final results from server:', finalResults);
console.log('🔍 Final results structure:', Object.keys(finalResults || {}));
if (finalResults.categorizedComments) {
  console.log(`🔍 Final results has ${finalResults.categorizedComments.length} categorized comments`);
}

// Before calling generateSummariesForResults, add this:
console.log('🔍 About to generate summaries for results...');
console.log('🔍 Results passed to generateSummariesForResults:', {
  categorizedCommentsCount: finalResults.categorizedComments?.length || 0,
  extractedTopicsCount: finalResults.extractedTopics?.length || 0
});

/**
 * USAGE INSTRUCTIONS:
 * 
 * 1. Replace the generateSummariesForResults function in ui-handlers.js with the version above
 * 2. Add the debug logging to services/summary.js
 * 3. Add the debug logging to the processCommentsWithAPI function
 * 4. Enable debug mode in the UI to see detailed logs
 * 
 * This fix handles multiple possible response formats from the summarization API
 * and ensures results are preserved even if summarization fails or returns unexpected format.
 */

/**
 * Enhanced display processing results with debugging and better error handling
 */
export function displayProcessingResults(result, comments, isPartial = false) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  
  addLogEntry(`displayProcessingResults called with: ${result ? 'valid result' : 'null result'}`, 'info');
  
  if (!result) {
    addLogEntry('No result provided to displayProcessingResults', 'error');
    categoriesContainer.innerHTML = '<div class="error">No results available</div>';
    return;
  }
  
  addLogEntry(`Result keys: ${JSON.stringify(Object.keys(result))}`, 'info');
  
  if (!result.categories || !Array.isArray(result.categories)) {
    addLogEntry(`Invalid categories in result: ${typeof result.categories}`, 'error');
    categoriesContainer.innerHTML = '<div class="error">No categories found in results</div>';
    return;
  }
  
  addLogEntry(`Found ${result.categories.length} categories to display`, 'info');
  
  // Add partial results indicator
  if (isPartial) {
    const partialHeader = document.createElement('div');
    partialHeader.className = 'partial-results-header';
    partialHeader.innerHTML = `
      <div class="partial-notice">
        <strong>⏳ Partial Results</strong> - Processing continues in background. 
        Results will update automatically as more comments are processed.
      </div>
    `;
    categoriesContainer.innerHTML = '';
    categoriesContainer.appendChild(partialHeader);
  } else {
    categoriesContainer.innerHTML = '';
  }
  
  // Update statistics
  updateOverallStats(result, comments);
  
  // Display topic cloud if available
  if (result.extractedTopics && result.extractedTopics.length) {
    addLogEntry(`Displaying ${result.extractedTopics.length} topics`, 'info');
    displayTopics(result.extractedTopics, comments, categoriesContainer);
  }
  
  // Display categories with enhanced logging
  addLogEntry('About to call displayResults function', 'info');
  displayResults(result, comments);
  addLogEntry('displayResults function completed', 'info');
}

/**
 * Display categorization results (FIXED VERSION)
 */
export function displayResults(result, comments) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  
  addLogEntry(`displayResults called with ${result.categories ? result.categories.length : 0} categories`, 'info');
  
  if (!result || !result.categories || !Array.isArray(result.categories)) {
    addLogEntry('Invalid result structure in displayResults', 'error');
    categoriesContainer.innerHTML = '<div class="error">No categories to display</div>';
    return;
  }
  
  // Clear existing results (but keep partial results header if it exists)
  const existingHeader = categoriesContainer.querySelector('.partial-results-header');
  if (!existingHeader) {
    categoriesContainer.innerHTML = '';
  } else {
    // Remove everything except the header
    const children = Array.from(categoriesContainer.children);
    children.forEach(child => {
      if (!child.classList.contains('partial-results-header')) {
        child.remove();
      }
    });
  }
  
  addLogEntry(`Processing ${result.categories.length} categories for display`, 'info');
  
  result.categories.forEach((category, index) => {
    addLogEntry(`Creating card for category ${index + 1}: ${category.name}`, 'info');
    
    const categoryCard = document.createElement('div');
    categoryCard.className = 'category-card';
    
    // Get sentiment class and emoji
    const sentimentClass = category.sentiment > 0.3
      ? 'sentiment-positive'
      : category.sentiment < -0.3
        ? 'sentiment-negative'
        : 'sentiment-neutral';
    
    const sentimentEmoji = category.sentiment > 0.3
      ? '😃'
      : category.sentiment < -0.3
        ? '😞'
        : '😐';
    
    // Calculate sentiment percentage for the progress bar
    const sentimentPercentage = Math.round((category.sentiment + 1) / 2 * 100);
    
    // Ensure we have valid data
    const commentCount = category.comments ? category.comments.length : 0;
    const categoryName = category.name || 'Unknown Category';
    const categorySummary = category.summary || 'No summary available';
    const sentiment = category.sentiment || 0;
    
    addLogEntry(`Category ${categoryName}: ${commentCount} comments`, 'info');
    
    // Create category HTML
    categoryCard.innerHTML = `
      <div class="category-header">
        <div class="category-name">${escapeHtml(categoryName)}</div>
        <div class="category-count">${commentCount} ${getTranslation('comments', 'comments')}</div>
      </div>
      <div class="category-summary">${escapeHtml(categorySummary)}</div>
      <div class="sentiment-details">
        <span class="sentiment-emoji">${sentimentEmoji}</span>
        <div style="flex-grow: 1;">
          <div class="sentiment-label">
            <span>${getTranslation('sentiment', 'Sentiment')}:</span>
            <span>${sentiment.toFixed(1)}</span>
          </div>
          <div class="sentiment-bar-container">
            <div class="sentiment-bar ${sentimentClass}" style="width: ${sentimentPercentage}%"></div>
          </div>
          <div class="sentiment-label">
            <span>${getTranslation('negative', 'Negative')}</span>
            <span>${getTranslation('positive', 'Positive')}</span>
          </div>
        </div>
      </div>
      ${category.commonIssues && category.commonIssues.length > 0 ? `
        <div class="category-issues">
          <h4>Common Issues:</h4>
          <ul>
            ${category.commonIssues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      ${category.suggestedActions && category.suggestedActions.length > 0 ? `
        <div class="category-actions">
          <h4>Suggested Actions:</h4>
          <ul>
            ${category.suggestedActions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
      <button class="show-comments-btn" data-action="show">${getTranslation('show-comments', 'Show Comments')}</button>
      <div class="category-comments">
        ${category.comments && category.comments.length > 0 ? category.comments.map(commentIndex => {
          const index = commentIndex - 1;
          const comment = index >= 0 && index < comments.length 
            ? comments[index] 
            : `[Comment #${commentIndex} not found]`;
          return `<div class="category-comment">${escapeHtml(comment)}</div>`;
        }).join('') : '<div class="no-comments">No comments available</div>'}
      </div>
    `;
    
    // Add click handler for show/hide comments
    const showHideBtn = categoryCard.querySelector('.show-comments-btn');
    const commentsDiv = categoryCard.querySelector('.category-comments');
    
    showHideBtn.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      if (action === 'show') {
        commentsDiv.style.display = 'block';
        this.textContent = getTranslation('hide-comments', 'Hide Comments');
        this.setAttribute('data-action', 'hide');
      } else {
        commentsDiv.style.display = 'none';
        this.textContent = getTranslation('show-comments', 'Show Comments');
        this.setAttribute('data-action', 'show');
      }
    });
    
    categoriesContainer.appendChild(categoryCard);
    addLogEntry(`Category card created and added for: ${categoryName}`, 'info');
  });
  
  addLogEntry(`All ${result.categories.length} category cards have been created`, 'success');
}

/**
 * Show progress indicator
 */
export function showProgressIndicator(show) {
  const progressDiv = document.getElementById('processingProgress');
  if (progressDiv) {
    progressDiv.style.display = show ? 'block' : 'none';
    
    if (show) {
      progressDiv.classList.add('active');
      updateProgressIndicator(0, 'Starting job...', {
        batchesCompleted: 0,
        totalBatches: 0,
        processedComments: 0,
        totalComments: 0,
        elapsedMinutes: 0
      });
    } else {
      progressDiv.classList.remove('active');
    }
  }
}

/**
 * Update progress indicator with enhanced visual feedback
 */
export function updateProgressIndicator(percentage, message, details = {}) {
  const progressPercentage = document.getElementById('progressPercentage');
  if (progressPercentage) {
    progressPercentage.textContent = `${percentage}%`;
  }
  
  const progressBar = document.getElementById('progressBar');
  if (progressBar) {
    progressBar.style.width = `${percentage}%`;
    
    // Add color coding based on progress
    progressBar.className = 'progress-bar';
    if (percentage >= 90) {
      progressBar.classList.add('progress-success');
    } else if (percentage >= 70) {
      progressBar.classList.add('progress-warning');
    } else {
      progressBar.classList.add('progress-processing');
    }
  }
  
  const progressMessage = document.getElementById('progressMessage');
  if (progressMessage) {
    progressMessage.textContent = message;
  }
  
  // Update detailed stats
  if (details.batchesCompleted !== undefined && details.totalBatches !== undefined) {
    const batchProgress = document.getElementById('batchProgress');
    if (batchProgress) {
      batchProgress.textContent = `${details.batchesCompleted}/${details.totalBatches}`;
    }
  }
  
  if (details.elapsedMinutes !== undefined) {
    const elapsedTime = document.getElementById('elapsedTime');
    if (elapsedTime) {
      elapsedTime.textContent = `${details.elapsedMinutes} min`;
    }
  }
  
  if (details.processedComments !== undefined && details.totalComments !== undefined) {
    const commentProgress = document.getElementById('commentProgress');
    if (commentProgress) {
      commentProgress.textContent = `${details.processedComments}/${details.totalComments}`;
    }
    
    const successRate = details.totalComments > 0 
      ? Math.round((details.processedComments / details.totalComments) * 100)
      : 0;
    const successRateEl = document.getElementById('successRate');
    if (successRateEl) {
      successRateEl.textContent = `${successRate}%`;
    }
  }
}

/**
 * Setup job cancellation functionality
 */
function setupJobCancellation(jobId) {
  const cancelBtn = document.getElementById('cancelJobBtn');
  if (cancelBtn && jobId) {
    cancelBtn.style.display = 'inline-block';
    cancelBtn.onclick = () => {
      if (confirm('Are you sure you want to cancel the current job?')) {
        showProgressIndicator(false);
        addLogEntry('Job cancelled by user', 'warning');
        
        // Return partial results if available
        if (processedResults.categorizedComments.length > 0) {
          addLogEntry(`Displaying ${processedResults.categorizedComments.length} partially processed comments`, 'info');
          const partialCategories = generateCategoriesFromComments(processedResults.categorizedComments, window.comments);
          displayProcessingResults(partialCategories, window.comments, true);
        }
        
        currentJobId = null;
      }
    };
  }
}

/**
 * Hide job cancellation button
 */
function hideJobCancellation() {
  const cancelBtn = document.getElementById('cancelJobBtn');
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
  }
}

/**
 * Enhanced processing method toggle (removing simulation option)
 */
export function setupProcessingMethodToggle() {
  const useApiRadio = document.getElementById('useApi');
  const useSimulationRadio = document.getElementById('useSimulation');
  const apiKeySection = document.getElementById('apiKeySection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  
  if (useApiRadio && apiKeySection && apiKeyInput) {
    // Check for stored API key
    const storedApiKey = localStorage.getItem('claudeApiKey');
    if (storedApiKey) {
      apiKeyInput.value = storedApiKey;
    }
    
    // Default to API mode (remove simulation as default)
    useApiRadio.checked = true;
    apiKeySection.style.display = 'block';
    
    // Add change event listeners
    document.querySelectorAll('input[name="processingMethod"]').forEach(radio => {
      radio.addEventListener('change', function() {
        apiKeySection.style.display = useApiRadio.checked ? 'block' : 'none';
      });
    });
    
    // Save API key when changed
    apiKeyInput.addEventListener('change', function() {
      localStorage.setItem('claudeApiKey', this.value);
    });
  }
}

/**
 * Setup tabs functionality
 */
export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', function() {
      // Remove active class from all tabs and content
      tabs.forEach(t => t.classList.remove('active'));
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Add active class to clicked tab
      this.classList.add('active');
      
      // Show corresponding content
      const targetTab = this.getAttribute('data-tab');
      const targetContent = document.getElementById(targetTab);
      if (targetContent) {
        targetContent.classList.add('active');
      }
    });
  });
}

/**
 * Setup comment entry functionality
 */
export function setupCommentEntry(addCommentHandler) {
  const commentInput = document.getElementById('commentInput');
  const addCommentBtn = document.getElementById('addCommentBtn');
  
  if (addCommentBtn && commentInput && addCommentHandler) {
    addCommentBtn.addEventListener('click', addCommentHandler);
    
    // Allow Enter key to add comment
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addCommentHandler();
      }
    });
  }
}

/**
 * Create add comment handler
 */
export function createAddCommentHandler(commentsArray) {
  return function() {
    const commentInput = document.getElementById('commentInput');
    const commentsList = document.getElementById('commentsList');
    
    if (!commentInput || !commentsList) return;
    
    const commentText = commentInput.value.trim();
    if (commentText) {
      // Add to array
      commentsArray.push(commentText);
      
      // Add to UI list
      const commentItem = document.createElement('div');
      commentItem.className = 'comment-item';
      commentItem.textContent = commentText;
      commentsList.appendChild(commentItem);
      
      // Clear input
      commentInput.value = '';
      
      // Update comment count if function exists
      if (window.updateCommentCount) {
        window.updateCommentCount();
      }
    }
  };
}

/**
 * Setup CSV upload functionality
 */
export function setupCSVUpload(commentsArray) {
  const csvFileInput = document.getElementById('csvFileInput');
  const loadCsvBtn = document.getElementById('loadCsvBtn');
  const fileInfo = document.getElementById('fileInfo');
  
  if (csvFileInput && loadCsvBtn && fileInfo) {
    csvFileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (file) {
        fileInfo.innerHTML = `Selected: ${file.name} (${formatFileSize(file.size)})`;
      } else {
        fileInfo.innerHTML = '';
      }
    });
    
    loadCsvBtn.addEventListener('click', function() {
      const file = csvFileInput.files[0];
      if (!file) {
        alert(getTranslation('select-csv', 'Please select a CSV file first.'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = function(e) {
        try {
          const csvContent = e.target.result;
          const extractedComments = processCSVContent(csvContent);
          
          if (extractedComments.length > 0) {
            // Add to comments array
            commentsArray.push(...extractedComments);
            
            // Update UI
            const commentsList = document.getElementById('commentsList');
            if (commentsList) {
              extractedComments.forEach(comment => {
                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.textContent = comment;
                commentsList.appendChild(commentItem);
              });
            }
            
            fileInfo.innerHTML += `<br>Loaded ${extractedComments.length} comments`;
            
            // Update comment count if function exists
            if (window.updateCommentCount) {
              window.updateCommentCount();
            }
          } else {
            alert('No valid comments found in the CSV file.');
          }
        } catch (error) {
          console.error('Error processing CSV:', error);
          alert('Error processing CSV file: ' + error.message);
        }
      };
      
      reader.readAsText(file);
    });
  }
}

/**
 * Setup action buttons with enhanced processing
 */
export function setupActionButtons(commentsArray, processFunction) {
  const processCommentsBtn = document.getElementById('processCommentsBtn');
  const clearCommentsBtn = document.getElementById('clearCommentsBtn');
  
  if (processCommentsBtn) {
    processCommentsBtn.addEventListener('click', async function() {
      if (commentsArray.length === 0) {
        alert(getTranslation('no-comments', 'Please add some comments first.'));
        return;
      }
      
      // Check processing method
      const useSimulation = document.getElementById('useSimulation').checked;
      
      try {
        await processFunction(commentsArray, useSimulation);
      } catch (error) {
        console.error('Processing failed:', error);
      }
    });
  }
  
  if (clearCommentsBtn) {
    clearCommentsBtn.addEventListener('click', function() {
      // Cancel any ongoing job
      if (currentJobId) {
        showProgressIndicator(false);
        currentJobId = null;
      }
      
      // Clear comments array
      commentsArray.length = 0;
      
      // Clear comments list UI
      const commentsList = document.getElementById('commentsList');
      if (commentsList) {
        commentsList.innerHTML = '';
      }
      
      // Clear results
      const categoriesContainer = document.getElementById('categoriesContainer');
      if (categoriesContainer) {
        categoriesContainer.innerHTML = '';
      }
      
      const overallStats = document.getElementById('overallStats');
      if (overallStats) {
        overallStats.style.display = 'none';
      }
      
      // Reset processed results
      processedResults = { categorizedComments: [], extractedTopics: [] };
    });
  }
}

/**
 * Add diagnostic button
 */
export function addDiagnosticButton(checkServerFunction) {
  const inputSection = document.querySelector('.input-section');
  if (inputSection && checkServerFunction) {
    const diagnosticBtn = document.createElement('button');
    diagnosticBtn.textContent = 'Test API Connection';
    diagnosticBtn.id = 'diagnosticBtn';
    diagnosticBtn.addEventListener('click', async function() {
      addLogEntry('Testing API connection...', 'info');
      try {
        const isAvailable = await checkServerFunction();
        if (isAvailable) {
          addLogEntry('API connection test successful! ✅', 'success');
        } else {
          addLogEntry('API connection test failed ❌', 'error');
        }
      } catch (error) {
        addLogEntry(`API connection test error: ${error.message} ❌`, 'error');
      }
    });
    
    // Insert before the debug log
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
      inputSection.insertBefore(diagnosticBtn, debugLog);
    }
  }
}

/**
 * Update overall statistics
 */
export function updateOverallStats(result, comments) {
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  
  if (overallStats && totalCommentsEl && categoryCountEl && avgSentimentEl && result.categories) {
    let totalSentiment = 0;
    result.categories.forEach(cat => totalSentiment += (cat.sentiment || 0));
    const avgSentiment = result.categories.length > 0 
      ? (totalSentiment / result.categories.length).toFixed(1) 
      : 0;
    
    totalCommentsEl.textContent = comments.length;
    categoryCountEl.textContent = result.categories.length;
    avgSentimentEl.textContent = avgSentiment;
    
    overallStats.style.display = 'block';
  }
}

/**
 * Toggle loader display
 */
export function toggleLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}

// Global progress update function
window.updateProgressDisplay = function(percentage, message, details = {}) {
  updateProgressIndicator(percentage, message, details);
};