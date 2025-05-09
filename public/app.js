const SERVER_URL = 'http://localhost:35343';

// Define comments array in global scope
window.comments = [];

// Current language - default to English
let currentLanguage = 'en';

// Add this function at the top of your app.js, before any other code
function getApiUrl(endpoint) {
  // Get the port from the server output
  const SERVER_PORT = 35343; // The port reported by your npm start command
  
  // Try different base URLs in this order of preference
  const possibleUrls = [
    `/api/${endpoint}`,                                  // Same-origin (relative URL)
    `http://localhost:${SERVER_PORT}/api/${endpoint}`,   // Explicit localhost with server port
    `http://127.0.0.1:${SERVER_PORT}/api/${endpoint}`    // Alternative IP format
  ];
  
  // Return the first URL by default, client code will try others if this fails
  return possibleUrls;
}

// Modify the processComments function - just update these sections:

// Replace the categorization fetch with:
const apiUrls = getApiUrl('categorize');
let categorizationResponse = null;
let fetchError = null;

// Try each possible URL until one works
for (const url of apiUrls) {
  try {
    if (debugLog) {
      debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Trying to connect to: ${url}</div>`;
    }
    
    categorizationResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        comments: window.comments,
        apiKey: apiKey
      }),
      timeout: 30000 // 30 seconds timeout
    });
    
    // If we got here, the fetch worked
    if (debugLog) {
      debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Connected successfully to: ${url}</div>`;
    }
    break;
  } catch (error) {
    console.error(`Failed to connect to ${url}:`, error);
    fetchError = error;
    // Continue to next URL
  }
}

// Check if all connection attempts failed
if (!categorizationResponse) {
  throw new Error(`Failed to connect to server: ${fetchError?.message || 'Unknown error'}`);
}

// Then check response as usual
if (!categorizationResponse.ok) {
  const errorText = await categorizationResponse.text();
  throw new Error(`API returned status ${categorizationResponse.status}: ${errorText}`);
}

// Similarly for the summarization endpoint, use the same pattern:
const summaryUrls = getApiUrl('summarize');
let summarizationResponse = null;

for (const url of summaryUrls) {
  try {
    if (debugLog) {
      debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Trying to connect to: ${url}</div>`;
    }
    
    summarizationResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        categorizedComments: categorizationResult.categorizedComments,
        extractedTopics: extractedTopics,
        apiKey: apiKey
      }),
      timeout: 30000 // 30 seconds timeout
    });
    
    // If we got here, the fetch worked
    break;
  } catch (error) {
    console.error(`Failed to connect to ${url}:`, error);
    // Continue to next URL
  }
}

// Check if all connection attempts failed
if (!summarizationResponse) {
  throw new Error('Failed to connect to server for summary generation');
}

// Then check response as usual
if (!summarizationResponse.ok) {
  const errorText = await summarizationResponse.text();
  throw new Error(`API returned status ${summarizationResponse.status}: ${errorText}`);
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
    console.error(`Language '${lang}' not found in translations`);
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
  alert(`Added ${commentsToAdd.length} comments from CSV file.`);
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

// Update the processComments function to handle topics and improved batch processing

// In the processComments function, update the error handling for API mode:
// Update the function to better handle server availability
async function processComments() {
  const loader = document.getElementById('loader');
  const categoriesContainer = document.getElementById('categoriesContainer');
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  const debugLog = document.getElementById('debugLog');
  
  // Show debug log
  if (debugLog) {
    debugLog.style.display = 'block';
    debugLog.innerHTML = ''; // Clear previous logs
    debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Starting comment processing...</div>`;
  }
  
  // Show loader
  loader.style.display = 'block';
  
  try {
    // Get API key if using API
    const useApi = document.getElementById('useApi').checked;
    const apiKey = useApi ? document.getElementById('apiKeyInput').value : null;
    
    let result;
    let extractedTopics = [];
    
    if (useApi && apiKey) {
      // Process with two-step approach using Claude API
      if (debugLog) {
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Using Claude API with two-step processing</div>`;
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Processing ${window.comments.length} comments...</div>`;
      }
      
      try {
        // Improved server connectivity check
        try {
          if (debugLog) {
            debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Checking server connectivity...</div>`;
          }
          
          const pingResponse = await fetch('/api/ping', { 
            method: 'HEAD',
            timeout: 3000 
          }).catch(() => {
            // Also try the root URL if /api/ping fails
            return fetch('/', { 
              method: 'HEAD',
              timeout: 3000 
            });
          });
          
          if (!pingResponse || !pingResponse.ok) {
            throw new Error('Server is not responding properly');
          }
          
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Server is available</div>`;
          }
        } catch (pingError) {
          console.error('Server connectivity check failed:', pingError);
          throw new Error('Cannot connect to server. Make sure the server is running. Using simulation mode instead.');
        }
        
        // Step 1: Categorize all comments
        if (debugLog) {
          debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Starting comment categorization...</div>`;
        }
        
        try {
          const categorizationResponse = await fetch(`${SERVER_URL}/api/categorize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              comments: window.comments,
              apiKey: apiKey
            }),
            // Add timeout to prevent long waiting times
            timeout: 60000 // 60 seconds timeout
          });
          
          if (!categorizationResponse.ok) {
            const errorText = await categorizationResponse.text();
            const statusCode = categorizationResponse.status;
            
            // Check specifically for 503 Service Unavailable
            if (statusCode === 503) {
              throw new Error(`Server unavailable (503). The server is likely not running. Please start the server using 'npm start' or use simulation mode.`);
            } else {
              throw new Error(`API returned status ${statusCode}: ${errorText}`);
            }
          }
          
          const categorizationResult = await categorizationResponse.json();
          
          if (debugLog) {
            const successRate = Math.round((categorizationResult.categorizedComments?.length || 0) / window.comments.length * 100);
            debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Categorization successful: ${categorizationResult.categorizedComments?.length || 0} of ${window.comments.length} comments (${successRate}%)</div>`;
            
            if (categorizationResult.extractedTopics?.length) {
              debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Extracted ${categorizationResult.extractedTopics.length} topics</div>`;
            }
          }
          
          // Store the extracted topics
          extractedTopics = categorizationResult.extractedTopics || [];
          
          // Step 2: Summarize categorized comments
          if (debugLog) {
            debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Summarizing ${categorizationResult.categorizedComments?.length || 0} categorized comments...</div>`;
          }
          
          const summarizationResponse = await fetch(`${SERVER_URL}/api/summarize`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              categorizedComments: categorizationResult.categorizedComments,
              extractedTopics: extractedTopics,
              apiKey: apiKey
            }),
            // Add timeout to prevent long waiting times
            timeout: 60000 // 60 seconds timeout
          });
          
          if (!summarizationResponse.ok) {
            const errorText = await summarizationResponse.text();
            throw new Error(`API returned status ${summarizationResponse.status}: ${errorText}`);
          }
          
          const summaryResult = await summarizationResponse.json();
          
          // Convert summary format to match the expected format for display
          result = {
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
            topTopics: summaryResult.topTopics || []
          };
          
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Summary generation successful</div>`;
          }
        } catch (apiError) {
          // This catch block handles API call errors
          console.error('API call error:', apiError);
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] API Error: ${apiError.message}</div>`;
          }
          throw apiError; // Re-throw to be caught by the outer catch block
        }
      } catch (error) {
        console.error('Error during two-step processing:', error);
        
        if (debugLog) {
          debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Processing Error: ${error.message}</div>`;
          debugLog.innerHTML += `<div style="color: orange">[${new Date().toLocaleTimeString()}] Falling back to simulation mode...</div>`;
        }
        
        // Show user-friendly message about server issues
        alert('Could not connect to the server for API processing: ' + error.message + '\n\nUsing simulation mode instead.');
        
        // Fall back to simulation
        result = simulateEnhancedCategories();
        extractedTopics = simulateTopTopics();
      }
    } else {
      // Use simulation
      if (debugLog) {
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Using simulation mode</div>`;
      }
      
      result = simulateEnhancedCategories();
      extractedTopics = simulateTopTopics();
    }
    
    // Clear previous results
    categoriesContainer.innerHTML = '';
    
    // Display results
    if (debugLog) {
      debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Displaying categorization results...</div>`;
    }
    
    // Display top topics first
    displayTopics(extractedTopics);
    
    // Then display categories
    displayResults(result);
    
    // Update stats
    if (overallStats && totalCommentsEl && categoryCountEl && avgSentimentEl) {
      overallStats.style.display = 'block';
      totalCommentsEl.textContent = window.comments.length;
      categoryCountEl.textContent = result.categories.length;
      
      // Calculate average sentiment
      const avgSentiment = result.categories.reduce((sum, category) => {
        return sum + (category.sentiment || 0);
      }, 0) / result.categories.length;
      
      avgSentimentEl.textContent = avgSentiment.toFixed(1);
    }
    
    // Log completion
    if (debugLog) {
      debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Comment processing completed successfully!</div>`;
    }
  } catch (error) {
    console.error('Error processing comments:', error);
    
    // Log error
    if (debugLog) {
      debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Processing Error: ${error.message}</div>`;
    }
    
    alert('Error processing comments: ' + error.message);
    
    // Try to fall back to simulation if there's an error
    try {
      result = simulateEnhancedCategories();
      extractedTopics = simulateTopTopics();
      
      // Clear previous results
      categoriesContainer.innerHTML = '';
      
      // Display simulated results
      displayTopics(extractedTopics);
      displayResults(result);
      
      // Update stats
      if (overallStats && totalCommentsEl && categoryCountEl && avgSentimentEl) {
        overallStats.style.display = 'block';
        totalCommentsEl.textContent = window.comments.length;
        categoryCountEl.textContent = result.categories.length;
        
        const avgSentiment = result.categories.reduce((sum, category) => {
          return sum + (category.sentiment || 0);
        }, 0) / result.categories.length;
        
        avgSentimentEl.textContent = avgSentiment.toFixed(1);
      }
      
      if (debugLog) {
        debugLog.innerHTML += `<div style="color: orange">[${new Date().toLocaleTimeString()}] Fallback to simulation was successful</div>`;
      }
    } catch (simError) {
      console.error('Error in simulation fallback:', simError);
      if (debugLog) {
        debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Simulation fallback also failed: ${simError.message}</div>`;
      }
    }
  } finally {
    // Hide loader
    loader.style.display = 'none';
  }
}

// Simulate categorization results using enhanced approach
function simulateEnhancedCategories() {
  const debugLog = document.getElementById('debugLog');
  
  if (debugLog) {
    debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Generating enhanced simulated categorization...</div>`;
  }
  
  // Predefined categories with topics and sentiment ranges
  const predefinedCategories = [
    {
      name: "Technical issues: App update",
      sentimentRange: [-0.8, -0.3],
      possibleTopics: ["App update", "Update failed", "Latest version", "Download issues"],
      commonIssues: [
        "Update failures",
        "App crashes after update",
        "Missing features in new update"
      ],
      suggestedActions: [
        "Improve update validation process",
        "Add rollback option for failed updates",
        "Better communicate new features"
      ]
    },
    {
      name: "Technical issues: App Freeze/Slow",
      sentimentRange: [-0.9, -0.5],
      possibleTopics: ["App freezing", "App slow", "Unresponsive", "Performance issues"],
      commonIssues: [
        "App freezes during specific actions",
        "Slow loading times",
        "Battery drain during use"
      ],
      suggestedActions: [
        "Optimize code for better performance",
        "Reduce background processes",
        "Investigate memory leaks"
      ]
    },
    {
      name: "Technical issues: App issues",
      sentimentRange: [-0.7, -0.2],
      possibleTopics: ["App problem", "Bug", "Not working right", "Error message"],
      commonIssues: [
        "Sporadic error messages",
        "Inconsistent behavior",
        "Feature malfunctions"
      ],
      suggestedActions: [
        "Expand automated testing",
        "Improve error logging",
        "Review user-reported bugs weekly"
      ]
    },
    {
      name: "Technical issues: Doesn't work",
      sentimentRange: [-0.9, -0.6],
      possibleTopics: ["Doesn't work", "Not functioning", "Broken", "Unusable"],
      commonIssues: [
        "Complete app failure",
        "Key features not working",
        "Compatibility issues with devices"
      ],
      suggestedActions: [
        "Establish emergency response team",
        "Create service status page",
        "Improve device compatibility testing"
      ]
    },
    {
      name: "Technical issues: Login and Access",
      sentimentRange: [-0.8, -0.3],
      possibleTopics: ["Login", "Password", "Can't access", "Account issues"],
      commonIssues: [
        "Failed login attempts",
        "Password reset not working",
        "Account lockouts"
      ],
      suggestedActions: [
        "Simplify password reset process",
        "Improve error messages for login issues",
        "Add alternative authentication methods"
      ]
    },
    {
      name: "Technical issues: Security",
      sentimentRange: [-0.7, 0.2],
      possibleTopics: ["Security", "Privacy", "Data protection", "Unauthorized access"],
      commonIssues: [
        "Privacy concerns",
        "Suspicious activity alerts",
        "Data handling questions"
      ],
      suggestedActions: [
        "Enhance data encryption",
        "Update privacy policy with clearer language",
        "Add two-factor authentication option"
      ]
    },
    {
      name: "Customer Feedback: Complicated",
      sentimentRange: [-0.6, -0.1],
      possibleTopics: ["Too complicated", "Confusing", "Hard to use", "Complex"],
      commonIssues: [
        "Confusing navigation",
        "Too many steps for simple tasks",
        "Overwhelming interface"
      ],
      suggestedActions: [
        "Conduct usability testing",
        "Simplify most common user flows",
        "Add interactive tutorials"
      ]
    },
    {
      name: "Customer Feedback: Customer Service",
      sentimentRange: [-0.8, 0.8],
      possibleTopics: ["Customer service", "Support", "Help", "Response time"],
      commonIssues: [
        "Slow response times",
        "Unhelpful support agents",
        "Difficulty finding contact information"
      ],
      suggestedActions: [
        "Reduce support response time targets",
        "Improve support agent training",
        "Make contact options more visible"
      ]
    },
    {
      name: "Customer Feedback: Design",
      sentimentRange: [-0.5, 0.8],
      possibleTopics: ["Design", "Interface", "Layout", "Appearance"],
      commonIssues: [
        "Outdated design",
        "Inconsistent UI elements",
        "Poor readability"
      ],
      suggestedActions: [
        "Refresh UI with modern design patterns",
        "Standardize visual elements",
        "Improve text contrast and readability"
      ]
    },
    {
      name: "Customer Feedback: Offensive",
      sentimentRange: [-0.9, -0.7],
      possibleTopics: ["Offensive", "Inappropriate", "Objectionable", "Disturbing"],
      commonIssues: [
        "Inappropriate content",
        "Offensive language",
        "Inadequate content filtering"
      ],
      suggestedActions: [
        "Strengthen content moderation",
        "Improve reporting mechanisms",
        "Review and update community guidelines"
      ]
    },
    {
      name: "Customer Feedback: Thank you",
      sentimentRange: [0.7, 1.0],
      possibleTopics: ["Thank you", "Great app", "Love it", "Appreciation"],
      commonIssues: [
        "Users want more features",
        "Requests for expanded services",
        "Suggestions from happy users"
      ],
      suggestedActions: [
        "Create loyalty program",
        "Feature positive testimonials",
        "Encourage reviews on app stores"
      ]
    },
    {
      name: "Monetary: Fraud",
      sentimentRange: [-1.0, -0.8],
      possibleTopics: ["Fraud", "Scam", "Unauthorized charge", "Suspicious activity"],
      commonIssues: [
        "Unauthorized transactions",
        "Fraudulent account activity",
        "Phishing attempts"
      ],
      suggestedActions: [
        "Implement advanced fraud detection",
        "Add transaction verification steps",
        "Educate users about security best practices"
      ]
    },
    {
      name: "Monetary: Pricing",
      sentimentRange: [-0.7, 0.3],
      possibleTopics: ["Price", "Cost", "Expensive", "Subscription"],
      commonIssues: [
        "Perceived high prices",
        "Unclear pricing structure",
        "Unexpected charges"
      ],
      suggestedActions: [
        "Review pricing strategy",
        "Make pricing more transparent",
        "Consider introducing tiered options"
      ]
    },
    {
      name: "Monetary: Refund Request",
      sentimentRange: [-0.8, -0.2],
      possibleTopics: ["Refund", "Money back", "Cancel", "Return"],
      commonIssues: [
        "Difficulty obtaining refunds",
        "Unclear refund policy",
        "Delayed refund processing"
      ],
      suggestedActions: [
        "Streamline refund process",
        "Make refund policy more prominent",
        "Improve refund status notifications"
      ]
    }
  ];
  
  // Create random distribution of comments among categories
  const categories = [];
  const assignedComments = new Set();
  
  // Determine how many categories to use based on comment count
  const numCategories = Math.min(
    predefinedCategories.length,
    Math.max(3, Math.ceil(window.comments.length / 10))
  );
  
  // Randomly select categories
  const selectedCategories = [];
  const shuffledCategories = [...predefinedCategories].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < numCategories; i++) {
    selectedCategories.push(shuffledCategories[i]);
  }
  
  // Distribute comments among categories
  for (let i = 0; i < selectedCategories.length; i++) {
    const categoryTemplate = selectedCategories[i];
    const categoryComments = [];
    
    // Assign approximately equal number of comments to each category
    const targetCount = Math.floor(window.comments.length / selectedCategories.length);
    
    // For each category, find unassigned comments
    for (let j = 0; j < window.comments.length && categoryComments.length < targetCount; j++) {
      if (!assignedComments.has(j)) {
        categoryComments.push(j + 1); // 1-based indexing for comments
        assignedComments.add(j);
      }
    }
    
    // Skip categories with no comments
    if (categoryComments.length === 0) continue;
    
    // Random sentiment within the category's range
    const sentRange = categoryTemplate.sentimentRange;
    const sentiment = sentRange[0] + Math.random() * (sentRange[1] - sentRange[0]);
    
    // Select random topics from possible topics
    const numTopics = Math.min(
      categoryTemplate.possibleTopics.length, 
      Math.max(1, Math.floor(Math.random() * 3) + 1)
    );
    
    const selectedTopics = [];
    const shuffledTopics = [...categoryTemplate.possibleTopics].sort(() => Math.random() - 0.5);
    
    for (let j = 0; j < numTopics; j++) {
      selectedTopics.push(shuffledTopics[j]);
    }
    
    // Create simulated summary based on topics
    let summary = `Users reported issues related to ${selectedTopics.join(', ')}. `;
    
    if (categoryComments.length > 1) {
      summary += `Across ${categoryComments.length} comments, common themes include ${categoryTemplate.commonIssues.slice(0, 2).join(' and ')}.`;
    } else {
      summary += `The comment mentioned ${categoryTemplate.commonIssues[0]}.`;
    }
    
    // Add to results
    categories.push({
      name: categoryTemplate.name,
      comments: categoryComments,
      summary: summary,
      sentiment: parseFloat(sentiment.toFixed(2)),
      commonIssues: categoryTemplate.commonIssues,
      suggestedActions: categoryTemplate.suggestedActions
    });
  }
  
  // Assign any remaining comments to random categories
  for (let j = 0; j < window.comments.length; j++) {
    if (!assignedComments.has(j)) {
      const randomCategoryIndex = Math.floor(Math.random() * categories.length);
      categories[randomCategoryIndex].comments.push(j + 1); // 1-based indexing
      assignedComments.add(j);
    }
  }
  
  if (debugLog) {
    debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Created ${categories.length} simulated categories</div>`;
  }
  
  return { categories };
}

// Original simulation function (fallback)
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
    const categoryName = `Category ${i + 1}`;
    
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
    const summary = `This is a simulated summary for ${categoryComments.length} comments in ${categoryName}.`;
    
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
  
  return { categories };
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
        <div class="category-count">${category.comments.length} ${translations[currentLanguage]['comments'] || 'comments'}</div>
      </div>
      <div class="category-summary">${escapeHtml(category.summary)}</div>
      <div class="sentiment-details">
        <span class="sentiment-emoji">${sentimentEmoji}</span>
        <div style="flex-grow: 1;">
          <div class="sentiment-label">
            <span>${translations[currentLanguage]['sentiment'] || 'Sentiment'}</span>
            <span>${category.sentiment.toFixed(1)}</span>
          </div>
          <div class="sentiment-bar-container">
            <div class="sentiment-bar ${sentimentClass}" style="width: ${sentimentPercentage}%"></div>
          </div>
          <div class="sentiment-label">
            <span>${translations[currentLanguage]['negative'] || 'Negative'}</span>
            <span>${translations[currentLanguage]['positive'] || 'Positive'}</span>
          </div>
        </div>
      </div>
      ${issuesAndActionsHtml}
      <button class="show-comments-btn" data-action="show">${translations[currentLanguage]['show-comments'] || 'Show Comments'}</button>
      <div class="category-comments">
        ${category.comments.map(commentIndex => {
          // Convert to 0-based index and ensure it's within bounds
          const index = commentIndex - 1; 
          const comment = index >= 0 && index < window.comments.length 
            ? window.comments[index] 
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

// Function to display top topics
function displayTopics(topics) {
  if (!topics || !Array.isArray(topics) || topics.length === 0) {
    return;
  }
  
  const topicsContainer = document.createElement('div');
  topicsContainer.className = 'topics-section';
  
  // Create section title
  const titleEl = document.createElement('h2');
  titleEl.textContent = translations[currentLanguage]['top-topics'] || 'Top Topics Mentioned';
  titleEl.className = 'topics-title';
  topicsContainer.appendChild(titleEl);
  
  // Create description
  const descEl = document.createElement('p');
  descEl.textContent = translations[currentLanguage]['topics-description'] || 
    'Click on a topic to see related comments.';
  descEl.className = 'topics-description';
  topicsContainer.appendChild(descEl);
  
  // Create topics cloud
  const cloudEl = document.createElement('div');
  cloudEl.className = 'topics-cloud';
  
  // Sort topics by count if not already sorted
  const sortedTopics = [...topics].sort((a, b) => (b.count || 0) - (a.count || 0));
  
  // Limit to top 30 topics for display
  const displayTopics = sortedTopics.slice(0, 30);
  
  // Create topic buttons
  displayTopics.forEach(topic => {
    const topicButton = document.createElement('button');
    topicButton.textContent = `${topic.topic} (${topic.count || 0})`;
    topicButton.className = 'topic-button';
    
    // Calculate size based on count (for visual emphasis)
    const minFontSize = 14;
    const maxFontSize = 24;
    const maxCount = displayTopics[0].count || 1;
    const fontSize = minFontSize + ((topic.count || 1) / maxCount) * (maxFontSize - minFontSize);
    
    topicButton.style.fontSize = `${fontSize}px`;
    
    // Add click handler to show related comments
    topicButton.addEventListener('click', () => {
      showCommentsForTopic(topic);
    });
    
    cloudEl.appendChild(topicButton);
  });
  
  topicsContainer.appendChild(cloudEl);
  
  // Create container for topic comments (initially empty)
  const topicCommentsEl = document.createElement('div');
  topicCommentsEl.className = 'topic-comments';
  topicCommentsEl.id = 'topicComments';
  topicsContainer.appendChild(topicCommentsEl);
  
  // Insert at the beginning of the categories container
  const categoriesContainer = document.getElementById('categoriesContainer');
  categoriesContainer.insertBefore(topicsContainer, categoriesContainer.firstChild);
}

// Function to show comments for a specific topic
function showCommentsForTopic(topic) {
  const topicCommentsEl = document.getElementById('topicComments');
  if (!topicCommentsEl) return;
  
  // Clear previous content
  topicCommentsEl.innerHTML = '';
  
  // Create topic header
  const headerEl = document.createElement('div');
  headerEl.className = 'topic-comments-header';
  
  const titleEl = document.createElement('h3');
  titleEl.textContent = `${topic.topic} (${topic.count || 0} comments)`;
  headerEl.appendChild(titleEl);
  
  // Add a close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'topic-close-btn';
  closeBtn.addEventListener('click', () => {
    topicCommentsEl.innerHTML = '';
    topicCommentsEl.style.display = 'none';
  });
  headerEl.appendChild(closeBtn);
  
  topicCommentsEl.appendChild(headerEl);
  
  // If we have topic summary, display it
  if (topic.summary) {
    const summaryEl = document.createElement('div');
    summaryEl.className = 'topic-summary';
    summaryEl.textContent = topic.summary;
    topicCommentsEl.appendChild(summaryEl);
  }
  
  // Create comments list
  const commentsListEl = document.createElement('div');
  commentsListEl.className = 'topic-comments-list';
  
  // If we have commentIds, use them
  if (topic.commentIds && Array.isArray(topic.commentIds)) {
    topic.commentIds.forEach(commentId => {
      const index = commentId - 1; // Convert to 0-based index
      
      if (index >= 0 && index < window.comments.length) {
        const commentText = window.comments[index];
        
        const commentEl = document.createElement('div');
        commentEl.className = 'topic-comment-item';
        commentEl.textContent = commentText;
        commentsListEl.appendChild(commentEl);
      }
    });
  } else {
    // Otherwise do a simple text search
    const keyword = topic.topic.toLowerCase();
    
    window.comments.forEach((comment, index) => {
      if (comment.toLowerCase().includes(keyword)) {
        const commentEl = document.createElement('div');
        commentEl.className = 'topic-comment-item';
        commentEl.textContent = comment;
        commentsListEl.appendChild(commentEl);
      }
    });
  }
  
  // If no comments found, show a message
  if (commentsListEl.children.length === 0) {
    const noCommentsEl = document.createElement('div');
    noCommentsEl.className = 'no-topic-comments';
    noCommentsEl.textContent = 'No comments found for this topic.';
    commentsListEl.appendChild(noCommentsEl);
  }
  
  topicCommentsEl.appendChild(commentsListEl);
  topicCommentsEl.style.display = 'block';
}

// Simulate top topics for when the API is unavailable
function simulateTopTopics() {
  // Generate random topics based on common words
  const topicTemplates = [
    { word: "app", type: "application" },
    { word: "website", type: "website" },
    { word: "product", type: "product" },
    { word: "service", type: "service" },
    { word: "company", type: "organization" },
    { word: "support", type: "service" },
    { word: "price", type: "feature" },
    { word: "quality", type: "feature" },
    { word: "feature", type: "feature" },
    { word: "design", type: "feature" },
    { word: "interface", type: "feature" },
    { word: "customer service", type: "service" },
    { word: "payment", type: "process" },
    { word: "delivery", type: "process" },
    { word: "account", type: "feature" },
    { word: "login", type: "feature" },
    { word: "registration", type: "process" },
    { word: "issue", type: "problem" },
    { word: "error", type: "problem" },
    { word: "bug", type: "problem" }
  ];
  
  // Generate a random count of topics
  const numTopics = Math.min(topicTemplates.length, Math.max(5, Math.ceil(window.comments.length / 50)));
  
  // Shuffle and pick topics
  const shuffledTopics = [...topicTemplates].sort(() => Math.random() - 0.5);
  const selectedTopics = shuffledTopics.slice(0, numTopics);
  
  // Create simulated topic data
  return selectedTopics.map((template, index) => {
    // Generate a random count proportional to the number of comments
    const maxCount = Math.min(window.comments.length, 100);
    const count = Math.max(2, Math.floor(Math.random() * maxCount));
    
    // Generate random comment IDs
    const commentIds = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * window.comments.length);
      commentIds.push(randomIndex + 1); // 1-based indexing
    }
    
    return {
      topic: template.word,
      type: template.type,
      count: count,
      commentIds: commentIds
    };
  });
}

// Add CSS for the new topic display
function addStylesForTopics() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .topics-section {
      margin-bottom: 30px;
      background: var(--dark-surface);
      border-radius: 6px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .topics-title {
      color: var(--dark-primary-hover);
      margin-top: 0;
    }
    
    .topics-description {
      color: var(--dark-text-secondary);
      margin-bottom: 15px;
    }
    
    .topics-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .topic-button {
      background-color: var(--dark-surface-lighter);
      color: var(--dark-primary);
      border: 1px solid var(--dark-primary);
      border-radius: 20px;
      padding: 5px 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin: 5px;
    }
    
    .topic-button:hover {
      background-color: var(--dark-primary);
      color: black;
    }
    
    .topic-comments {
      background: var(--dark-surface-lighter);
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
      border-left: 3px solid var(--dark-primary);
      display: none;
    }
    
    .topic-comments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .topic-comments-header h3 {
      margin: 0;
      color: var(--dark-primary-hover);
    }
    
    .topic-close-btn {
      background: transparent;
      color: var(--dark-text);
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0 5px;
      margin: 0;
    }
    
    .topic-comments-list {
      max-height: 400px;
      overflow-y: auto;
    }
    
    .topic-comment-item {
      padding: 10px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--dark-border);
    }
    
    .topic-summary {
      padding: 10px;
      margin-bottom: 15px;
      border-radius: 4px;
      background: rgba(226, 255, 102, 0.05);
      border: 1px solid rgba(226, 255, 102, 0.1);
    }
    
    .no-topic-comments {
      padding: 10px;
      text-align: center;
      color: var(--dark-text-secondary);
    }
    
    .rtl .topic-comments {
      border-left: none;
      border-right: 3px solid var(--dark-primary);
    }
  `;
  
  document.head.appendChild(styleEl);
}

// Initialize the topic styles when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  addStylesForTopics();
  
  // Add translations for topics
  if (translations.en) {
    translations.en['top-topics'] = 'Top Topics Mentioned';
    translations.en['topics-description'] = 'Click on a topic to see related comments.';
  }
  
  if (translations.ar) {
    translations.ar['top-topics'] = 'أكثر المواضيع ذكرًا';
    translations.ar['topics-description'] = 'انقر على موضوع لعرض التعليقات المتعلقة به.';
  }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    initApp();
  } catch(e) {
    console.error("Error initializing app:", e);
  }
});
