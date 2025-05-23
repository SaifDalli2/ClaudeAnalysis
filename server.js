const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Expanded CORS configuration to ensure browser can connect
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  credentials: true,
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 200
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log incoming requests
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (From: ${req.ip})`);
  next();
});

// Add this to explicitly enable CORS for specific routes
app.options('*', cors()); // Enable pre-flight for all routes

// Middleware

// Increase limits to handle large batches of comments
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Simple ping endpoint to check server availability
app.get('/api/ping', (req, res) => {
  res.status(200).send('OK');
});

// You can also add a health check endpoint that returns server status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'up',
    timestamp: new Date().toISOString(),
    serverInfo: {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    }
  });
});

// Helper function to delay between API calls to avoid rate limits
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Detect language of comments
function detectLanguage(comments) {
  // Simple detection - check if most comments have Arabic characters
  const arabicPattern = /[\u0600-\u06FF]/;
  let arabicCount = 0;
  
  for (const comment of comments) {
    if (arabicPattern.test(comment)) {
      arabicCount++;
    }
  }
  
  // If more than 50% of comments contain Arabic characters, treat as Arabic
  return (arabicCount / comments.length > 0.5) ? 'ar' : 'en';
}


// Add these improvements to the server.js file

// Improved ping endpoint with wake-up capabilities
app.get('/api/ping', (req, res) => {
  // Log the ping request
  console.log(`Received ping request from ${req.ip}`);
  
  // If this is a wake-up request, add a small delay to ensure 
  // the server is fully initialized before responding
  if (req.query.wakeup === 'true') {
    console.log('Processing wake-up ping request...');
    
    // Add a small delay to ensure the server is fully initialized
    setTimeout(() => {
      console.log('Server is now awake and ready to process requests');
      res.status(200).send('OK - Server Awake');
    }, 500);
  } else {
    // Regular ping request
    res.status(200).send('OK');
  }
});

// Add a more robust error handler for API requests
app.use((err, req, res, next) => {
  console.error('Server Error:', err);
  
  // Check for specific error types
  if (err.name === 'TimeoutError') {
    return res.status(408).json({
      error: 'Request Timeout',
      details: 'The request took too long to process. Please try again with fewer comments.'
    });
  }
  
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
    return res.status(503).json({
      error: 'Connection Error',
      details: 'The connection to the server was interrupted. Please try again later.'
    });
  }
  
  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

// Add server status monitoring
let serverStatus = {
  startTime: new Date(),
  totalRequests: 0,
  activeRequests: 0,
  lastError: null
};

// Middleware to track request stats
app.use((req, res, next) => {
  serverStatus.totalRequests++;
  serverStatus.activeRequests++;
  
  // Track when the request finishes
  res.on('finish', () => {
    serverStatus.activeRequests--;
  });
  
  next();
});

// Add a detailed health check endpoint
app.get('/api/health', (req, res) => {
  const uptime = Math.floor((new Date() - serverStatus.startTime) / 1000);
  
  res.json({
    status: 'up',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    stats: {
      totalRequests: serverStatus.totalRequests,
      activeRequests: serverStatus.activeRequests,
      lastError: serverStatus.lastError
    },
    serverInfo: {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    }
  });
});

// Add an improved error catch to the error handler
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
  serverStatus.lastError = {
    time: new Date().toISOString(),
    message: err.message,
    stack: err.stack
  };
  
  // Only exit in extreme cases
  if (err.message.includes('FATAL') || err.code === 'EADDRINUSE') {
    console.error('Fatal error, shutting down server.');
    process.exit(1);
  }
});


// For Arabic language comments:
const systemMessage_ar = `
الغرض: تحليل التعليقات وتصنيفها إلى فئات محددة.

تعليمات مهمة:
1. أعد النتائج بصيغة JSON صالحة فقط، بدون أي نص آخر أو محادثة.
2. استخدم فقط الفئات المحددة مسبقًا كما هي بالضبط.
3. تأكد من أن جميع الحقول صالحة 100% في JSON.
4. كتابة أسماء الفئات بشكل صحيح بدون أي علامات اقتباس إضافية.
5. لا تستخدم علامات اقتباس إضافية في أسماء الفئات.

أسماء الفئات الصحيحة هي:
* مشكلات تقنية: تحديث التطبيق
* مشكلات تقنية: تجميد/بطء التطبيق
* مشكلات تقنية: مشكلات التطبيق
* مشكلات تقنية: لا يعمل
* مشكلات تقنية: تسجيل الدخول والوصول
* مشكلات تقنية: الأمان
* ملاحظات العملاء: معقد
* ملاحظات العملاء: خدمة العملاء
* ملاحظات العملاء: التصميم
* ملاحظات العملاء: مسيء
* ملاحظات العملاء: شكرًا
* مالية: احتيال
* مالية: التسعير
* مالية: طلب استرداد
`;

// For English language comments:
const systemMessage_en = `
Purpose: Analyze and categorize comments into predefined categories.

Critical instructions:
1. Return ONLY valid JSON, with no additional text or conversation.
2. Use ONLY the exact predefined categories as listed below.
3. Ensure all JSON fields are 100% valid.
4. Write category names correctly without any extra quotation marks.
5. Do not use extra quotes in category names.

The correct category names are:
* Technical issues: App update
* Technical issues: App Freeze/Slow
* Technical issues: App issues
* Technical issues: Doesn't work
* Technical issues: Login and Access
* Technical issues: Security
* Customer Feedback: Complicated
* Customer Feedback: Customer Service
* Customer Feedback: Design
* Customer Feedback: Offensive
* Customer Feedback: Thank you
* Monetary: Fraud
* Monetary: Pricing
* Monetary: Refund Request
`;

// NEW ENDPOINT: Step 1 - Categorize comments
// NEW ENDPOINT: Step 1 - Categorize comments - FIXED VERSION
app.post('/api/categorize', async (req, res) => {
  try {
    const { comments, apiKey } = req.body;
    
    // Validate API key
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid API key', 
        details: 'A valid Claude API key must be provided when using API mode' 
      });
    }
    
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: 'Comments must be a non-empty array' 
      });
    }

    console.log(`Processing ${comments.length} comments for categorization...`);
    
    // Use smaller batches and longer delays
    const batchSize = 50; // Reduced from 100
    const batches = [];
    
    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches of ${batchSize} comments each`);
    
    let allCategorizedComments = [];
    let allExtractedTopics = new Set();
    
    for (let i = 0; i < batches.length; i++) {
      const batchComments = batches[i];
      const batchStartIndex = i * batchSize;
      
      console.log(`Processing batch ${i+1}/${batches.length}`);
      
      try {
        // Longer delay between batches
        if (i > 0) {
          console.log('Waiting 20 seconds between batches to avoid rate limits...');
          await delay(20000);
        }
        
        // Detect language
        const language = detectLanguage(batchComments);
        
        // Create a more explicit prompt that demands JSON-only response
        let promptContent;
        
        if (language === 'ar') {
          promptContent = `CRITICAL: Return ONLY valid JSON. No explanations, no Arabic text outside JSON values.

Categorize each comment into exactly one category from this list:
- مشكلات تقنية: تحديث التطبيق
- مشكلات تقنية: تجميد/بطء التطبيق  
- مشكلات تقنية: مشكلات التطبيق
- مشكلات تقنية: لا يعمل
- مشكلات تقنية: تسجيل الدخول والوصول
- مشكلات تقنية: الأمان
- ملاحظات العملاء: معقد
- ملاحظات العملاء: خدمة العملاء
- ملاحظات العملاء: التصميم
- ملاحظات العملاء: مسيء
- ملاحظات العملاء: شكرًا
- مالية: احتيال
- مالية: التسعير
- مالية: طلب استرداد

Comments to categorize:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

Return ONLY this JSON structure (no other text):
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "comment text here",
      "category": "exact category name from list above",
      "topics": ["topic1", "topic2"]
    }
  ],
  "extractedTopics": []
}`;
        } else {
          promptContent = `CRITICAL: Return ONLY valid JSON. No explanations, no conversational text.

Categorize each comment into exactly one category from this list:
- Technical issues: App update
- Technical issues: App Freeze/Slow
- Technical issues: App issues
- Technical issues: Doesn't work
- Technical issues: Login and Access
- Technical issues: Security
- Customer Feedback: Complicated
- Customer Feedback: Customer Service
- Customer Feedback: Design
- Customer Feedback: Offensive
- Customer Feedback: Thank you
- Monetary: Fraud
- Monetary: Pricing
- Monetary: Refund Request

Comments to categorize:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

Return ONLY this JSON structure (no other text):
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "comment text here", 
      "category": "exact category name from list above",
      "topics": ["topic1", "topic2"]
    }
  ],
  "extractedTopics": []
}`;
        }
        
        console.log(`Sending categorization request to Claude API for batch ${i+1}...`);
        
        const response = await axios.post('https://api.anthropic.com/v1/messages', {
          model: 'claude-3-5-haiku-latest',
          max_tokens: 4000,
          system: "You are a JSON-only categorization tool. Return only valid JSON with no explanations or conversational text. Do not start responses with explanatory text in any language.",
          messages: [
            {
              role: 'user',
              content: promptContent
            }
          ]
        }, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          timeout: 45000 // Reduced timeout
        });
        
        // Process the response with improved parser
        const batchResult = parseClaudeResponseImproved(response);
        console.log(`Batch ${i+1} processed successfully, got ${batchResult.categorizedComments?.length || 0} categorized comments`);
        
        // Add to accumulated results
        if (batchResult.categorizedComments && Array.isArray(batchResult.categorizedComments)) {
          allCategorizedComments = [...allCategorizedComments, ...batchResult.categorizedComments];
        }
        
        if (batchResult.extractedTopics && Array.isArray(batchResult.extractedTopics)) {
          batchResult.extractedTopics.forEach(topicInfo => {
            allExtractedTopics.add(JSON.stringify(topicInfo));
          });
        }
        
      } catch (error) {
        console.error(`Error processing batch ${i+1}:`, error.message);
        
        // For timeout errors, try to continue with a longer delay
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          console.log('Timeout detected, waiting longer before continuing...');
          await delay(30000); // Wait 30 seconds after timeout
        }
        
        continue; // Continue with next batch
      }
    }
    
    // Merge extracted topics
    const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
      try {
        return JSON.parse(topicStr);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    mergedTopics.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    const finalResult = {
      categorizedComments: allCategorizedComments,
      extractedTopics: mergedTopics
    };
    
    console.log(`Categorization complete. Processed ${allCategorizedComments.length} comments out of ${comments.length} (${Math.round(allCategorizedComments.length/comments.length*100)}%)`);
    
    // Return success even if we only got partial results
    res.json(finalResult);
    
  } catch (error) {
    console.error('Error in /api/categorize endpoint:', error);
    
    res.status(500).json({
      error: 'Failed to categorize with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Improved response parser
function parseClaudeResponseImproved(response) {
  try {
    const responseContent = response.data.content[0].text;
    
    console.log('Raw Claude response (first 200 chars):', responseContent.substring(0, 200));
    
    // Check for conversational responses and reject them immediately
    const conversationalStarters = [
      'سأقوم', 'قبل أن', 'نظرًا ل', 'هل تريد', 'اقتراح:', 'من خلال تحليل',
      'I will', 'Before I', 'Let me', 'Would you like', 'Here is', 'Based on'
    ];
    
    const isConversational = conversationalStarters.some(starter => 
      responseContent.trim().startsWith(starter)
    );
    
    if (isConversational) {
      console.log('Detected conversational response, returning empty result');
      return { categorizedComments: [], extractedTopics: [] };
    }
    
    // Extract JSON more aggressively
    let jsonString = responseContent;
    
    // Try to find JSON in code blocks
    const jsonBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonBlockMatch) {
      jsonString = jsonBlockMatch[1];
    } else {
      // Find the first complete JSON object
      const firstBrace = responseContent.indexOf('{');
      if (firstBrace !== -1) {
        let braceCount = 0;
        let endIndex = firstBrace;
        
        for (let i = firstBrace; i < responseContent.length; i++) {
          if (responseContent[i] === '{') braceCount++;
          if (responseContent[i] === '}') braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
        
        jsonString = responseContent.substring(firstBrace, endIndex + 1);
      }
    }
    
    // Clean the JSON string more thoroughly
    jsonString = cleanJsonStringThoroughly(jsonString);
    
    console.log('Cleaned JSON string (first 100 chars):', jsonString.substring(0, 100));
    
    try {
      return JSON.parse(jsonString);
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      
      // Try one more aggressive fix
      const ultraCleanJson = ultraCleanJsonString(jsonString);
      
      try {
        return JSON.parse(ultraCleanJson);
      } catch (finalError) {
        console.error('Final JSON parse failed:', finalError.message);
        return { categorizedComments: [], extractedTopics: [] };
      }
    }
    
  } catch (error) {
    console.error('Error in parseClaudeResponseImproved:', error);
    return { categorizedComments: [], extractedTopics: [] };
  }
}

// More thorough JSON cleaning
function cleanJsonStringThoroughly(jsonString) {
  let cleaned = jsonString;
  
  // Fix common category name issues
  cleaned = cleaned.replace(/"category":\s*"مالية":\s*([^",}]+)/g, '"category": "مالية: $1"');
  cleaned = cleaned.replace(/"category":\s*"مشكلات\s+"تقنية":\s*([^",}]+)/g, '"category": "مشكلات تقنية: $1"');
  cleaned = cleaned.replace(/"category":\s*"ملاحظات\s+"العملاء":\s*([^",}]+)/g, '"category": "ملاحظات العملاء: $1"');
  
  // Fix incomplete category values
  cleaned = cleaned.replace(/"category":\s*([^",{}]+),/g, '"category": "$1",');
  
  // General cleanup
  cleaned = cleaned
    .replace(/\\"/g, '"')
    .replace(/\\n/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/"{2,}/g, '"')
    .replace(/:\s*,/g, ': "",')
    .replace(/\[\s*,/g, '[')
    .replace(/,\s*,/g, ',');
  
  // Fix unbalanced braces
  const openBraces = (cleaned.match(/{/g) || []).length;
  const closeBraces = (cleaned.match(/}/g) || []).length;
  
  if (openBraces > closeBraces) {
    cleaned += '}'.repeat(openBraces - closeBraces);
  }
  
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    cleaned += ']'.repeat(openBrackets - closeBrackets);
  }
  
  return cleaned;
}

// Ultra-aggressive JSON cleaning as last resort
function ultraCleanJsonString(jsonString) {
  try {
    // If we can't parse it, try to construct a minimal valid structure
    const commentMatches = [...jsonString.matchAll(/"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"/g)];
    
    if (commentMatches.length > 0) {
      const categorizedComments = commentMatches.map(match => ({
        id: parseInt(match[1]),
        comment: match[2],
        category: match[3],
        topics: []
      }));
      
      return JSON.stringify({
        categorizedComments,
        extractedTopics: []
      });
    }
    
    return '{"categorizedComments": [], "extractedTopics": []}';
  } catch (error) {
    return '{"categorizedComments": [], "extractedTopics": []}';
  }
}

// NEW ENDPOINT: Step 2 - Summarize categorized comments
app.post('/api/summarize', async (req, res) => {
  try {
    // Get categorized comments from request
    const { categorizedComments, extractedTopics, apiKey } = req.body;
    
    if (!categorizedComments || !Array.isArray(categorizedComments)) {
      return res.status(400).json({ 
        error: 'Invalid request', 
        details: 'Categorized comments must be provided as an array' 
      });
    }
    
    console.log(`Summarizing ${categorizedComments.length} categorized comments...`);
    
    // Group comments by category
    const commentsByCategory = {};
    
    categorizedComments.forEach(item => {
      if (!commentsByCategory[item.category]) {
        commentsByCategory[item.category] = [];
      }
      commentsByCategory[item.category].push(item.comment);
    });
    
    // Detect language of the comments
    const sampleComments = categorizedComments.map(item => item.comment).slice(0, 10);
    const language = detectLanguage(sampleComments);
    
    // Limit the number of comments to include in the prompt to avoid token limits
    const limitedCommentsByCategory = {};
    for (const category in commentsByCategory) {
      // Take up to 50 comments per category for the prompt
      limitedCommentsByCategory[category] = commentsByCategory[category].slice(0, 50);
      if (commentsByCategory[category].length > 50) {
        console.log(`Limited category ${category} from ${commentsByCategory[category].length} to 50 comments for summarization`);
      }
    }
    
    // Create prompt based on detected language
    let promptContent;
    
    if (language === 'ar') {
      promptContent = `قم بتلخيص التعليقات في كل فئة وتقديم إجراءات مقترحة استنادًا إلى المشكلات المشتركة.

التعليقات المصنفة حسب الفئة:
${Object.entries(limitedCommentsByCategory).map(([category, comments]) => 
  `# ${category} (${commentsByCategory[category].length} تعليقات بالإجمال، يتم عرض ${comments.length} فقط للتلخيص)\n${comments.map((comment, i) => `- ${comment}`).join('\n')}`
).join('\n\n')}

المواضيع الأكثر ذكرًا:
${extractedTopics && Array.isArray(extractedTopics) ? 
  extractedTopics.slice(0, 20).map(t => `- ${t.topic} (ذُكر ${t.count} مرات)`).join('\n') : 
  'لا توجد مواضيع مستخرجة'}

لكل فئة، قدم:
1. ملخصًا موجزًا (3-5 جمل) يلتقط النقاط الرئيسية والمشاعر
2. تحليلًا للمشكلات الشائعة المذكورة
3. 2-3 إجراءات مقترحة لمعالجة هذه المشكلات

أعد النتائج بتنسيق JSON كما يلي:
{
  "summaries": [
    {
      "category": "اسم الفئة",
      "commentCount": 10,
      "summary": "ملخص موجز للتعليقات في هذه الفئة",
      "commonIssues": ["المشكلة 1", "المشكلة 2", "المشكلة 3"],
      "suggestedActions": ["الإجراء المقترح 1", "الإجراء المقترح 2"],
      "sentiment": 0.2
    }
  ],
  "topTopics": [
    {
      "topic": "اسم الموضوع",
      "commentCount": 15,
      "summary": "ملخص موجز للتعليقات المتعلقة بهذا الموضوع"
    }
  ]
}

تأكد من أن يكون الملخص موجزًا ولكن شاملًا، والإجراءات المقترحة قابلة للتنفيذ وذات صلة مباشرة بالمشكلات المذكورة.`;
    } else {
      promptContent = `Summarize the comments in each category and provide suggested actions based on common issues.

Categorized comments by category:
${Object.entries(limitedCommentsByCategory).map(([category, comments]) => 
  `# ${category} (${commentsByCategory[category].length} total comments, showing ${comments.length} for summarization)\n${comments.map((comment, i) => `- ${comment}`).join('\n')}`
).join('\n\n')}

Most mentioned topics:
${extractedTopics && Array.isArray(extractedTopics) ? 
  extractedTopics.slice(0, 20).map(t => `- ${t.topic} (mentioned ${t.count} times)`).join('\n') : 
  'No extracted topics available'}

For each category, provide:
1. A concise summary (3-5 sentences) that captures the key points and sentiment
2. An analysis of common issues mentioned
3. 2-3 suggested actions to address these issues

Also provide a brief summary for the top 10 most mentioned topics.

Return the results in JSON format like this:
{
  "summaries": [
    {
      "category": "Category Name",
      "commentCount": 10,
      "summary": "Concise summary of comments in this category",
      "commonIssues": ["Issue 1", "Issue 2", "Issue 3"],
      "suggestedActions": ["Suggested action 1", "Suggested action 2"],
      "sentiment": 0.2
    }
  ],
  "topTopics": [
    {
      "topic": "Topic Name",
      "commentCount": 15,
      "summary": "Brief summary of comments related to this topic"
    }
  ]
}

Make sure the summary is concise but comprehensive, and the suggested actions are actionable and directly relevant to the issues mentioned.`;
    }
    
    // Call Claude API
    console.log('Sending summarization request to Claude API...');
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 8191,
      messages: [
        {
          role: 'user',
          content: promptContent
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      timeout: 300000 // 5-minute timeout
    });
    
    // Parse the response
    const summaryData = parseClaudeResponse(response);
    
    // Add actual comment counts for each category
    if (summaryData.summaries && Array.isArray(summaryData.summaries)) {
      summaryData.summaries.forEach(summary => {
        if (commentsByCategory[summary.category]) {
          summary.commentCount = commentsByCategory[summary.category].length;
        }
      });
    }
    
    res.json(summaryData);
  } catch (error) {
    console.error('Error proxying summarization to Claude API:');
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    
    res.status(500).json({
      error: 'Failed to summarize with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Original API endpoint - keeping this as is
app.post('/api/claude', async (req, res) => {
  try {
    // Get comments from request
    const { comments, apiKey } = req.body;
    
    // Detect language of the comments
    const language = detectLanguage(comments);
    
    // Create prompt based on detected language
    let promptContent;
    
    if (language === 'ar') {
      promptContent = `قم بتصنيف كل من التعليقات التالية إلى فئة واحدة بالضبط بناءً على موضوعها الرئيسي أو المشاعر. يجب تعيين كل تعليق إلى فئة واحدة بالضبط.

التعليقات:
${comments.map((comment, index) => `${index+1}. ${comment}`).join('\n')}

لكل فئة:
1. قدم اسم فئة وصفي
2. اذكر أرقام التعليقات التي تنتمي إلى هذه الفئة
3. اكتب ملخصًا موجزًا ودقيقًا يلتقط النقاط الرئيسية من جميع التعليقات في هذه الفئة
4. حلل مشاعر التعليقات في هذه الفئة على مقياس من -1 (سلبي للغاية) إلى 1 (إيجابي للغاية)

قم بإنشاء ملخصات موجزة ودقيقة تعكس مضمون معظم التعليقات في كل فئة بشكل جيد. يجب أن تبرز الملخصات النقاط المشتركة والموضوعات المتكررة.

أعد النتائج بتنسيق JSON كما يلي:
{
  "categories": [
    {
      "name": "اسم الفئة",
      "comments": [1, 5, 9], 
      "summary": "ملخص التعليقات في هذه الفئة",
      "sentiment": 0.7
    },
    {
      "name": "فئة أخرى",
      "comments": [2, 3, 6],
      "summary": "ملخص التعليقات في هذه الفئة",
      "sentiment": -0.4
    }
  ]
}

يجب أن يظهر كل تعليق في فئة واحدة بالضبط. يجب أن تتوافق أرقام التعليقات مع الأرقام التي حددتها أعلاه. يجب أن تكون درجة المشاعر رقمًا بين -1 و 1.`;
    } else {
      promptContent = `Please categorize each of the following comments into exactly one category based on its primary topic or sentiment. Each comment must be assigned to exactly one category.

Comments:
${comments.map((comment, index) => `${index+1}. ${comment}`).join('\n')}

For each category:
1. Provide a descriptive category name
2. List the comment numbers that belong to this category
3. Write a concise and precise summary that captures the key points from all comments in this category
4. Analyze the sentiment of the comments in this category on a scale from -1 (very negative) to 1 (very positive)

Create summaries that are concise, precise, and truly reflective of most comments in each category. Summaries should highlight common points and recurring themes.

Return the results in JSON format like this:
{
  "categories": [
    {
      "name": "Category Name",
      "comments": [1, 5, 9], 
      "summary": "Summary of comments in this category",
      "sentiment": 0.7
    },
    {
      "name": "Another Category",
      "comments": [2, 3, 6],
      "summary": "Summary of comments in this category",
      "sentiment": -0.4
    }
  ]
}

Each comment must appear in exactly one category. The comment numbers should correspond to the numbers I assigned above. The sentiment score should be a number between -1 and 1.`;
    }
    
    // Call Claude API
    console.log('Sending request to Claude API...');
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: promptContent
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });
    
    // Parse the response
    const jsonData = parseClaudeResponse(response);
    
    res.json(jsonData);
  } catch (error) {
    console.error('Error proxying to Claude API:');
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Request setup error:', error.message);
    }
    
    res.status(500).json({
      error: 'Failed to process with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Improved function to parse Claude API responses with better error handling
// Improved function to parse Claude API responses with better handling of Arabic content
function parseClaudeResponse(response) {
  try {
    // First try to get the content from the response
    const responseContent = response.data.content[0].text;
    
    // Log the first part of the response for debugging
    console.log('Raw Claude response (first 200 chars):', responseContent.substring(0, 200));
    
    // Check if the response is conversational rather than JSON
    if (responseContent.startsWith('قبل') || 
        responseContent.startsWith('هل') || 
        responseContent.startsWith('سأقوم بإعداد') ||
        responseContent.startsWith('نظرًا لحجم') ||
        responseContent.startsWith('I need') ||
        responseContent.startsWith('Before I') || 
        responseContent.includes('would you like me to')) {
      console.log('Received conversational response instead of JSON. Returning empty result.');
      return { categorizedComments: [], extractedTopics: [] };
    }
    
    // Try to extract JSON from the response
    let jsonString = responseContent;
    
    // Try to find JSON code blocks first
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else {
      // Look for JSON-like content with curly braces
      const jsonObjectMatch = responseContent.match(/({[\s\S]*})/);
      if (jsonObjectMatch && jsonObjectMatch[1]) {
        jsonString = jsonObjectMatch[1].trim();
      }
    }
    
    // Apply comprehensive JSON fixes
    jsonString = fixArabicCategoryJSON(jsonString);
    
    // Log for debugging (limit to avoid flooding logs)
    console.log('Clean JSON string (first 100 chars):', jsonString.substring(0, 100));
    
    try {
      // Try to parse the JSON
      const jsonData = JSON.parse(jsonString);
      return jsonData;
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('JSON string (first 500 chars):', jsonString.substring(0, 500));
      
      // Try more aggressive fixes
      const fixedJsonString = aggressiveJSONFix(jsonString);
      
      try {
        const fixedJsonData = JSON.parse(fixedJsonString);
        console.log('Successfully parsed JSON after aggressive fixing');
        return fixedJsonData;
      } catch (secondError) {
        console.error('Second JSON parse error:', secondError.message);
        
        // Try to extract just the categorizedComments array as a last resort
        try {
          const extractedData = extractCategorizedComments(jsonString);
          if (extractedData.categorizedComments.length > 0) {
            console.log('Successfully extracted comments array with', extractedData.categorizedComments.length, 'items');
            return extractedData;
          }
        } catch (extractError) {
          console.error('Failed to extract comments array:', extractError.message);
        }
        
        // Return empty result if all parsing attempts fail
        return { categorizedComments: [], extractedTopics: [] };
      }
    }
  } catch (error) {
    console.error('Error in parseClaudeResponse:', error);
    return { categorizedComments: [], extractedTopics: [] };
  }
}

// New comprehensive function to fix Arabic category JSON issues
function fixArabicCategoryJSON(jsonString) {
  console.log('Applying Arabic category JSON fixes...');
  
  // Fix the most common patterns from your logs
  let fixed = jsonString;
  
  // Pattern 1: "مالية": التسعير -> "مالية: التسعير"
  fixed = fixed.replace(/"مالية":\s*التسعير/g, '"مالية: التسعير"');
  
  // Pattern 2: "مشكلات "تقنية": -> "مشكلات تقنية:"
  fixed = fixed.replace(/"مشكلات\s+"تقنية":\s*([^,}"]+)/g, '"مشكلات تقنية: $1"');
  
  // Pattern 3: "ملاحظات "العملاء": -> "ملاحظات العملاء:"
  fixed = fixed.replace(/"ملاحظات\s+"العملاء":\s*([^,}"]+)/g, '"ملاحظات العملاء: $1"');
  
  // Pattern 4: Fix incomplete category names that end with comma instead of quote
  fixed = fixed.replace(/"category":\s*([^",}]+),/g, '"category": "$1",');
  
  // Pattern 5: Fix the specific patterns seen in logs
  fixed = fixed.replace(/"category":\s*"مالية":\s*([^",}]+),/g, '"category": "مالية: $1",');
  fixed = fixed.replace(/"category":\s*"مشكلات\s+"تقنية":\s*([^",}]+),/g, '"category": "مشكلات تقنية: $1",');
  
  // Pattern 6: Fix any remaining malformed category patterns
  fixed = fixed.replace(/"category":\s*"([^"]*)"([^"]*)":\s*([^",}]+),/g, '"category": "$1$2: $3",');
  
  // Pattern 7: Ensure all category values are properly quoted
  fixed = fixed.replace(/"category":\s*([^",{}]+)([,}])/g, '"category": "$1"$2');
  
  // General cleanup
  fixed = fixed
    .replace(/\\"/g, '"')           // Fix escaped quotes
    .replace(/\\n/g, ' ')           // Replace newlines with spaces
    .replace(/,\s*}/g, '}')         // Remove trailing commas
    .replace(/,\s*]/g, ']')         // Remove trailing commas in arrays
    .replace(/"{2,}/g, '"')         // Fix multiple consecutive quotes
    .replace(/:\s*,/g, ': "",')     // Fix empty values
    .replace(/\[\s*,/g, '[')        // Fix arrays starting with comma
    .replace(/,\s*,/g, ',');        // Fix double commas
  
  return fixed;
}

// More aggressive JSON fixing for stubborn cases
function aggressiveJSONFix(jsonString) {
  console.log('Applying aggressive JSON fixes...');
  
  let fixed = jsonString;
  
  // Fix unbalanced braces
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  
  if (openBraces > closeBraces) {
    const missing = openBraces - closeBraces;
    fixed += '}'.repeat(missing);
  }
  
  // Fix unbalanced brackets
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/\]/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    const missing = openBrackets - closeBrackets;
    fixed += ']'.repeat(missing);
  }
  
  // Fix incomplete objects - if we see an incomplete comment, close it
  if (fixed.includes('"comment":') && !fixed.match(/"comment":\s*"[^"]*"/)) {
    fixed = fixed.replace(/"comment":\s*"([^"]*$)/, '"comment": "$1"');
  }
  
  // Ensure the JSON ends properly
  if (!fixed.trim().endsWith('}') && !fixed.trim().endsWith(']')) {
    if (fixed.includes('"categorizedComments":')) {
      fixed += ']}';
    } else {
      fixed += '}';
    }
  }
  
  return fixed;
}

// Extract categorizedComments array even from severely malformed JSON
function extractCategorizedComments(jsonString) {
  console.log('Attempting to extract categorized comments from malformed JSON...');
  
  const result = { categorizedComments: [], extractedTopics: [] };
  
  // Try to find individual comment objects using regex
  const commentPattern = /"id":\s*(\d+),\s*"comment":\s*"([^"]+)",\s*"category":\s*"([^"]+)",\s*"topics":\s*\[([^\]]*)\]/g;
  
  let match;
  while ((match = commentPattern.exec(jsonString)) !== null) {
    try {
      const [, id, comment, category, topicsStr] = match;
      
      // Parse topics array
      let topics = [];
      if (topicsStr.trim()) {
        topics = topicsStr.split(',').map(topic => 
          topic.trim().replace(/^["']|["']$/g, '')
        ).filter(topic => topic.length > 0);
      }
      
      result.categorizedComments.push({
        id: parseInt(id),
        comment: comment,
        category: category,
        topics: topics
      });
    } catch (e) {
      console.log('Failed to parse individual comment, skipping...');
    }
  }
  
  return result;
}

// Function to thoroughly clean a JSON string
function cleanJsonString(jsonString) {
  return jsonString
    .replace(/\\"/g, '"')      // Fix escaped quotes
    .replace(/\\n/g, ' ')      // Replace newlines with spaces
    .replace(/\\/g, '\\\\')    // Escape backslashes
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
    .replace(/,\s*}/g, '}')    // Remove trailing commas
    .replace(/,\s*]/g, ']')    // Remove trailing commas in arrays
    .replace(/[\u0600-\u06FF]+/g, function(match) {
      // Keep Arabic text but make sure it's properly escaped
      return match;
    })
    .replace(/[\u4e00-\u9fff]+/g, function(match) {
      // Replace Chinese characters with placeholders
      return '"[Chinese characters]"';
    })
    .replace(/…/g, '...')      // Replace ellipsis
    .replace(/[^\x00-\x7F]+:/g, function(match) {
      // Fix non-ASCII characters in property names
      const cleanKey = match.replace(/[^\x00-\x7F]/g, '').replace(/:/g, '');
      return `"${cleanKey}":`;
    });
}

// Function to attempt to fix broken JSON string
function fixJsonString(jsonString) {
  // First, check if we have balanced braces
  const openBraces = (jsonString.match(/{/g) || []).length;
  const closeBraces = (jsonString.match(/}/g) || []).length;
  
  let fixedString = jsonString;
  
  // If unbalanced, try to complete the JSON
  if (openBraces > closeBraces) {
    const missingBraces = openBraces - closeBraces;
    fixedString += '}'.repeat(missingBraces);
  }
  
  // Check for balanced square brackets
  const openBrackets = (fixedString.match(/\[/g) || []).length;
  const closeBrackets = (fixedString.match(/\]/g) || []).length;
  
  if (openBrackets > closeBrackets) {
    const missingBrackets = openBrackets - closeBrackets;
    fixedString += ']'.repeat(missingBrackets);
  }
  
  // Replace problematic characters in property values
  fixedString = fixedString
    .replace(/:\s*([^",\{\[\}\]]+)(\s*[,\}\]])/g, function(match, value, ending) {
      // If value doesn't start with a quote and isn't a number, boolean, or null, wrap it in quotes
      const trimmedValue = value.trim();
      if (!trimmedValue.match(/^(true|false|null|\d+|\d+\.\d+)$/)) {
        return ': "' + trimmedValue + '"' + ending;
      }
      return match;
    });
  
  return fixedString;
}

// Improved categorizeComments function with better error handling
async function categorizeComments(comments, apiKey) {
  try {
    // Get comments from request
    if (!comments || !Array.isArray(comments) || comments.length === 0) {
      throw new Error('No comments provided');
    }

    console.log(`Processing ${comments.length} comments for categorization...`);
    
    // Process in smaller batches to avoid Claude's input token limits
    const batchSize = 50; // Even smaller batch size for more reliable processing
    const batches = [];
    
    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches of ${batchSize} comments each`);
    
    // Process all batches
    let allCategorizedComments = [];
    let allExtractedTopics = new Set();
      
      // Replace the batch processing loop in your /api/categorize endpoint with this improved version:

for (let i = 0; i < batches.length; i++) {
  const batchComments = batches[i];
  const batchStartIndex = i * batchSize;
  
  console.log(`Processing batch ${i+1}/${batches.length}`);
  
  try {
    // Longer delay between batches (except for first batch)
    if (i > 0) {
      console.log('Waiting 20 seconds between batches to avoid rate limits...');
      await delay(20000);
    }
    
    // Detect language
    const language = detectLanguage(batchComments);
    
    // Create a more explicit prompt that demands JSON-only response
    let promptContent;
    
    if (language === 'ar') {
      promptContent = `CRITICAL: Return ONLY valid JSON. No explanations, no Arabic text outside JSON values.

Categorize each comment into exactly one category from this list:
- مشكلات تقنية: تحديث التطبيق
- مشكلات تقنية: تجميد/بطء التطبيق  
- مشكلات تقنية: مشكلات التطبيق
- مشكلات تقنية: لا يعمل
- مشكلات تقنية: تسجيل الدخول والوصول
- مشكلات تقنية: الأمان
- ملاحظات العملاء: معقد
- ملاحظات العملاء: خدمة العملاء
- ملاحظات العملاء: التصميم
- ملاحظات العملاء: مسيء
- ملاحظات العملاء: شكرًا
- مالية: احتيال
- مالية: التسعير
- مالية: طلب استرداد

Comments to categorize:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

Return ONLY this JSON structure (no other text):
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "comment text here",
      "category": "exact category name from list above",
      "topics": ["topic1", "topic2"]
    }
  ],
  "extractedTopics": []
}`;
    } else {
      promptContent = `CRITICAL: Return ONLY valid JSON. No explanations, no conversational text.

Categorize each comment into exactly one category from this list:
- Technical issues: App update
- Technical issues: App Freeze/Slow
- Technical issues: App issues
- Technical issues: Doesn't work
- Technical issues: Login and Access
- Technical issues: Security
- Customer Feedback: Complicated
- Customer Feedback: Customer Service
- Customer Feedback: Design
- Customer Feedback: Offensive
- Customer Feedback: Thank you
- Monetary: Fraud
- Monetary: Pricing
- Monetary: Refund Request

Comments to categorize:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

Return ONLY this JSON structure (no other text):
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "comment text here", 
      "category": "exact category name from list above",
      "topics": ["topic1", "topic2"]
    }
  ],
  "extractedTopics": []
}`;
    }
    
    console.log(`Sending categorization request to Claude API for batch ${i+1}...`);
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 4000,
      system: "You are a JSON-only categorization tool. Return only valid JSON with no explanations or conversational text. Do not start responses with explanatory text in any language.",
      messages: [
        {
          role: 'user',
          content: promptContent
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      timeout: 45000 // Reduced timeout
    });
    
    // Process the response with improved parser
    const batchResult = parseClaudeResponseImproved(response);
    const validResults = batchResult.categorizedComments?.length || 0;
    
    console.log(`Batch ${i+1} processed successfully, got ${validResults} categorized comments`);
    
    // CRITICAL CHECK: If first batch fails completely, stop processing
    if (i === 0 && validResults === 0) {
      console.error('FIRST BATCH PARSE FAILURE: No comments were successfully categorized from the first batch.');
      console.error('This indicates a systematic parsing issue. Stopping all batch processing to avoid wasting API calls.');
      
      // Log the raw response for debugging
      const responseContent = response.data.content[0].text;
      console.error('Raw response from first batch (first 500 chars):', responseContent.substring(0, 500));
      
      throw new Error('First batch parsing failed completely. This suggests a systematic issue with the prompt or response format. Please check the API response format and try again.');
    }
    
    // Add to accumulated results
    if (batchResult.categorizedComments && Array.isArray(batchResult.categorizedComments)) {
      allCategorizedComments = [...allCategorizedComments, ...batchResult.categorizedComments];
    }
    
    if (batchResult.extractedTopics && Array.isArray(batchResult.extractedTopics)) {
      batchResult.extractedTopics.forEach(topicInfo => {
        allExtractedTopics.add(JSON.stringify(topicInfo));
      });
    }
    
    // Optional: Also check if success rate is too low after first few batches
    if (i === 2) { // After processing 3 batches
      const totalProcessed = allCategorizedComments.length;
      const totalExpected = (i + 1) * batchSize;
      const successRate = (totalProcessed / totalExpected) * 100;
      
      if (successRate < 30) { // Less than 30% success rate
        console.warn(`LOW SUCCESS RATE DETECTED: Only ${successRate.toFixed(1)}% of comments successfully categorized after 3 batches.`);
        console.warn('This may indicate persistent parsing issues. Consider stopping or adjusting the approach.');
        
        // Optionally, you can choose to stop here too:
        // throw new Error(`Success rate too low (${successRate.toFixed(1)}%). Stopping to avoid wasting resources.`);
      }
    }
    
  } catch (error) {
    console.error(`Error processing batch ${i+1}:`, error.message);
    
    // If this is the first batch and it's a critical error, stop everything
    if (i === 0) {
      console.error('CRITICAL: First batch failed with error. Stopping all processing.');
      throw error; // Re-throw to stop the entire process
    }
    
    // For timeout errors on subsequent batches, try to continue with a longer delay
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.log('Timeout detected, waiting longer before continuing...');
      await delay(30000); // Wait 30 seconds after timeout
    }
    
    // For other errors on subsequent batches, continue processing
    console.log(`Continuing with remaining batches despite error in batch ${i+1}`);
    continue;
  }
}
    
    // Merge all extracted topics
    const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
      try {
        return JSON.parse(topicStr);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    // Sort topics by count (most mentioned first)
    mergedTopics.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    // Return the combined results
    const finalResult = {
      categorizedComments: allCategorizedComments,
      extractedTopics: mergedTopics
    };
    
    console.log(`Categorization complete. Processed ${allCategorizedComments.length} comments out of ${comments.length} (${Math.round(allCategorizedComments.length/comments.length*100)}%)`);
    
    return finalResult;
  } catch (error) {
    console.error('Error in categorizeComments function:', error);
    throw error;
  }
}

// Add this function to your server.js file

/**
 * Fix category names specifically for the issue with extra quotes in Arabic categories
 * @param {string} jsonString - JSON string to fix
 * @returns {string} - Fixed JSON string
 */
function fixCategoryNames(jsonString) {
  // Fix the specific pattern where """: appears in category names
  let fixed = jsonString.replace(/"category":\s*""":\s*([^"]+)"/g, '"category": "مالية: $1"');
  
  // Fix the pattern where "مشكلات "": appears
  fixed = fixed.replace(/"category":\s*"مشكلات "":\s*([^"]+)"/g, '"category": "مشكلات تقنية: $1"');
  
  // Fix any other cases with mixed quotes in category names
  fixed = fixed.replace(/"category":\s*"([^"]*)"([^"]*)"([^"]*)"/g, '"category": "$1$2$3"');
  
  return fixed;
}

// Then modify your cleanJsonString function to include this fix:
function cleanJsonString(jsonString) {
  // Apply category name fix first
  jsonString = fixCategoryNames(jsonString);
  
  return jsonString
    .replace(/\\"/g, '"')      // Fix escaped quotes
    .replace(/\\n/g, ' ')      // Replace newlines with spaces
    .replace(/\\/g, '\\\\')    // Escape backslashes
    .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
    .replace(/,\s*}/g, '}')    // Remove trailing commas
    .replace(/,\s*]/g, ']')    // Remove trailing commas in arrays
    .replace(/[\u0600-\u06FF]+:/g, function(match) {
      // Properly quote Arabic property names
      const cleanKey = match.replace(/:/g, '');
      return `"${cleanKey}":`;
    })
    .replace(/"""/g, '"')      // Fix triple quotes
    .replace(/"{2,}/g, '"')    // Fix any sequence of multiple quotes
    .replace(/[\u4e00-\u9fff]+/g, function(match) {
      // Replace Chinese characters with placeholders
      return '"[Chinese characters]"';
    })
    .replace(/…/g, '...')      // Replace ellipsis
    .replace(/[^\x00-\x7F]+:/g, function(match) {
      // Fix non-ASCII characters in property names
      const cleanKey = match.replace(/[^\x00-\x7F]/g, '').replace(/:/g, '');
      return `"${cleanKey}":`;
    });
}

// Catch-all route - serve the main HTML file for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
});
