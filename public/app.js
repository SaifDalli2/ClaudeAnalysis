// Define comments array in global scope
window.comments = [];

// Current language - default to English
let currentLanguage = 'en';

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

// Update the processComments function to implement two-step processing

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
    
    if (useApi && apiKey) {
      // Process with two-step approach using Claude API
      if (debugLog) {
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Using Claude API with two-step processing</div>`;
      }
      
      // Check if there are too many comments to process at once
      if (window.comments.length > 1000) {
        if (debugLog) {
          debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Processing ${window.comments.length} comments in batches of 1000</div>`;
        }
        
        // Process in batches of 1000 comments
        const batches = [];
        for (let i = 0; i < window.comments.length; i += 1000) {
          batches.push(window.comments.slice(i, i + 1000));
        }
        
        let allCategorizedComments = [];
        
        // Step 1: Categorize all comments in batches
        for (let i = 0; i < batches.length; i++) {
          const batchComments = batches[i];
          const batchStart = i * 1000 + 1;
          
          if (debugLog) {
            debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Categorizing batch ${i+1} of ${batches.length} (comments ${batchStart} to ${batchStart + batchComments.length - 1})</div>`;
          }
          
          try {
            const response = await fetch('/api/categorize', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                comments: batchComments,
                apiKey: apiKey
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`API returned status ${response.status}: ${errorText}`);
            }
            
            const batchCategorized = await response.json();
            
            // Adjust comment IDs to match global index
            batchCategorized.categorizedComments.forEach(item => {
              item.id = item.id + batchStart - 1;
            });
            
            allCategorizedComments = [...allCategorizedComments, ...batchCategorized.categorizedComments];
            
            if (debugLog) {
              debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Batch ${i+1} categorization successful</div>`;
            }
          } catch (error) {
            console.error(`Error categorizing batch ${i+1}:`, error);
            if (debugLog) {
              debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Batch ${i+1} Error: ${error.message}</div>`;
            }
            // Continue with next batch instead of stopping completely
          }
        }
        
        if (allCategorizedComments.length === 0) {
          throw new Error("Failed to categorize any comments. Falling back to simulation.");
        }
        
        // Step 2: Summarize all categorized comments
        if (debugLog) {
          debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Summarizing ${allCategorizedComments.length} categorized comments</div>`;
        }
        
        try {
          const response = await fetch('/api/summarize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              categorizedComments: allCategorizedComments,
              apiKey: apiKey
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errorText}`);
          }
          
          const summaryResult = await response.json();
          
          // Convert summary format to match the expected format for display
          result = {
            categories: summaryResult.summaries.map(summary => {
              // Find all comments for this category
              const categoryComments = allCategorizedComments
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
            })
          };
          
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] Summary generation successful</div>`;
          }
        } catch (error) {
          console.error('Error generating summaries:', error);
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Summary Error: ${error.message}</div>`;
          }
          
          // Create a simplified result based on categorization only
          result = {
            categories: Object.entries(
              allCategorizedComments.reduce((acc, item) => {
                if (!acc[item.category]) {
                  acc[item.category] = {
                    name: item.category,
                    comments: [],
                    topics: new Set()
                  };
                }
                acc[item.category].comments.push(item.id);
                item.topics.forEach(topic => acc[item.category].topics.add(topic));
                return acc;
              }, {})
            ).map(([category, data]) => ({
              name: data.name,
              comments: data.comments,
              summary: `Contains comments about: ${Array.from(data.topics).join(', ')}`,
              sentiment: 0 // Neutral sentiment as fallback
            }))
          };
        }
      } else {
        // For smaller sets, use the original single-step approach
        if (debugLog) {
          debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Processing ${window.comments.length} comments with original approach</div>`;
        }
        
        try {
          const response = await fetch('/api/claude', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              comments: window.comments,
              apiKey: apiKey
            })
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API returned status ${response.status}: ${errorText}`);
          }
          
          result = await response.json();
          
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: green">[${new Date().toLocaleTimeString()}] API categorization successful!</div>`;
          }
        } catch (error) {
          console.error('Error calling Claude API:', error);
          
          if (debugLog) {
            debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] API Error: ${error.message}</div>`;
            debugLog.innerHTML += `<div style="color: orange">[${new Date().toLocaleTimeString()}] Falling back to simulation mode...</div>`;
          }
          
          // Fall back to simulation
          result = simulateCategories();
        }
      }
    } else {
      // Use simulation
      if (debugLog) {
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Using simulation mode</div>`;
      }
      
      result = simulateEnhancedCategories();
    }
    
    // Clear previous results
    categoriesContainer.innerHTML = '';
    
    // Display results
    if (debugLog) {
      debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Displaying categorization results...</div>`;
    }
    
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
      
      // Clear previous results
      categoriesContainer.innerHTML = '';
      
      // Display simulated results
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
    }
    
    result = allResults;
  } else {
    // Use simulation as before
    result = simulateCategories();
  
      // Log debug info
      if (debugLog) {
        debugLog.style.display = 'block';
        debugLog.innerHTML += `<div>[${new Date().toLocaleTimeString()}] Using simulated categorization results.</div>`;
      }
    }
    
    // Clear previous results
    categoriesContainer.innerHTML = '';
    
    // Display results
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
  } catch (error) {
    console.error('Error processing comments:', error);
    
    // Log error
    if (debugLog) {
      debugLog.style.display = 'block';
      debugLog.innerHTML += `<div style="color: red">[${new Date().toLocaleTimeString()}] Processing Error: ${error.message}</div>`;
    }
    
    alert('Error processing comments: ' + error.message);
  } finally {
    // Hide loader
    loader.style.display = 'none';
  }
}

// Simulate categorization results
// Enhanced simulation function for the two-step process

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

// Display categorization results
function displayResults(result) {
  const categoriesContainer = document.getElementById('categoriesContainer');
  
  if (!result || !result.categories || !Array.isArray(result.categories)) {
    categoriesContainer.innerHTML = '<div class="error">Invalid result format</div>';
    return;
  }
  
  // Display each category
  // Enhanced display function to show common issues and suggested actions

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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    initApp();
  } catch(e) {
    console.error("Error initializing app:", e);
  }
});
