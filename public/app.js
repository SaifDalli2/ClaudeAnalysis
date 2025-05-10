// Set the server URL to connect to your Heroku instance
const SERVER_URL = 'https://comment-analyzer-e15255a314d2.herokuapp.com';

// Define comments array in global scope
window.comments = [];

// Current language - default to English
let currentLanguage = 'en';

// Function to check if the Heroku server is available
async function checkServerAvailability() {
  const debugLog = document.getElementById('debugLog');
  
  if (debugLog) {
    debugLog.style.display = 'block';
    debugLog.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] Checking Heroku server availability...</div>';
  }
  
  try {
    // Try to connect to the ping endpoint
    const pingResponse = await fetch(SERVER_URL + '/api/ping', {
      method: 'GET',
      mode: 'cors',
      cache: 'no-cache',
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });
    
    if (pingResponse.ok) {
      if (debugLog) {
        debugLog.innerHTML += '<div style="color: green">[' + new Date().toLocaleTimeString() + '] Heroku server is available! ✅</div>';
      }
      return true;
    } else {
      if (debugLog) {
        debugLog.innerHTML += '<div style="color: red">[' + new Date().toLocaleTimeString() + '] Heroku server returned status: ' + pingResponse.status + ' ❌</div>';
      }
      return false;
    }
  } catch (error) {
    if (debugLog) {
      debugLog.innerHTML += '<div style="color: red">[' + new Date().toLocaleTimeString() + '] Error connecting to Heroku: ' + error.message + ' ❌</div>';
      
      // Additional diagnostic information
      debugLog.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] Server URL: ' + SERVER_URL + '</div>';
      debugLog.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] Trying to access Heroku server directly...</div>';
    }
    
    // Try a simpler fetch that might work better for CORS issues
    try {
      const directFetch = await fetch(SERVER_URL, {
        method: 'GET',
        mode: 'no-cors' // This might help with CORS issues
      });
      
      if (debugLog) {
        debugLog.innerHTML += '<div style="color: orange">[' + new Date().toLocaleTimeString() + '] Direct connection with no-cors: ' + directFetch.type + '</div>';
      }
    } catch (directError) {
      if (debugLog) {
        debugLog.innerHTML += '<div style="color: red">[' + new Date().toLocaleTimeString() + '] Direct connection also failed: ' + directError.message + '</div>';
      }
    }
    
    return false;
  }
}

// Add a button to the UI to run this diagnostic
function addDiagnosticButton() {
  const inputSection = document.querySelector('.input-section');
  const debugLog = document.getElementById('debugLog');
  
  if (inputSection && debugLog) {
    const diagnosticBtn = document.createElement('button');
    diagnosticBtn.textContent = 'Run Server Diagnostics';
    diagnosticBtn.style.backgroundColor = '#4a4a5e'; // Different color to distinguish it
    diagnosticBtn.style.color = '#fff';
    diagnosticBtn.style.marginTop = '10px';
    
    diagnosticBtn.addEventListener('click', async function() {
      debugLog.style.display = 'block';
      debugLog.innerHTML = ''; // Clear previous logs
      debugLog.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] Starting server diagnostics...</div>';
      
      const isAvailable = await checkServerAvailability();
      
      if (isAvailable) {
        debugLog.innerHTML += '<div style="color: green">[' + new Date().toLocaleTimeString() + '] Server connection successful! You can use API mode.</div>';
      } else {
        debugLog.innerHTML += '<div style="color: orange">[' + new Date().toLocaleTimeString() + '] Server connection failed. Please use Simulation mode for now.</div>';
        debugLog.innerHTML += '<div>[' + new Date().toLocaleTimeString() + '] Common causes of this error:</div>';
        debugLog.innerHTML += '<div>- Heroku server is in sleep mode (first request may take up to 30 seconds to wake it)</div>';
        debugLog.innerHTML += '<div>- Server URL is incorrect (currently using: ' + SERVER_URL + ')</div>';
        debugLog.innerHTML += '<div>- CORS settings on the server need adjustment</div>';
        debugLog.innerHTML += '<div>- Heroku app is not running or has crashed</div>';
      }
    });
    
    // Insert the button right before the debug log
    inputSection.insertBefore(diagnosticBtn, debugLog);
  }
}

// Initialize the app
function initApp() {
  console.log("App initialized successfully");
  
  // Initialize language
  initializeLanguage();
  
  // Setup tabs functionality
  setupTabs();
  
  // Setup API/Simulation toggle
  setupProcessingMethodToggle();
  
  // Setup comment entry functionality
  setupCommentEntry();
  
  // Setup CSV upload functionality
  setupCSVUpload();
  
  // Setup process/clear buttons
  setupActionButtons();
  
  // Add diagnostic button
  addDiagnosticButton();
}

// Initialize language
function initializeLanguage() {
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    // Check for stored language preference
    const storedLanguage = localStorage.getItem('preferredLanguage');
    if (storedLanguage) {
      currentLanguage = storedLanguage;
      languageSelector.value = currentLanguage;
    }
    
    // Apply stored/default language
    applyLanguage(currentLanguage);
    
    // Add change event listener
    languageSelector.addEventListener('change', function() {
      currentLanguage = this.value;
      localStorage.setItem('preferredLanguage', currentLanguage);
      applyLanguage(currentLanguage);
    });
  }
}

// Apply language translations
function applyLanguage(lang) {
  if (!translations[lang]) {
    console.error('Language "' + lang + '" not found in translations');
    return;
  }
  
  // Apply RTL for Arabic
  document.body.classList.toggle('rtl', lang === 'ar');
  
  // Update all elements with data-lang-key attribute
  document.querySelectorAll('[data-lang-key]').forEach(element => {
    const key = element.getAttribute('data-lang-key');
    if (translations[lang][key]) {
      // Handle different element types
      if (element.tagName === 'INPUT' && element.getAttribute('type') === 'text' || 
          element.tagName === 'TEXTAREA' || 
          element.tagName === 'INPUT' && element.getAttribute('type') === 'password') {
        element.placeholder = translations[lang][key];
      } else {
        element.textContent = translations[lang][key];
      }
    }
  });
}

// Setup tabs functionality
function setupTabs() {
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

// Setup API/Simulation toggle
function setupProcessingMethodToggle() {
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

// Setup comment entry functionality
function setupCommentEntry() {
  const addCommentBtn = document.getElementById('addCommentBtn');
  const commentInput = document.getElementById('commentInput');
  const commentsList = document.getElementById('commentsList');
  
  if (addCommentBtn && commentInput && commentsList) {
    addCommentBtn.addEventListener('click', function() {
      addComment();
    });
    
    // Also allow Enter key to add comment
    commentInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        addComment();
      }
    });
    
    console.log("Comment functionality enabled");
  }
}

// Add a comment
function addComment() {
  const commentInput = document.getElementById('commentInput');
  const commentsList = document.getElementById('commentsList');
  
  const text = commentInput.value.trim();
  if (text) {
    window.comments.push(text);
    
    // Add to list
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.textContent = text;
    commentsList.appendChild(item);
    
    // Clear input
    commentInput.value = '';
  }
}

// Setup CSV upload functionality
function setupCSVUpload() {
  const csvFileInput = document.getElementById('csvFileInput');
  const loadCsvBtn = document.getElementById('loadCsvBtn');
  const fileInfo = document.getElementById('fileInfo');
  
  if (csvFileInput && loadCsvBtn && fileInfo) {
    csvFileInput.addEventListener('change', function() {
      const file = this.files[0];
      if (file) {
        fileInfo.textContent = file.name + ' (' + formatFileSize(file.size) + ')';
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
          processCSV(content);
        };
        reader.readAsText(file);
      } else {
        alert(translations[currentLanguage]['select-csv'] || 'Please select a CSV file first.');
      }
    });
  }
}

// Process CSV content
function processCSV(content) {
  const commentsList = document.getElementById('commentsList');
  
  // Basic CSV parsing (can be improved with a library like PapaParse)
  const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim());
  
  // Check if it's a simple list or has a header row
  let commentsToAdd = [];
  
  if (lines[0].toLowerCase().includes('comment')) {
    // This is likely a CSV with headers
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      // Try to find the comment column
      let commentText = '';
      for (let col of columns) {
        col = col.trim();
        if (col && col.length > 5) {  // Simple heuristic to find the comment column
          commentText = col.replace(/^["']|["']$/g, ''); // Remove quotes
          break;
        }
      }
      if (commentText) {
        commentsToAdd.push(commentText);
      }
    }
  } else {
    // Simple list of comments
    commentsToAdd = lines.map(line => line.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
  }
  
  // Add comments to the UI and array
  for (const comment of commentsToAdd) {
    window.comments.push(comment);
    
    const item = document.createElement('div');
    item.className = 'comment-item';
    item.textContent = comment;
    commentsList.appendChild(item);
  }
  
  // Show a notification
  alert('Added ' + commentsToAdd.length + ' comments from CSV file.');
}

// Format file size to human-readable format
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}

// Setup process/clear buttons
function setupActionButtons() {
  const processCommentsBtn = document.getElementById('processCommentsBtn');
  const clearCommentsBtn = document.getElementById('clearCommentsBtn');
  const loader = document.getElementById('loader');
  const commentsList = document.getElementById('commentsList');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const overallStats = document.getElementById('overallStats');
  
  if (processCommentsBtn && loader && categoriesContainer) {
    processCommentsBtn.addEventListener('click', function() {
      if (window.comments.length === 0) {
        alert(translations[currentLanguage]['no-comments'] || 'Please add some comments first.');
        return;
      }
      
      processComments();
    });
  }
  
  if (clearCommentsBtn && commentsList) {
    clearCommentsBtn.addEventListener('click', function() {
      // Clear comments array
      window.comments = [];
      
      // Clear comments list UI
      commentsList.innerHTML = '';
      
      // Clear results
      if (categoriesContainer) categoriesContainer.innerHTML = '';
      if (overallStats) overallStats.style.display = 'none';
    });
  }
}

// Simulate categorization results
function simulateCategories() {
  // Create random categories based on the comments
  const categories = [];
  const sentiments = [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8];
  
  // Create 2-4 categories
  const numCategories = Math.max(2, Math.min(4, Math.ceil(window.comments.length / 3)));
  
  // Distribute comments among categories
  const assignedComments = new Set();
  
  for (let i = 0; i < numCategories; i++) {
    const categoryComments = [];
    const categoryName = 'Category ' + (i + 1);
    
    // Assign comments to this category
    const targetCount = Math.floor(window.comments.length / numCategories);
    
    // For each category, find unassigned comments
    for (let j = 0; j < window.comments.length && categoryComments.length < targetCount; j++) {
      if (!assignedComments.has(j)) {
        categoryComments.push(j + 1); // 1-based indexing for comments
        assignedComments.add(j);
      }
    }
    
    // Random sentiment
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    
    // Create simulated summary
    const summary = 'This is a simulated summary for ' + categoryComments.length + ' comments in ' + categoryName + '.';
    
    categories.push({
      name: categoryName,
      comments: categoryComments,
      summary: summary,
      sentiment: sentiment
    });
  }
  
  // Assign any remaining comments to random categories
  for (let j = 0; j < window.comments.length; j++) {
    if (!assignedComments.has(j)) {
      const randomCategory = Math.floor(Math.random() * categories.length);
      categories[randomCategory].comments.push(j + 1); // 1-based indexing
      assignedComments.add(j);
    }
  }
  
  return { categories: categories };
}

// Process comments function - simplified version
function processComments() {
  const loader = document.getElementById('loader');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  
  // Show loader
  loader.style.display = 'block';
  
  try {
    // For simplicity, just use simulation mode
    const result = simulateCategories();
    
    // Process and display the results
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
        totalCommentsEl.textContent = window.comments.length;
        categoryCountEl.textContent = result.categories.length;
        avgSentimentEl.textContent = avgSentiment;
        
        // Show stats
        overallStats.style.display = 'block';
      }
      
      // Clear previous categories
      categoriesContainer.innerHTML = '';
      
      // Display categories
      displayResults(result);
    } else {
      categoriesContainer.innerHTML = '<div class="error">No categories found</div>';
    }
    
  } catch (error) {
    console.error('Error processing comments:', error);
    
    // Show error
    categoriesContainer.innerHTML = '<div class="error">Error processing comments: ' + error.message + '</div>';
  } finally {
    // Hide loader
    loader.style.display = 'none';
  }
}

// Display categorization results
function displayResults(result) {
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
    
    // Create HTML structure for the category
    categoryEl.innerHTML = 
      '<div class="category-header">' +
        '<div class="category-name">' + escapeHtml(category.name) + '</div>' +
        '<div class="category-count">' + category.comments.length + ' ' + (translations[currentLanguage]['comments'] || 'comments') + '</div>' +
      '</div>' +
      '<div class="category-summary">' + escapeHtml(category.summary) + '</div>' +
      '<div class="sentiment-details">' +
        '<span class="sentiment-emoji">' + sentimentEmoji + '</span>' +
        '<div style="flex-grow: 1;">' +
          '<div class="sentiment-label">' +
            '<span>' + (translations[currentLanguage]['sentiment'] || 'Sentiment') + '</span>' +
            '<span>' + category.sentiment.toFixed(1) + '</span>' +
          '</div>' +
          '<div class="sentiment-bar-container">' +
            '<div class="sentiment-bar ' + sentimentClass + '" style="width: ' + sentimentPercentage + '%"></div>' +
          '</div>' +
          '<div class="sentiment-label">' +
            '<span>' + (translations[currentLanguage]['negative'] || 'Negative') + '</span>' +
            '<span>' + (translations[currentLanguage]['positive'] || 'Positive') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button class="show-comments-btn" data-action="show">' + (translations[currentLanguage]['show-comments'] || 'Show Comments') + '</button>' +
      '<div class="category-comments">' +
        category.comments.map(commentIndex => {
          // Convert to 0-based index and ensure it's within bounds
          const index = commentIndex - 1; 
          const comment = index >= 0 && index < window.comments.length 
            ? window.comments[index] 
            : '[Comment #' + commentIndex + ' not found]';
          return '<div class="category-comment">' + escapeHtml(comment) + '</div>';
        }).join('') +
      '</div>';
    
    // Add click handler for show/hide comments button
    const showHideBtn = categoryEl.querySelector('.show-comments-btn');
    const commentsDiv = categoryEl.querySelector('.category-comments');
    
    showHideBtn.addEventListener('click', function() {
      const action = this.getAttribute('data-action');
      if (action === 'show') {
        commentsDiv.style.display = 'block';
        this.textContent = translations[currentLanguage]['hide-comments'] || 'Hide Comments';
        this.setAttribute('data-action', 'hide');
      } else {
        commentsDiv.style.display = 'none';
        this.textContent = translations[currentLanguage]['show-comments'] || 'Show Comments';
        this.setAttribute('data-action', 'show');
      }
    });
    
    categoriesContainer.appendChild(categoryEl);
  });
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    initApp();
  } catch(e) {
    console.error("Error initializing app:", e);
  }
});