// Store comments
let comments = [];

// Debug mode
const DEBUG = true;

// Current language
let currentLanguage = 'en';

// Check if translations exists, create empty object if not
if (typeof translations === 'undefined') {
  console.warn("Translations not found! Using empty translations.");
  var translations = {
    en: {
      "comments": "comments",
      "sentiment": "Sentiment:",
      "negative": "Negative",
      "positive": "Positive",
      "show-comments": "Show Comments",
      "hide-comments": "Hide Comments"
    }, 
    ar: {
      "comments": "تعليقات",
      "sentiment": "المشاعر:",
      "negative": "سلبي",
      "positive": "إيجابي",
      "show-comments": "عرض التعليقات",
      "hide-comments": "إخفاء التعليقات"
    }
  };
}

// Detect language of comments (Arabic or English)
function detectLanguage(commentList) {
  try {
    if (!commentList || commentList.length === 0) return 'en';
    
    // Arabic Unicode range
    const arabicPattern = /[\u0600-\u06FF]/;
    let arabicCharCount = 0;
    let totalCharCount = 0;
    
    // Count Arabic characters in all comments
    commentList.forEach(comment => {
      if (!comment) return;
      
      for (let i = 0; i < comment.length; i++) {
        if (arabicPattern.test(comment[i])) {
          arabicCharCount++;
        }
        totalCharCount++;
      }
    });
    
    // If more than 15% of characters are Arabic, consider it Arabic content
    const arabicRatio = arabicCharCount / totalCharCount;
    console.log("Language detection", { arabicRatio, arabicCharCount, totalCharCount });
    
    return arabicRatio > 0.15 ? 'ar' : 'en';
  } catch (error) {
    console.error('Error detecting language:', error);
    console.log("Language detection error", error.message);
    return 'en'; // Default to English on error
  }
  
  // Process comments
  if (processCommentsBtn) {
    processCommentsBtn.addEventListener('click', async () => {
      try {
        if (comments.length === 0) {
          const alertMessage = currentLanguage === 'ar' 
            ? 'الرجاء إضافة بعض التعليقات أولاً.' 
            : 'Please add some comments first.';
          alert(alertMessage);
          return;
        }
        
        // Show loader
        if (loader) {
          loader.style.display = 'block';
        }
        
        let categorizedComments;
        
        // Check if using API or simulation
        if (useApi && useApi.checked) {
          if (!apiKeyInput) {
            throw new Error('API key input missing from DOM');
          }
          
          const apiKey = apiKeyInput.value.trim();
          if (!apiKey) {
            const alertMessage = currentLanguage === 'ar' 
              ? 'الرجاء إدخال مفتاح API الخاص بـ Claude.' 
              : 'Please enter your Claude API key.';
            alert(alertMessage);
            if (loader) {
              loader.style.display = 'none';
            }
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
        
        // Make sure categorizedComments is an array before trying to display
        if (Array.isArray(categorizedComments) && categorizedComments.length > 0) {
          displayCategorizedComments(categorizedComments);
        } else {
          throw new Error('No valid categories returned');
        }
      } catch (error) {
        console.error('Error processing comments:', error);
        debug("Error processing comments", error.message);
        
        const errorMessage = currentLanguage === 'ar'
          ? 'خطأ في معالجة التعليقات: ' + error.message
          : 'Error processing comments: ' + error.message;
        
        alert(errorMessage);
      } finally {
        // Hide loader
        if (loader) {
          loader.style.display = 'none';
        }
      }
    });
  }
  
  // Display categorized comments
  function displayCategorizedComments(categories) {
    try {
      if (!categoriesContainer) {
        throw new Error('Categories container element not found');
      }
      
      // Clear previous content
      categoriesContainer.innerHTML = '';
      
      // Validate categories data
      if (!Array.isArray(categories) || categories.length === 0) {
        throw new Error('Invalid categories data');
      }
      
      // Calculate overall statistics
      const totalComments = categories.reduce((sum, category) => sum + (category.count || 0), 0);
      const categoryCount = categories.length;
      
      let totalSentiment = 0;
      let validSentimentCount = 0;
      
      categories.forEach(category => {
        const sentimentValue = parseFloat(category.sentiment || 0);
        if (!isNaN(sentimentValue) && category.count > 0) {
          totalSentiment += sentimentValue * category.count;
          validSentimentCount += category.count;
        }
      });
      
      // Calculate average sentiment (or default to 0 if no valid sentiment)
      const avgSentiment = validSentimentCount > 0 ? 
        (totalSentiment / validSentimentCount).toFixed(2) : 
        "0.00";
      
      // Update statistics display if elements exist
      if (totalCommentsEl) totalCommentsEl.textContent = totalComments;
      if (categoryCountEl) categoryCountEl.textContent = categoryCount;
      if (avgSentimentEl) avgSentimentEl.textContent = avgSentiment;
      if (overallStats) overallStats.style.display = 'block';
      
      debug("Statistics calculated", { totalComments, categoryCount, avgSentiment });
      
      // Sort categories by count (highest first) - with null/undefined handling
      categories.sort((a, b) => (b.count || 0) - (a.count || 0));
      
      // Create and display category cards
      categories.forEach(category => {
        try {
          // Skip invalid categories
          if (!category || !category.name) return;
          
          const categoryCard = document.createElement('div');
          categoryCard.className = 'category-card';
          
          const categoryHeader = document.createElement('div');
          categoryHeader.className = 'category-header';
          
          const categoryName = document.createElement('div');
          categoryName.className = 'category-name';
          categoryName.textContent = category.name;
          
          const categoryCount = document.createElement('div');
          categoryCount.className = 'category-count';
          const commentsText = translations && translations[currentLanguage] && 
            translations[currentLanguage]['comments'] ? 
            translations[currentLanguage]['comments'] : 'comments';
          categoryCount.textContent = `${category.count || 0} ${commentsText}`;
          
          const categorySummary = document.createElement('div');
          categorySummary.className = 'category-summary';
          categorySummary.textContent = category.summary || '';
          
          // Create sentiment score and visualization
          const sentimentScore = parseFloat(category.sentiment || 0);
          const sentimentContainer = document.createElement('div');
          sentimentContainer.className = 'sentiment-container';
          
          const sentimentDetails = document.createElement('div');
          sentimentDetails.className = 'sentiment-details';
          
          const sentimentEmoji = document.createElement('div');
          sentimentEmoji.className = 'sentiment-emoji';
          
          if (sentimentScore > 0.33) {
            sentimentEmoji.textContent = '😃';
          } else if (sentimentScore > -0.33) {
            sentimentEmoji.textContent = '😐';
          } else {
            sentimentEmoji.textContent = '😞';
          }
          
          const sentimentScoreEl = document.createElement('div');
          sentimentScoreEl.className = 'sentiment-score';
          const sentimentText = translations && translations[currentLanguage] && 
            translations[currentLanguage]['sentiment'] ? 
            translations[currentLanguage]['sentiment'] : 'Sentiment:';
          sentimentScoreEl.textContent = `${sentimentText} ${sentimentScore.toFixed(2)}`;
          
          sentimentDetails.appendChild(sentimentEmoji);
          sentimentDetails.appendChild(sentimentScoreEl);
          
          // Create sentiment bar visualization
          const sentimentBarContainer = document.createElement('div');
          sentimentBarContainer.className = 'sentiment-bar-container';
          
          const sentimentBar = document.createElement('div');
          sentimentBar.className = 'sentiment-bar';
          
          // Determine sentiment bar color and width based on score
          if (sentimentScore > 0.33) {
            sentimentBar.classList.add('sentiment-positive');
          } else if (sentimentScore > -0.33) {
            sentimentBar.classList.add('sentiment-neutral');
          } else {
            sentimentBar.classList.add('sentiment-negative');
          }
          
          // Convert score from -1...1 to 0...100% for width
          const barWidthPercent = ((sentimentScore + 1) / 2) * 100;
          sentimentBar.style.width = `${Math.max(0, Math.min(100, barWidthPercent))}%`;
          
          sentimentBarContainer.appendChild(sentimentBar);
          
          // Create sentiment label
          const sentimentLabel = document.createElement('div');
          sentimentLabel.className = 'sentiment-label';
          
          const sentimentLabelNeg = document.createElement('div');
          sentimentLabelNeg.textContent = translations && translations[currentLanguage] && 
            translations[currentLanguage]['negative'] ? 
            translations[currentLanguage]['negative'] : 'Negative';
          
          const sentimentLabelPos = document.createElement('div');
          sentimentLabelPos.textContent = translations && translations[currentLanguage] && 
            translations[currentLanguage]['positive'] ? 
            translations[currentLanguage]['positive'] : 'Positive';
          
          sentimentLabel.appendChild(sentimentLabelNeg);
          sentimentLabel.appendChild(sentimentLabelPos);
          
          // Create show comments button
          const showCommentsBtn = document.createElement('button');
          showCommentsBtn.className = 'show-comments-btn';
          showCommentsBtn.textContent = translations && translations[currentLanguage] && 
            translations[currentLanguage]['show-comments'] ? 
            translations[currentLanguage]['show-comments'] : 'Show Comments';
          showCommentsBtn.setAttribute('data-expanded', 'false');
          
          // Create comments container
          const commentsContainer = document.createElement('div');
          commentsContainer.className = 'category-comments';
          
          // Add comments to container
          if (Array.isArray(category.comments)) {
            category.comments.forEach(comment => {
              if (!comment) return;
              
              const commentEl = document.createElement('div');
              commentEl.className = 'category-comment';
              commentEl.textContent = comment;
              commentsContainer.appendChild(commentEl);
            });
          }
          
          // Toggle comments visibility
          showCommentsBtn.addEventListener('click', () => {
            try {
              const isExpanded = showCommentsBtn.getAttribute('data-expanded') === 'true';
              if (isExpanded) {
                commentsContainer.style.display = 'none';
                showCommentsBtn.textContent = translations && translations[currentLanguage] && 
                  translations[currentLanguage]['show-comments'] ? 
                  translations[currentLanguage]['show-comments'] : 'Show Comments';
                showCommentsBtn.setAttribute('data-expanded', 'false');
              } else {
                commentsContainer.style.display = 'block';
                showCommentsBtn.textContent = translations && translations[currentLanguage] && 
                  translations[currentLanguage]['hide-comments'] ? 
                  translations[currentLanguage]['hide-comments'] : 'Hide Comments';
                showCommentsBtn.setAttribute('data-expanded', 'true');
              }
            } catch (error) {
              console.error('Error toggling comments visibility:', error);
              debug("Toggle comments error", error.message);
            }
          });
          
          // Assemble the category card
          categoryHeader.appendChild(categoryName);
          categoryHeader.appendChild(categoryCount);
          
          categoryCard.appendChild(categoryHeader);
          categoryCard.appendChild(categorySummary);
          categoryCard.appendChild(sentimentDetails);
          categoryCard.appendChild(sentimentBarContainer);
          categoryCard.appendChild(sentimentLabel);
          categoryCard.appendChild(showCommentsBtn);
          categoryCard.appendChild(commentsContainer);
          
          categoriesContainer.appendChild(categoryCard);
        } catch (cardError) {
          console.error('Error creating category card:', cardError);
          debug("Category card creation error", cardError.message);
        }
      });
      
      debug("Displayed categories", { count: categories.length });
    } catch (error) {
      console.error('Error displaying categories:', error);
      debug("Display categories error", error.message);
      
      // Show error message in the UI
      if (categoriesContainer) {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'error-message';
        errorMessage.textContent = currentLanguage === 'ar' 
          ? 'حدث خطأ أثناء عرض الفئات. يرجى المحاولة مرة أخرى.'
          : 'An error occurred while displaying categories. Please try again.';
        categoriesContainer.innerHTML = '';
        categoriesContainer.appendChild(errorMessage);
      }
    }
  }
  
  // Check for stored API key in localStorage
  if (apiKeyInput) {
    try {
      const storedApiKey = localStorage.getItem('claudeApiKey');
      if (storedApiKey) {
        apiKeyInput.value = storedApiKey;
        debug("Loaded stored API key");
      }
      
      // Save API key to localStorage when entered
      apiKeyInput.addEventListener('change', () => {
        if (apiKeyInput.value.trim()) {
          localStorage.setItem('claudeApiKey', apiKeyInput.value.trim());
          debug("Saved API key to localStorage");
        }
      });
    } catch (storageError) {
      console.error('Error accessing localStorage:', storageError);
      debug("localStorage error", storageError.message);
    }
  }
  
  // Also allow adding comments by pressing Enter in the input field
  if (commentInput) {
    commentInput.addEventListener('keypress', (e) => {
      try {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          if (addCommentBtn) {
            addCommentBtn.click();
          }
        }
      } catch (keypressError) {
        console.error('Error handling keypress:', keypressError);
        debug("Keypress error", keypressError.message);
      }
    });
  }
  
  // Initialize language
  initializeLanguage();
  
  // Update processing method display
  updateProcessingMethod();
  
  debug("App initialization complete");
}

// Simulate Claude API response for testing without an API key
async function simulateClaudeAPI(commentList) {
  try {
    console.log("Simulating Claude API with", { commentCount: commentList.length });
    
    // Show a loading delay (between 1-3 seconds) to simulate API call
    const delay = Math.floor(Math.random() * 2000) + 1000;
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Simple categorization logic based on keywords
    const categories = {};
    const isArabic = detectLanguage(commentList) === 'ar';
    
    console.log("Detected language", isArabic ? "Arabic" : "English");
    
    commentList.forEach((comment, index) => {
      let categoryName = isArabic ? "أخرى" : "Other";
      
      // Simple categorization based on keywords
      const lowerComment = (comment || '').toLowerCase();
      
      // Define category keywords in both English and Arabic
      const categoryKeywords = isArabic ? {
        "طلب مساعدة": ["مساعدة", "كيف يمكنني", "طلب", "محتاج", "بحاجة إلى"],
        "اقتراح تحسين": ["تحسين", "اقتراح", "يمكن", "أفضل", "تطوير"],
        "الإبلاغ عن مشكلة": ["مشكلة", "خطأ", "لا يعمل", "توقف", "خلل"],
        "تعليق إيجابي": ["ممتاز", "رائع", "جيد", "أحب", "مفيد"],
        "تعليق سلبي": ["سيء", "فظيع", "كره", "غير مفيد", "محبط"],
        "استفسار": ["سؤال", "استفسار", "هل يمكن", "معلومات", "كيف"]
      } : {
        "Help Request": ["help", "how do i", "need assistance", "support", "can you help"],
        "Improvement Suggestion": ["improve", "suggestion", "better", "could be", "enhance"],
        "Bug Report": ["bug", "issue", "doesn't work", "broken", "error", "problem"],
        "Positive Feedback": ["great", "excellent", "good", "love", "helpful", "thanks"],
        "Negative Feedback": ["bad", "terrible", "hate", "unhelpful", "frustrated"],
        "Question": ["question", "inquiry", "can you", "information", "how to"]
      };
      
      // Find matching category
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        for (const keyword of keywords) {
          if (lowerComment.includes((keyword || '').toLowerCase())) {
            categoryName = category;
            break;
          }
        }
      }
      
      // Add comment to category
      if (!categories[categoryName]) {
        categories[categoryName] = { 
          name: categoryName, 
          comments: [],
          commentIndices: []
        };
      }
      
      categories[categoryName].comments.push(comment);
      categories[categoryName].commentIndices.push(index + 1); // 1-based index
    });
    
    // Convert categories object to array and add summaries and sentiment
    const categoryArray = Object.values(categories).map(category => {
      // Generate a simple summary based on the first few comments
      const summary = isArabic
        ? `يحتوي على ${category.comments.length} تعليقات حول "${category.name}".`
        : `Contains ${category.comments.length} comments about "${category.name}".`;
      
      // Generate sentiment score
      const sentiment = generateSentimentScore(category.name, category.comments);
      
      return {
        name: category.name,
        count: category.comments.length,
        comments: category.comments,
        summary: summary,
        sentiment: sentiment
      };
    });
    
    console.log("Simulated categories generated", { categoryCount: categoryArray.length });
    return categoryArray;
  } catch (error) {
    console.error('Error simulating API:', error);
    console.log("Simulation error", error.message);
    throw error;
  }
}

// Generate a sentiment score based on category name and comments
function generateSentimentScore(categoryName, comments) {
  try {
    console.log("Generating sentiment score for", { category: categoryName, commentCount: comments?.length || 0 });
    
    // Check if we're dealing with Arabic or English content
    let isArabic = false;
    const arabicPattern = /[\u0600-\u06FF]/;
    
    // Check if category name or first comment contains Arabic
    if (arabicPattern.test(categoryName || '') || (comments?.length > 0 && arabicPattern.test(comments[0] || ''))) {
      isArabic = true;
    }
    
    console.log("Sentiment generation language", isArabic ? "Arabic" : "English");
    
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
    
    // Convert to lowercase for comparison - ensure we're safe against nulls
    const categoryLower = (categoryName || '').toLowerCase();
    
    // Check if category name suggests sentiment
    for (const term of positiveCategories) {
      if (categoryLower.includes((term || '').toLowerCase())) {
        baseScore += 0.3;
        console.log("Matched positive category term", { term, score: baseScore });
        break;
      }
    }
    
    for (const term of negativeCategories) {
      if (categoryLower.includes((term || '').toLowerCase())) {
        baseScore -= 0.3;
        console.log("Matched negative category term", { term, score: baseScore });
        break;
      }
    }
    
    // Analyze comments for sentiment words
    let sentimentSum = baseScore;
    
    // Ensure we only process valid comments
    const validComments = comments ? comments.filter(comment => comment !== null && comment !== undefined) : [];
    
    validComments.forEach(comment => {
      let commentScore = 0;
      const commentLower = (comment || '').toLowerCase();
      
      // Count positive and negative words
      for (const word of positiveWords) {
        if (commentLower.includes((word || '').toLowerCase())) {
          commentScore += 0.1;
        }
      }
      
      for (const word of negativeWords) {
        if (commentLower.includes((word || '').toLowerCase())) {
          commentScore -= 0.1;
        }
      }
      
      sentimentSum += commentScore;
    });
    
    // Handle case of no comments
    if (!validComments.length) {
      console.log("No comments to analyze for sentiment", { baseScore });
      return baseScore.toFixed(2);
    }
    
    // Average and normalize to -1 to 1 range
    let finalScore = sentimentSum / (validComments.length + 1);
    finalScore = Math.max(-1, Math.min(1, finalScore));
    
    console.log("Generated sentiment score", finalScore.toFixed(2));
    return finalScore.toFixed(2);
  } catch (error) {
    console.error('Error generating sentiment score:', error);
    console.log("Sentiment generation error", error.message);
    return "0.00"; // Default neutral score on error
  }
}

// Process with Claude API
async function processWithClaudeAPI(commentList, apiKey) {
  try {
    console.log("Calling Claude API with", { commentCount: commentList.length });
    
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
    
    console.log("API response status", response.status);
    
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
    console.log("Raw API response received", responseText.substring(0, 200) + "...");
    
    // Try to parse the JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.log("Failed to parse JSON response", e.message);
      throw new Error(currentLanguage === 'ar' ? "تنسيق استجابة غير صالح من الخادم" : "Invalid response format from server");
    }
    
    // Validate the response structure
    if (!data.categories || !Array.isArray(data.categories)) {
      console.log("Invalid response structure", data);
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
    
    console.log("Processed data", { categoryCount: processedData.length });
    return processedData;
  } catch (error) {
    console.log("Claude API error", error.message);
    console.error('Claude API error:', error);
    throw error;
  }
}

// Wait for DOM to fully load before accessing elements
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements - with existence checks
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

  // Verify required elements exist
  if (!commentInput || !addCommentBtn || !commentsList || !processCommentsBtn || 
      !categoriesContainer || !loader || !languageSelector) {
    console.error('Critical DOM elements missing');
    alert('Application error: Some components could not be found. Please reload the page.');
    return; // Exit setup if critical elements are missing
  }

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
    try {
      // Check for saved language preference
      const savedLanguage = localStorage.getItem('preferredLanguage');
      
      if (savedLanguage) {
        currentLanguage = savedLanguage;
        if (languageSelector) {
          languageSelector.value = currentLanguage;
        }
      }
      
      applyLanguage(currentLanguage);
      debug("Initialized language", currentLanguage);
    } catch (error) {
      console.error('Error initializing language:', error);
      debug("Language initialization error", error.message);
    }
  }
  
  // Apply the selected language
  function applyLanguage(lang) {
    try {
      debug("Applying language", lang);
      
      // Update document language
      document.documentElement.lang = lang;
      
      // Apply RTL for Arabic
      if (lang === 'ar') {
        document.body.classList.add('rtl');
        // Set direction for inputs
        const inputElements = document.querySelectorAll('input, textarea');
        inputElements.forEach(element => {
          if (element) {
            element.setAttribute('dir', 'rtl');
          }
        });
      } else {
        document.body.classList.remove('rtl');
        // Reset direction for inputs
        const inputElements = document.querySelectorAll('input, textarea');
        inputElements.forEach(element => {
          if (element) {
            element.setAttribute('dir', 'ltr');
          }
        });
      }
      
      // Update all text elements with translations
      const elements = document.querySelectorAll('[data-lang-key]');
      elements.forEach(element => {
        if (!element) return;
        
        const key = element.getAttribute('data-lang-key');
        
        if (translations && translations[lang] && translations[lang][key]) {
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
    } catch (error) {
      console.error('Error applying language:', error);
      debug("Language application error", error.message);
    }
  }

  // Processing method selection
  if (useSimulation && useApi) {
    useSimulation.addEventListener('change', updateProcessingMethod);
    useApi.addEventListener('change', updateProcessingMethod);
  }
  
  function updateProcessingMethod() {
    if (useApi && useApi.checked && apiKeySection) {
      apiKeySection.style.display = 'block';
    } else if (apiKeySection) {
      apiKeySection.style.display = 'none';
    }
  }
  
  // Language selection
  if (languageSelector) {
    languageSelector.addEventListener('change', function() {
      const selectedLanguage = this.value;
      applyLanguage(selectedLanguage);
      debug("Language changed", selectedLanguage);
    });
  }
  
  // Tab functionality
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    if (!tab) return;
    
    tab.addEventListener('click', () => {
      try {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => {
          if (t) t.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(c => {
          if (c) c.classList.remove('active');
        });
        
        // Add active class to clicked tab
        tab.classList.add('active');
        
        // Show corresponding content
        const tabId = tab.getAttribute('data-tab');
        if (tabId) {
          const tabContent = document.getElementById(tabId);
          if (tabContent) {
            tabContent.classList.add('active');
          }
        }
      } catch (error) {
        console.error('Error in tab switching:', error);
        debug("Tab switching error", error.message);
      }
    });
  });
  
  // Add a comment to the list
  if (addCommentBtn) {
    addCommentBtn.addEventListener('click', () => {
      try {
        if (!commentInput) return;
        
        const commentText = commentInput.value.trim();
        if (commentText) {
          comments.push(commentText);
          updateCommentsList();
          commentInput.value = '';
        }
      } catch (error) {
        console.error('Error adding comment:', error);
        debug("Add comment error", error.message);
      }
    });
  }
  
  // Clear all comments
  if (clearCommentsBtn) {
    clearCommentsBtn.addEventListener('click', () => {
      try {
        comments = [];
        updateCommentsList();
        if (categoriesContainer) {
          categoriesContainer.innerHTML = '';
        }
        if (overallStats) {
          overallStats.style.display = 'none';
        }
      } catch (error) {
        console.error('Error clearing comments:', error);
        debug("Clear comments error", error.message);
      }
    });
  }
  
  // Update the comments list display
  function updateCommentsList() {
    try {
      if (!commentsList) return;
      
      commentsList.innerHTML = '';
      comments.forEach((comment, index) => {
        const commentEl = document.createElement('div');
        commentEl.className = 'comment-item';
        commentEl.textContent = comment;
        commentsList.appendChild(commentEl);
      });
    } catch (error) {
      console.error('Error updating comments list:', error);
      debug("Update comments list error", error.message);
    }
  }
  
  // Handle CSV file upload
  if (csvFileInput) {
    csvFileInput.addEventListener('change', (event) => {
      try {
        const file = event.target.files[0];
        if (file && fileInfo) {
          fileInfo.textContent = `Selected file: ${file.name} (${formatFileSize(file.size)})`;
        }
      } catch (error) {
        console.error('Error handling CSV file selection:', error);
        debug("CSV file selection error", error.message);
      }
    });
  }
  
  // Load comments from CSV
  if (loadCsvBtn) {
    loadCsvBtn.addEventListener('click', () => {
      try {
        if (!csvFileInput) return;
        
        const file = csvFileInput.files[0];
        if (!file) {
          const alertMessage = currentLanguage === 'ar' ? 'الرجاء اختيار ملف CSV أولاً.' : 'Please select a CSV file first.';
          alert(alertMessage);
          return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target.result;
            parseCSV(content);
          } catch (error) {
            console.error('Error reading CSV file:', error);
            debug("CSV read error", error.message);
            const alertMessage = currentLanguage === 'ar' 
              ? 'خطأ في قراءة ملف CSV: ' + error.message 
              : 'Error reading CSV file: ' + error.message;
            alert(alertMessage);
          }
        };
        reader.onerror = (error) => {
          console.error('Error reading file:', error);
          debug("File read error", error);
          const alertMessage = currentLanguage === 'ar' 
            ? 'خطأ في قراءة الملف.' 
            : 'Error reading file.';
          alert(alertMessage);
        };
        reader.readAsText(file);
      } catch (error) {
        console.error('Error loading CSV:', error);
        debug("Load CSV error", error.message);
        const alertMessage = currentLanguage === 'ar' 
          ? 'خطأ في تحميل CSV: ' + error.message 
          : 'Error loading CSV: ' + error.message;
        alert(alertMessage);
      }
    });
  }
  
  // Parse CSV content
  function parseCSV(content) {
    try {
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
      
      debug("CSV header analysis", { 
        headerLine, 
        hasCommentColumn, 
        commentColumnIndex,
        headerFields 
      });
      
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
    } catch (error) {
      console.error('Error parsing CSV:', error);
      debug("CSV parsing error", error.message);
      const alertMessage = currentLanguage === 'ar' 
        ? 'خطأ في تحليل CSV: ' + error.message 
        : 'Error parsing CSV: ' + error.message;
      alert(alertMessage);
    }
  }
  
  // Parse a single CSV line, handling quotes correctly
  function parseCSVLine(line) {
    try {
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
    } catch (error) {
      console.error('Error parsing CSV line:', error);
      debug("CSV line parsing error", error.message);
      throw error; // Rethrow to handle in the calling function
    }
  }
  
  // Format file size
  function formatFileSize(bytes) {
    try {
      if (bytes < 1024) return bytes + ' bytes';
      else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
      else return (bytes / 1048576).toFixed(1) + ' MB';
    } catch (error) {
      console.error('Error formatting file size:', error);
      debug("File size formatting error", error.message);
      return bytes + ' bytes'; // Return simple format on error
    }
  }
