/**
 * UI handler functions for the Comment Categorization application
 */
import { 
  getCurrentLanguage, 
  escapeHtml, 
  processCSVContent, 
  addLogEntry,
  clearLogs,
  getTranslation,
  formatFileSize  // Added this import
} from './utils.js';
import { displayTopics } from './topic-visualizer.js';

/**
 * Set up tabs functionality
 */
export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  if (tabs.length) {
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        // Remove active class from all tabs
        tabs.forEach(t => t.classList.remove('active'));
        
        // Add active class to clicked tab
        this.classList.add('active');
        
        // Hide all tab content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
        });
        
        // Show related tab content
        const tabId = this.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }
}

/**
 * Set up API/Simulation toggle
 */
export function setupProcessingMethodToggle() {
  const useApiRadio = document.getElementById('useApi');
  const apiKeySection = document.getElementById('apiKeySection');
  const apiKeyInput = document.getElementById('apiKeyInput');
  
  if (useApiRadio && apiKeySection && apiKeyInput) {
    // Check for stored API key
    const storedApiKey = localStorage.getItem('claudeApiKey');
    if (storedApiKey) {
      apiKeyInput.value = storedApiKey;
    }
    
    // Set initial state
    apiKeySection.style.display = useApiRadio.checked ? 'block' : 'none';
    
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
 * Set up comment entry functionality
 * @param {Function} addCommentCallback - Callback function to add a comment
 */
export function setupCommentEntry(addCommentCallback) {
  const addCommentBtn = document.getElementById('addCommentBtn');
  const commentInput = document.getElementById('commentInput');
  
  if (addCommentBtn && commentInput) {
    addCommentBtn.addEventListener('click', function() {
      if (typeof addCommentCallback === 'function') {
        addCommentCallback();
      }
    });
    
    // Also allow Enter key to add comment
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (typeof addCommentCallback === 'function') {
          addCommentCallback();
        }
      }
    });
  }
}

/**
 * Add a comment to the UI and global comments array
 * @param {Array<string>} commentsArray - Global comments array
 * @returns {Function} Callback function to add a comment
 */
export function createAddCommentHandler(commentsArray) {
  return function() {
    const commentInput = document.getElementById('commentInput');
    const commentsList = document.getElementById('commentsList');
    
    const text = commentInput.value.trim();
    if (text) {
      commentsArray.push(text);
      
      // Add to list
      const item = document.createElement('div');
      item.className = 'comment-item';
      item.textContent = text;
      commentsList.appendChild(item);
      
      // Clear input
      commentInput.value = '';
    }
  };
}

/**
 * Set up CSV upload functionality
 * @param {Array<string>} commentsArray - Global comments array
 */
export function setupCSVUpload(commentsArray) {
  const csvFileInput = document.getElementById('csvFileInput');
  const loadCsvBtn = document.getElementById('loadCsvBtn');
  const fileInfo = document.getElementById('fileInfo');
  
  if (csvFileInput && loadCsvBtn && fileInfo) {
    csvFileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (file) {
        fileInfo.textContent = `${file.name} (${formatFileSize(file.size)})`;
      } else {
        fileInfo.textContent = '';
      }
    });
    
    loadCsvBtn.addEventListener('click', function() {
      const file = csvFileInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
          const content = e.target.result;
          
          // Process CSV and get comments
          const commentsToAdd = processCSVContent(content);
          
          // Add comments to UI and array
          const commentsList = document.getElementById('commentsList');
          for (const comment of commentsToAdd) {
            commentsArray.push(comment);
            
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.textContent = comment;
            commentsList.appendChild(item);
          }
          
          // Show a notification
          alert(`Added ${commentsToAdd.length} comments from CSV file.`);
        };
        reader.readAsText(file);
      } else {
        alert(getTranslation('select-csv', 'Please select a CSV file first.'));
      }
    });
  }
}

/**
 * Set up process/clear buttons
 * @param {Array<string>} commentsArray - Global comments array
 * @param {Function} processFunction - Function to process comments
 */
export function setupActionButtons(commentsArray, processFunction) {
  const processCommentsBtn = document.getElementById('processCommentsBtn');
  const clearCommentsBtn = document.getElementById('clearCommentsBtn');
  
  if (processCommentsBtn) {
    processCommentsBtn.addEventListener('click', function() {
      if (commentsArray.length === 0) {
        alert(getTranslation('no-comments', 'Please add some comments first.'));
        return;
      }
      
      if (typeof processFunction === 'function') {
        processFunction();
      }
    });
  }
  
  if (clearCommentsBtn) {
    clearCommentsBtn.addEventListener('click', function() {
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
    });
  }
}

/**
 * Add server diagnostic button
 * @param {Function} checkServerAvailability - Function to check server availability
 */
export function addDiagnosticButton(checkServerAvailability) {
  const inputSection = document.querySelector('.input-section');
  const debugLog = document.getElementById('debugLog');
  
  if (inputSection && debugLog && typeof checkServerAvailability === 'function') {
    const diagnosticBtn = document.createElement('button');
    diagnosticBtn.textContent = 'Run Server Diagnostics';
    diagnosticBtn.style.backgroundColor = '#4a4a5e';
    diagnosticBtn.style.color = '#fff';
    diagnosticBtn.style.marginTop = '10px';
    
    diagnosticBtn.addEventListener('click', async () => {
      debugLog.style.display = 'block';
      clearLogs();
      addLogEntry('Starting server diagnostics...');
      
      const isAvailable = await checkServerAvailability();
      
      if (isAvailable) {
        addLogEntry('Server connection successful! You can use API mode.', 'success');
      } else {
        addLogEntry('Server connection failed. Please use Simulation mode for now.', 'warning');
        addLogEntry('Common causes of this error:');
        addLogEntry('- Heroku server is in sleep mode (first request may take up to 30 seconds to wake it)');
        addLogEntry('- Server URL is incorrect');
        addLogEntry('- CORS settings on the server need adjustment');
        addLogEntry('- Heroku app is not running or has crashed');
      }
    });
    
    // Insert the button right before the debug log
    inputSection.insertBefore(diagnosticBtn, debugLog);
  }
}

/**
 * Display categorization results
 * @param {Object} result - Categorization results
 * @param {Array<string>} comments - Global comments array
 */
export function displayResults(result, comments) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  
  if (!result || !result.categories || !Array.isArray(result.categories)) {
    categoriesContainer.innerHTML = '<div class="error">Invalid result format</div>';
    return;
  }
  
  // Display each category
  result.categories.forEach(category => {
    const categoryEl = document.createElement('div');
    categoryEl.className = 'category-card';
    
    // Get sentiment class
    const sentimentClass = category.sentiment > 0.3
      ? 'sentiment-positive'
      : category.sentiment < -0.3
        ? 'sentiment-negative'
        : 'sentiment-neutral';
    
    // Get sentiment emoji
    const sentimentEmoji = category.sentiment > 0.3
      ? '😃'
      : category.sentiment < -0.3
        ? '😞'
        : '😐';
    
    // Calculate sentiment percentage for the progress bar (convert -1 to 1 range to 0 to 100%)
    const sentimentPercentage = Math.round((category.sentiment + 1) / 2 * 100);
    
    // Create common issues and suggested actions HTML if available
    let issuesAndActionsHtml = '';
    if (category.commonIssues && category.commonIssues.length > 0) {
      issuesAndActionsHtml += `
        <div class="category-issues">
          <h4>Common Issues:</h4>
          <ul>
            ${category.commonIssues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    if (category.suggestedActions && category.suggestedActions.length > 0) {
      issuesAndActionsHtml += `
        <div class="category-actions">
          <h4>Suggested Actions:</h4>
          <ul>
            ${category.suggestedActions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}
          </ul>
        </div>
      `;
    }
    
    // Create HTML structure for the category
    categoryEl.innerHTML = `
      <div class="category-header">
        <div class="category-name">${escapeHtml(category.name)}</div>
        <div class="category-count">${category.comments.length} ${getTranslation('comments', 'comments')}</div>
      </div>
      <div class="category-summary">${escapeHtml(category.summary)}</div>
      <div class="sentiment-details">
        <span class="sentiment-emoji">${sentimentEmoji}</span>
        <div style="flex-grow: 1;">
          <div class="sentiment-label">
            <span>${getTranslation('sentiment', 'Sentiment')}:</span>
            <span>${category.sentiment.toFixed(1)}</span>
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
      ${issuesAndActionsHtml}
      <button class="show-comments-btn" data-action="show">${getTranslation('show-comments', 'Show Comments')}</button>
      <div class="category-comments">
        ${category.comments.map(commentIndex => {
          // Convert to 0-based index and ensure it's within bounds
          const index = commentIndex - 1; 
          const comment = index >= 0 && index < comments.length 
            ? comments[index] 
            : `[Comment #${commentIndex} not found]`;
          return `<div class="category-comment">${escapeHtml(comment)}</div>`;
        }).join('')}
      </div>
    `;
    
    // Add click handler for show/hide comments button
    const showHideBtn = categoryEl.querySelector('.show-comments-btn');
    const commentsDiv = categoryEl.querySelector('.category-comments');
    
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
    
    categoriesContainer.appendChild(categoryEl);
  });
}

/**
 * Update overall statistics
 * @param {Object} result - Categorization results
 * @param {Array<string>} comments - Global comments array
 */
export function updateOverallStats(result, comments) {
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  
  if (result && result.categories && result.categories.length > 0) {
    // Calculate average sentiment
    let totalSentiment = 0;
    let sentimentCount = 0;
    
    result.categories.forEach(category => {
      if (typeof category.sentiment === 'number') {
        totalSentiment += category.sentiment;
        sentimentCount++;
      }
    });
    
    const avgSentiment = sentimentCount > 0 ? (totalSentiment / sentimentCount).toFixed(1) : 0;
    
    // Update stats UI
    if (overallStats && totalCommentsEl && categoryCountEl && avgSentimentEl) {
      totalCommentsEl.textContent = comments.length;
      categoryCountEl.textContent = result.categories.length;
      avgSentimentEl.textContent = avgSentiment;
      
      // Show stats
      overallStats.style.display = 'block';
    }
  }
}

/**
 * Display processing results with topics and categories
 * @param {Object} result - Processing results
 * @param {Array<string>} comments - Global comments array
 */
export function displayProcessingResults(result, comments) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  const overallStats = document.getElementById('overallStats');
  
  if (!result) {
    categoriesContainer.innerHTML = '<div class="error">No results available</div>';
    return;
  }
  
  // Update statistics
  updateOverallStats(result, comments);
  
  // Clear previous categories
  categoriesContainer.innerHTML = '';
  
  // Display topic cloud if available
  if (result.extractedTopics && result.extractedTopics.length) {
    displayTopics(result.extractedTopics, comments, categoriesContainer);
  }
  
  // Display categories
  displayResults(result, comments);
}

/**
 * Show or hide the loader
 * @param {boolean} show - Whether to show the loader
 */
export function toggleLoader(show) {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = show ? 'block' : 'none';
  }
}