// Store comments
let comments = [];

// Debug mode - set to true to enable debug logging
const DEBUG = true;

// DOM elements
document.addEventListener('DOMContentLoaded', function() {
  const commentInput = document.getElementById('commentInput');
  const addCommentBtn = document.getElementById('addCommentBtn');
  const commentsList = document.getElementById('commentsList');
  const processCommentsBtn = document.getElementById('processCommentsBtn');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const loader = document.getElementById('loader');
  const csvFileInput = document.getElementById('csvFileInput');
  const loadCsvBtn = document.getElementById('loadCsvBtn');
  const fileInfo = document.getElementById('fileInfo');
  const clearCommentsBtn = document.getElementById('clearCommentsBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const useSimulation = document.getElementById('useSimulation');
  const useApi = document.getElementById('useApi');
  const apiKeySection = document.getElementById('apiKeySection');
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  const debugLog = document.getElementById('debugLog');

  // Debugging function
  function debug(message, data) {
    if (!DEBUG) return;
    
    console.log(message, data);
    
    if (debugLog) {
      const timestamp = new Date().toLocaleTimeString();
      const dataStr = data ? (typeof data === 'object' ? JSON.stringify(data, null, 2) : data) : '';
      
      const logEntry = document.createElement('div');
      logEntry.innerHTML = `<strong>${timestamp}</strong>: ${message} ${dataStr}`;
      
      debugLog.appendChild(logEntry);
      debugLog.style.display = 'block';
      debugLog.scrollTop = debugLog.scrollHeight;
    }
  }

  // Log initialization
  debug("App initialized", {time: new Date().toISOString()});

  // Processing method selection
  useSimulation.addEventListener('change', updateProcessingMethod);
  useApi.addEventListener('change', updateProcessingMethod);
  
  function updateProcessingMethod() {
    if (useApi.checked) {
      apiKeySection.style.display = 'block';
    } else {
      apiKeySection.style.display = 'none';
    }
  }
  
  // Tab functionality
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and contents
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding content
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Add a comment to the list
  addCommentBtn.addEventListener('click', () => {
    const commentText = commentInput.value.trim();
    if (commentText) {
      comments.push(commentText);
      updateCommentsList();
      commentInput.value = '';
    }
  });
  
  // Also allow adding comments by pressing Enter in the input field
  commentInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addCommentBtn.click();
    }
  });
  
  // Clear all comments
  clearCommentsBtn.addEventListener('click', () => {
    comments = [];
    updateCommentsList();
    categoriesContainer.innerHTML = '';
    overallStats.style.display = 'none';
  });
  
  // Update the comments list display
  function updateCommentsList() {
    commentsList.innerHTML = '';
    comments.forEach((comment, index) => {
      const commentEl = document.createElement('div');
      commentEl.className = 'comment-item';
      commentEl.textContent = comment;
      commentsList.appendChild(commentEl);
    });
  }
  
  // Handle CSV file upload
  csvFileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (file) {
      fileInfo.textContent = `Selected file: ${file.name} (${formatFileSize(file.size)})`;
    }
  });
  
  // Load comments from CSV
  loadCsvBtn.addEventListener('click', () => {
    const file = csvFileInput.files[0];
    if (!file) {
      alert('Please select a CSV file first.');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseCSV(content);
    };
    reader.readAsText(file);
  });
  
  // Parse CSV content with improved error handling
  function parseCSV(content) {
    debug("Parsing CSV content", content.substring(0, 200) + "...");
    
    // Split by new lines
    const lines = content.split(/\r?\n/);
    
    if (lines.length === 0) {
      alert('The CSV file appears to be empty.');
      return;
    }
    
    // Clean up any quotes or extra whitespace in header
    const headers = lines[0].toLowerCase().trim().replace(/"/g, '').split(',');
    debug("CSV headers found", headers);
    
    // Check if there's a 'comment' column
    const commentColumnIndex = headers.indexOf('comment');
    debug("Comment column index", commentColumnIndex);
    
    let newComments = [];
    
    if (commentColumnIndex > -1) {
      // If there's a comment column, extract comments from that column
      debug("Extracting comments from 'comment' column");
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        try {
          // Handle CSV properly, dealing with possible quotes
          let columns;
          if (lines[i].includes('"')) {
            // Handle quoted values that might contain commas
            const matches = lines[i].match(/(?:^|,)("(?:[^"]*(?:""[^"]*)*)"|[^,]*)/g);
            if (matches) {
              columns = matches.map(m => 
                m.startsWith(',') ? m.substring(1) : m // Remove leading comma
              ).map(m => 
                m.startsWith('"') && m.endsWith('"') ? m.substring(1, m.length - 1).replace(/""/g, '"') : m // Handle quotes
              );
            } else {
              columns = lines[i].split(',');
            }
          } else {
            columns = lines[i].split(',');
          }
          
          debug(`Line ${i} columns`, columns);
          
          if (columns.length > commentColumnIndex && columns[commentColumnIndex].trim()) {
            newComments.push(columns[commentColumnIndex].trim());
          }
        } catch (e) {
          debug(`Error parsing line ${i}`, e.message);
          console.error("Error parsing CSV line", i, lines[i], e);
        }
      }
    } else {
      // Otherwise, treat each line as a comment (skipping the header)
      debug("No 'comment' column found, treating each line as comment");
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          newComments.push(lines[i].trim());
        }
      }
    }
    
    debug(`Extracted ${newComments.length} comments from CSV`);
    
    if (newComments.length === 0) {
      alert('No comments found in the CSV file. Make sure it has a "comment" column or one comment per line.');
      return;
    }
    
    // Add new comments to the existing list
    comments = comments.concat(newComments);
    updateCommentsList();
    
    alert(`Successfully loaded ${newComments.length} comments from CSV.`);
  }
  
  // Format file size
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' bytes';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
  }
  
  // Process comments
  processCommentsBtn.addEventListener('click', async () => {
    if (comments.length === 0) {
      alert('Please add some comments first.');
      return;
    }
    
    // Show loader
    loader.style.display = 'block';
    
    try {
      let categorizedComments;
      
      // Check if using API or simulation
      if (useApi.checked) {
        const apiKey = apiKeyInput.value.trim();
        if (!apiKey) {
          alert('Please enter your Claude API key.');
          loader.style.display = 'none';
          return;
        }
        
        debug("Using Claude API for processing", { commentCount: comments.length });
        
        try {
          categorizedComments = await processWithClaudeAPI(comments, apiKey);
        } catch (apiError) {
          console.error('API error:', apiError);
          debug("Claude API error, falling back to simulation", apiError.message);
          alert('There was an error connecting to the Claude API. Using simulation instead.\n\nError: ' + apiError.message + '\n\nNote: This app needs a backend server to proxy requests to Claude API.');
          categorizedComments = await simulateClaudeAPI(comments);
        }
      } else {
        debug("Using simulation for processing", { commentCount: comments.length });
        categorizedComments = await simulateClaudeAPI(comments);
      }
      
      debug("Received categorized comments", categorizedComments);
      displayCategorizedComments(categorizedComments);
    } catch (error) {
      console.error('Error processing comments:', error);
      debug("Error processing comments", error.message);
      alert('Error processing comments: ' + error.message);
    } finally {
      // Hide loader
      loader.style.display = 'none';
    }
  });
  
  // Process with Claude API - improved error handling and debugging
  async function processWithClaudeAPI(commentList, apiKey) {
    try {
      debug("Calling Claude API with", { commentCount: commentList.length });
      
      // In a real implementation, we call the backend proxy API
      const response = await fetch('/api/claude', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          comments: commentList,
          apiKey: apiKey
        })
      });
      
      debug("API response status", response.status);
      
      // Handle non-OK responses properly
      if (!response.ok) {
        let errorMessage = 'API request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.details || errorMessage;
        } catch (e) {
