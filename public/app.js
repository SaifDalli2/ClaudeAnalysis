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
      document.querySelector('textarea').setAttribute('dir', 'rtl');
    } else {
      document.body.classList.remove('rtl');
      document.querySelector('textarea').setAttribute('dir', 'ltr');
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
        
        return {
          name: category.name,
          count: categoryComments.length,
          summary: category.summary,
          comments: categoryComments,
          sentiment: sentimentScore
        };
      });
      
      debug("Processed data", { categoryCount: processedData.length });
      return processedData;
    } catch (error) {
      debug("Claude API error", error.message);
      console.error('Claude API error:', error);
      throw error;
    }
  }
  
  // Generate a sentiment score based on category name and comments
  function generateSentimentScore(categoryName, comments) {
    debug("Generating sentiment score for", { category: categoryName, commentCount: comments.length });
    
    // Check if we're dealing with Arabic or English content
    let isArabic = false;
    const arabicPattern = /[\u0600-\u06FF]/;
    
    // Check if category name or first comment contains Arabic
    if (arabicPattern.test(categoryName) || (comments.length > 0 && arabicPattern.test(comments[0]))) {
      isArabic = true;
    }
    
    // In a real implementation, this would come from Claude API
    let positiveCategories, negativeCategories, positiveWords, negativeWords;
    
    if (isArabic) {
      positiveCategories = ["إيجابي", "إشادة", "جيد", "ممتاز", "سعيد", "راضي", "يحب", "يعشق"];
      negativeCategories = ["سلبي", "شكوى", "سيء", "ضعيف", "فظيع", "غير سعيد", "غاضب", "يكره", "خطأ", "مشكلة"];
      
      positiveWords = ["جيد", "رائع", "ممتاز", "مذهل", "عظيم", "أحب", "يعجبني", "مفيد", "أفضل", "مثالي", "سعيد"];
      negativeWords = ["سيء", "ضعيف", "فظيع", "أسوأ", "يكره", "لا يعجبني", "مشكلة", "خطأ", "إصلاح", "معطل", "خائب الأمل", "محبط"];
    } else {
      positiveCategories = ["positive", "praise", "good", "excellent", "happy", "satisfied", "like", "love"];
      negativeCategories = ["negative", "complaint", "bad", "poor", "terrible", "unhappy", "angry", "hate", "bug", "issue"];
      
      positiveWords = ["good", "great", "excellent", "awesome", "amazing", "love", "like", "helpful", "best", "perfect", "happy"];
      negativeWords = ["bad", "poor", "terrible", "worst", "hate", "dislike", "problem", "issue", "fix", "broken", "disappointed", "frustrating"];
    }
    
    let baseScore = 0;
    
    // Check if category name suggests sentiment
    const categoryLower = categoryName.toLowerCase();
    for (const term of positiveCategories) {
      if (categoryLower.includes(term.toLowerCase())) {
        baseScore += 0.3;
        break;
      }
    }
    
    for (const term of negativeCategories) {
      if (categoryLower.includes(term.toLowerCase())) {
        baseScore -= 0.3;
        break;
      }
    }
    
    // Analyze comments for sentiment words
    let sentimentSum = baseScore;
    
    comments.forEach(comment => {
      let commentScore = 0;
      const commentLower = comment.toLowerCase();
      
      // Count positive and negative words
      for (const word of positiveWords) {
        if (commentLower.includes(word.toLowerCase())) commentScore += 0.1;
      }
      
      for (const word of negativeWords) {
        if (commentLower.includes(word.toLowerCase())) commentScore -= 0.1;
      }
      
      sentimentSum += commentScore;
    });
    
    // Average and normalize to -1 to 1 range
    let finalScore = sentimentSum / (comments.length + 1);
    finalScore = Math.max(-1, Math.min(1, finalScore));
    
    debug("Generated sentiment score", finalScore.toFixed(2));
    return finalScore.toFixed(2);
  }
  
  // Simulate Claude API call for testing
  async function simulateClaudeAPI(commentList) {
    debug("Simulating API with", { commentCount: commentList.length });
    
    // Detect if comments are primarily in Arabic
    const arabicPattern = /[\u0600-\u06FF]/;
    let arabicCount = 0;
    
    for (const comment of commentList) {
      if (arabicPattern.test(comment)) {
        arabicCount++;
      }
    }
    
    const isArabic = (arabicCount / commentList.length > 0.5);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Prepare categories based on common content types
    const categoryTypes = isArabic ? [
      {name: "آراء المنتج", keywords: ["منتج", "ميزة", "واجهة", "تصميم", "تطبيق", "موقع", "استخدام"]},
      {name: "دعم العملاء", keywords: ["دعم", "مساعدة", "خدمة", "مساعد", "موظف", "استجابة", "تواصل"]},
      {name: "تقارير الأخطاء", keywords: ["خطأ", "مشكلة", "عطل", "توقف", "خلل", "عطب", "معطل"]},
      {name: "طلبات الميزات", keywords: ["إضافة", "ميزة", "أريد", "أتمنى", "يجب", "يمكن", "تنفيذ"]},
      {name: "مراجعات إيجابية", keywords: ["أحب", "رائع", "ممتاز", "مذهل", "جيد", "أفضل", "رائع", "يعجبني"]},
      {name: "مراجعات سلبية", keywords: ["سيء", "فظيع", "مروع", "أكره", "ضعيف", "أسوأ", "مخيب للآمال"]},
      {name: "الشحن والتوصيل", keywords: ["شحن", "توصيل", "طرد", "وصل", "شحنة", "شحن"]},
      {name: "مشاكل الحساب", keywords: ["حساب", "تسجيل دخول", "كلمة مرور", "دخول", "ملف شخصي", "تسجيل"]},
      {name: "التسعير والفواتير", keywords: ["سعر", "تكلفة", "مكلف", "رخيص", "فاتورة", "دفع", "اشتراك", "خصم"]}
    ] : [
      {name: "Product Feedback", keywords: ["product", "feature", "interface", "design", "app", "website", "usage"]},
      {name: "Customer Support", keywords: ["support", "help", "service", "assistant", "staff", "response", "contacted"]},
      {name: "Bug Reports", keywords: ["bug", "error", "issue", "problem", "crash", "glitch", "broken"]},
      {name: "Feature Requests", keywords: ["add", "feature", "want", "wish", "should", "could", "implement"]},
      {name: "Positive Reviews", keywords: ["love", "great", "excellent", "amazing", "good", "best", "wonderful", "like"]},
      {name: "Negative Reviews", keywords: ["bad", "terrible", "awful", "hate", "poor", "worst", "disappointing"]},
      {name: "Shipping & Delivery", keywords: ["shipping", "delivery", "package", "arrived", "shipment", "shipping"]},
      {name: "Account Issues", keywords: ["account", "login", "password", "sign in", "profile", "registration"]},
      {name: "Pricing & Billing", keywords: ["price", "cost", "expensive", "cheap", "bill", "payment", "subscription", "discount"]}
    ];
    
    // Function to assign a category based on content analysis
    function assignCategory(comment) {
      const commentLower = comment.toLowerCase();
      
      // Score each category by counting keyword matches
      const scores = categoryTypes.map(category => {
        let score = 0;
        category.keywords.forEach(keyword => {
          if (commentLower.includes(keyword.toLowerCase())) {
            score++;
          }
        });
        return { name: category.name, score };
      });
      
      // Sort by score and get the highest scoring category
      scores.sort((a, b) => b.score - a.score);
      
      // If no clear category match, use a default based on comment sentiment
      if (scores[0].score === 0) {
        // Simple sentiment analysis for uncategorized comments
        const positiveWords = isArabic ? 
          ["جيد", "رائع", "يعجبني", "أحب", "سعيد", "مسرور"] : 
          ["good", "great", "like", "love", "happy", "pleased"];
          
        const negativeWords = isArabic ? 
          ["سيء", "فظيع", "أكره", "لا يعجبني", "غير سعيد", "خائب الأمل"] : 
          ["bad", "terrible", "hate", "dislike", "unhappy", "disappointed"];
        
        let positiveScore = 0;
        let negativeScore = 0;
        
        positiveWords.forEach(word => {
          if (commentLower.includes(word.toLowerCase())) positiveScore++;
        });
        
        negativeWords.forEach(word => {
          if (commentLower.includes(word.toLowerCase())) negativeScore++;
        });
        
        if (positiveScore > negativeScore) {
          return isArabic ? "مراجعات إيجابية" : "Positive Reviews";
        } else if (negativeScore > positiveScore) {
          return isArabic ? "مراجعات سلبية" : "Negative Reviews";
        } else {
          return isArabic ? "ملاحظات عامة" : "General Feedback";
        }
      }
      
      return scores[0].name;
    }
    
    // Process each comment and assign a category
    const categorizedComments = {};
    
    commentList.forEach(comment => {
      const category = assignCategory(comment);
      
      if (!categorizedComments[category]) {
        categorizedComments[category] = {
          name: category,
          comments: [],
          count: 0
        };
      }
      
      categorizedComments[category].comments.push(comment);
      categorizedComments[category].count++;
    });
    
    // Generate summaries and sentiment scores
    Object.keys(categorizedComments).forEach(key => {
      const category = categorizedComments[key];
      
      // Generate summaries based on category
      if (isArabic) {
        // Arabic summaries
        if (category.name === "آراء المنتج") {
          category.summary = "يقدم المستخدمون ملاحظات حول جوانب مختلفة من المنتج، مع التركيز على قضايا سهولة الاستخدام والأداء.";
        } else if (category.name === "دعم العملاء") {
          category.summary = "تعليقات تتعلق بالتفاعلات مع فريق الدعم وحل مشكلات العملاء.";
        } else if (category.name === "تقارير الأخطاء") {
          category.summary = "يبلغ المستخدمون عن مشكلات وأخطاء تقنية محددة واجهوها.";
        } else if (category.name === "طلبات الميزات") {
          category.summary = "اقتراحات لوظائف جديدة وتحسينات للميزات الحالية.";
        } else if (category.name === "مراجعات إيجابية") {
          category.summary = "مستخدمون يعبرون عن رضاهم عن المنتج ويسلطون الضوء على نقاط قوته.";
        } else if (category.name === "مراجعات سلبية") {
          category.summary = "مخاوف وانتقادات حول جوانب مختلفة من المنتج أو الخدمة.";
        } else if (category.name === "الشحن والتوصيل") {
          category.summary = "ملاحظات متعلقة بأوقات شحن المنتج وتجارب التوصيل والتعبئة.";
        } else if (category.name === "مشاكل الحساب") {
          category.summary = "مشاكل في الوصول إلى الحساب أو التسجيل أو تسجيل الدخول أو إدارة الملف الشخصي.";
        } else if (category.name === "التسعير والفواتير") {
          category.summary = "تعليقات حول تسعير المنتج وتكاليف الاشتراك ومشكلات الفواتير أو معالجة الدفع.";
        } else {
          category.summary = "ملاحظات وتعليقات عامة لا تندرج ضمن فئات محددة أخرى.";
        }
      } else {
        // English summaries
        if (category.name === "Product Feedback") {
          category.summary = "Users provide feedback on various aspects of the product, focusing on usability and performance issues.";
        } else if (category.name === "Customer Support") {
          category.summary = "Comments relate to interactions with support staff and resolution of customer issues.";
        } else if (category.name === "Bug Reports") {
          category.summary = "Users report specific technical issues and glitches they've encountered.";
        } else if (category.name === "Feature Requests") {
          category.summary = "Suggestions for new functionality and improvements to existing features.";
        } else if (category.name === "Positive Reviews") {
          category.summary = "Users expressing satisfaction with the product and highlighting its strengths.";
        } else if (category.name === "Negative Reviews") {
          category.summary = "Concerns and criticisms about various aspects of the product or service.";
        } else if (category.name === "Shipping & Delivery") {
          category.summary = "Feedback related to product shipping times, delivery experiences, and packaging.";
        } else if (category.name === "Account Issues") {
          category.summary = "Problems with account access, registration, login, or profile management.";
        } else if (category.name === "Pricing & Billing") {
          category.summary = "Comments about product pricing, subscription costs, billing issues, or payment processing.";
        } else {
          category.summary = "General feedback and comments that don't fit into other specific categories.";
        }
      }
