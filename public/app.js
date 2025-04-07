// Store comments
let comments = [];

// Debug mode
const DEBUG = true;

// Current language
let currentLanguage = 'en';

// Wait for DOM to fully load before accessing elements
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
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
  const languageSelector = document.getElementById('languageSelector');

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
  
  // Language switching functions
  function initializeLanguage() {
    // Check for saved language preference
    const savedLanguage = localStorage.getItem('preferredLanguage');
    
    if (savedLanguage) {
      currentLanguage = savedLanguage;
      languageSelector.value = currentLanguage;
    }
    
    applyLanguage(currentLanguage);
    debug("Initialized language", currentLanguage);
  }
  
  // Apply the selected language
  function applyLanguage(lang) {
    debug("Applying language", lang);
    
    // Update document language
    document.documentElement.lang = lang;
    
    // Apply RTL for Arabic
    if (lang === 'ar') {
      document.body.classList.add('rtl');
      // Make sure to check if the element exists before setting attributes
      if (commentInput) {
        commentInput.setAttribute('dir', 'rtl');
      }
    } else {
      document.body.classList.remove('rtl');
      if (commentInput) {
        commentInput.setAttribute('dir', 'ltr');
      }
    }
    
    // Update all text elements with translations
    const elements = document.querySelectorAll('[data-lang-key]');
    elements.forEach(element => {
      const key = element.getAttribute('data-lang-key');
      
      if (translations[lang] && translations[lang][key]) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          // For input elements, update the placeholder
          if (element.hasAttribute('placeholder')) {
            element.placeholder = translations[lang][key];
          }
        } else {
          // For other elements, update the text content
          element.textContent = translations[lang][key];
        }
      }
    });
    
    currentLanguage = lang;
    localStorage.setItem('preferredLanguage', lang);
  }

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
  
  // Language selection
  languageSelector.addEventListener('change', function() {
    const selectedLanguage = this.value;
    applyLanguage(selectedLanguage);
    debug("Language changed", selectedLanguage);
  });
  
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
      const alertMessage = currentLanguage === 'ar' ? 'الرجاء اختيار ملف CSV أولاً.' : 'Please select a CSV file first.';
      alert(alertMessage);
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      parseCSV(content);
    };
    reader.readAsText(file);
  });
  
  // Parse CSV content
  function parseCSV(content) {
    debug("Parsing CSV content", content.substring(0, 200) + "...");
    
    // Split by new lines
    const lines = content.split(/\r?\n/);
    
    if (lines.length === 0) {
      const alertMessage = currentLanguage === 'ar' ? 'يبدو أن ملف CSV فارغ.' : 'The CSV file appears to be empty.';
      alert(alertMessage);
      return;
    }
    
    // Check if there's a header line with a 'comment' column
    const headerLine = lines[0].toLowerCase().trim();
    const hasCommentColumn = headerLine.includes('comment') || headerLine.includes('تعليق');
    const headerFields = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
    let commentColumnIndex = headerFields.indexOf('comment');
    
    // Also check for Arabic column name
    if (commentColumnIndex === -1) {
      commentColumnIndex = headerFields.indexOf('تعليق');
    }
    
    let newComments = [];
    
    if (hasCommentColumn && commentColumnIndex > -1) {
      // If there's a comment column, extract comments from that column
      debug("Found 'comment' or 'تعليق' column at index " + commentColumnIndex);
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; // Skip empty lines
        
        const fields = parseCSVLine(lines[i]);
        
        if (fields && fields.length > commentColumnIndex && fields[commentColumnIndex].trim()) {
          newComments.push(fields[commentColumnIndex].trim());
        }
      }
    } else {
      // Otherwise, treat each line as a comment (skipping the header)
      debug("No 'comment' or 'تعليق' column found, treating each line as comment");
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim()) {
          newComments.push(lines[i].trim());
        }
      }
    }
    
    debug("Extracted " + newComments.length + " comments from CSV");
    
    if (newComments.length === 0) {
      const alertMessage = currentLanguage === 'ar' 
        ? 'لم يتم العثور على تعليقات في ملف CSV. تأكد من أن لديه عمود "تعليق" أو "comment" أو تعليق واحد لكل سطر.' 
        : 'No comments found in the CSV file. Make sure it has a "comment" column or one comment per line.';
      alert(alertMessage);
      return;
    }
    
    // Add new comments to the global comments array
    comments = comments.concat(newComments);
    updateCommentsList();
    
    const successMessage = currentLanguage === 'ar'
      ? `تم تحميل ${newComments.length} تعليقات من CSV بنجاح.`
      : `Successfully loaded ${newComments.length} comments from CSV.`;
    alert(successMessage);
  }
  
  // Parse a single CSV line, handling quotes correctly
  function parseCSVLine(line) {
    // Simple CSV parsing for basic cases
    if (!line.includes('"')) {
      return line.split(',');
    }
    
    // More complex parsing for lines with quotes
    const result = [];
    let inQuotes = false;
    let currentValue = '';
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // Toggle quote state
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(currentValue);
        currentValue = '';
      } else {
        // Add character to current field
        currentValue += char;
      }
    }
    
    // Add the last field
    result.push(currentValue);
    
    return result;
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
      const alertMessage = currentLanguage === 'ar' 
        ? 'الرجاء إضافة بعض التعليقات أولاً.' 
        : 'Please add some comments first.';
      alert(alertMessage);
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
          const alertMessage = currentLanguage === 'ar' 
            ? 'الرجاء إدخال مفتاح API الخاص بـ Claude.' 
            : 'Please enter your Claude API key.';
          alert(alertMessage);
          loader.style.display = 'none';
          return;
        }
        
        debug("Using Claude API for processing", { commentCount: comments.length });
        
        try {
          categorizedComments = await processWithClaudeAPI(comments, apiKey);
        } catch (apiError) {
          console.error('API error:', apiError);
          debug("Claude API error, falling back to simulation", apiError.message);
          
          const errorMessage = currentLanguage === 'ar'
            ? 'حدث خطأ أثناء الاتصال بـ Claude API. استخدام المحاكاة بدلاً من ذلك.\n\nخطأ: ' + apiError.message + '\n\nملاحظة: يحتاج هذا التطبيق إلى خادم خلفي للعمل كوسيط للطلبات إلى Claude API.'
            : 'There was an error connecting to the Claude API. Using simulation instead.\n\nError: ' + apiError.message + '\n\nNote: This app needs a backend server to proxy requests to Claude API.';
          
          alert(errorMessage);
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
      
      const errorMessage = currentLanguage === 'ar'
        ? 'خطأ في معالجة التعليقات: ' + error.message
        : 'Error processing comments: ' + error.message;
      
      alert(errorMessage);
    } finally {
      // Hide loader
      loader.style.display = 'none';
    }
  });
  
  // Process with Claude API
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
        let errorMessage = currentLanguage === 'ar' ? 'فشل طلب API' : 'API request failed';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error?.message || errorData.details || errorMessage;
        } catch (e) {
          // If we can't parse JSON, try to get text
          errorMessage = await response.text() || errorMessage;
        }
        throw new Error(errorMessage);
      }
      
      // Get the response text
      const responseText = await response.text();
      debug("Raw API response received", responseText.substring(0, 200) + "...");
      
      // Try to parse the JSON response
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        debug("Failed to parse JSON response", e.message);
        throw new Error(currentLanguage === 'ar' ? "تنسيق استجابة غير صالح من الخادم" : "Invalid response format from server");
      }
      
      // Validate the response structure
      if (!data.categories || !Array.isArray(data.categories)) {
        debug("Invalid response structure", data);
        throw new Error(currentLanguage === 'ar' ? "الاستجابة لا تحتوي على مصفوفة الفئات" : "Response does not contain categories array");
      }
      
      // Process the categorized comments and add sentiment analysis
      const processedData = data.categories.map(category => {
        // Ensure comment numbers are valid (between 1 and commentList.length)
        const validCommentIndices = category.comments.filter(
          num => num >= 1 && num <= commentList.length
        );
        
        // Map comment numbers back to actual comments
        const categoryComments = validCommentIndices.map(num => commentList[num-1]);
        
        // Use sentiment from Claude API if available, otherwise generate it
        const sentimentScore = category.sentiment !== undefined ? 
          parseFloat(category.sentiment).toFixed(2) : 
          generateSentimentScore(category.name, categoryComments);
