/**
 * Enhanced UI handler functions for real-time progress display
 * Updated to show results as they complete and remove simulation mode
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
    
    // Display final results
    addLogEntry('Processing complete! Displaying results...');
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
          displayProcessingResults(processedResults, comments, true); // true = partial results
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
        return processedResults; // Return partial results
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
      return await generateSummariesForResults(processedResults, comments, apiKey);
    }
    
    throw error;
  } finally {
    currentJobId = null;
    hideJobCancellation();
  }
}

/**
 * Generate summaries for results (either partial or final)
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
          displayProcessingResults(processedResults, window.comments, true);
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
 * Enhanced display processing results with partial results support
 */
export function displayProcessingResults(result, comments, isPartial = false) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  
  if (!result) {
    categoriesContainer.innerHTML = '<div class="error">No results available</div>';
    return;
  }
  
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
    displayTopics(result.extractedTopics, comments, categoriesContainer);
  }
  
  // Display categories
  displayResults(result, comments);
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
        await enhancedProcessComments(commentsArray, useSimulation);
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

// Export all the other existing functions
export {
  setupTabs,
  setupCommentEntry,
  createAddCommentHandler,
  setupCSVUpload,
  addDiagnosticButton,
  displayResults,
  updateOverallStats,
  toggleLoader
} from './ui-handlers.js';

// Global progress update function
window.updateProgressDisplay = function(percentage, message, details = {}) {
  updateProgressIndicator(percentage, message, details);
};