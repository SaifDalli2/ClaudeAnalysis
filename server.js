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


// NEW ENDPOINT: Step 1 - Categorize comments
app.post('/api/categorize', async (req, res) => {
  try {
    // Get comments from request
    const { comments, apiKey } = req.body;
    
    // Validate API key - make this check earlier to fail fast
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
    
    // Process in smaller batches to avoid Claude's input token limits
    const batchSize = 100; // Smaller batch size for more reliable processing
    const batches = [];
    
    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }
    
    console.log(`Split into ${batches.length} batches of ${batchSize} comments each`);
    
    // Process all batches
    let allCategorizedComments = [];
    let allExtractedTopics = new Set();
    
    for (let i = 0; i < batches.length; i++) {
      const batchComments = batches[i];
      const batchStartIndex = i * batchSize;
      
      console.log(`Processing batch ${i+1}/${batches.length}`);
      
      try {
        // Wait between batches to avoid rate limits - longer delay
        if (i > 0) {
          console.log('Waiting 15 seconds between batches to avoid rate limits...');
          await delay(15000); // Increased from 10s to 15s
        }
        
        // Detect language of the comments
        const language = detectLanguage(batchComments);
        
        // Create prompt based on detected language
        let promptContent;
        
        if (language === 'ar') {
          promptContent = `قم بتصنيف كل من التعليقات التالية إلى فئة واحدة بالضبط من الفئات المحددة مسبقًا، واستخرج أيضًا الكيانات والموضوعات المهمة.

الفئات المحددة مسبقًا:
[مشكلات تقنية: تحديث التطبيق، تجميد/بطء التطبيق، مشكلات التطبيق، لا يعمل، تسجيل الدخول والوصول، الأمان]
[ملاحظات العملاء: معقد، خدمة العملاء، التصميم، مسيء، شكرًا]
[مالية: احتيال، التسعير، طلب استرداد]

التعليقات:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

مطلوب منك القيام بمهمتين:

المهمة 1: لكل تعليق، حدد:
1. رقم التعليق
2. الفئة الرئيسية (اختر واحدة فقط من الفئات المحددة مسبقًا)
3. الموضوعات المحددة داخل التعليق (يمكن أن يكون هناك أكثر من موضوع واحد)

المهمة 2: استخرج قائمة بجميع الكيانات المهمة المذكورة في التعليقات، مثل:
- أسماء العلامات التجارية
- المنتجات
- الخدمات
- الأماكن
- المواقع الإلكترونية
- التطبيقات
- أي كيانات مميزة أخرى

أعد النتائج بتنسيق JSON كما يلي:
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "نص التعليق",
      "category": "مشكلات تقنية: تحديث التطبيق",
      "topics": ["تحديث التطبيق", "بطء التطبيق"]
    },
    {
      "id": 2,
      "comment": "نص تعليق آخر",
      "category": "ملاحظات العملاء: خدمة العملاء",
      "topics": ["خدمة العملاء", "تجربة سيئة"]
    }
  ],
  "extractedTopics": [
    {
      "topic": "اسم المنتج",
      "type": "منتج",
      "count": 5,
      "commentIds": [1, 3, 5, 7, 9]
    },
    {
      "topic": "اسم العلامة التجارية",
      "type": "علامة تجارية",
      "count": 3,
      "commentIds": [2, 4, 8]
    }
  ]
}

تأكد من تعيين كل تعليق إلى واحدة فقط من الفئات المحددة مسبقًا. اختر أكثر فئة مناسبة بناءً على المحتوى.`;
        } else {
          promptContent = `Categorize each of the following comments into exactly one of the predefined categories and also extract important entities and topics.

Predefined Categories:
[Technical issues: App update, App Freeze/Slow, App issues, Doesn't work, Login and Access, Security]
[Customer Feedback: Complicated, Customer Service, Design, Offensive, Thank you]
[Monetary: Fraud, Pricing, Refund Request]

Comments:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

You have TWO tasks:

Task 1: For each comment, identify:
1. The comment number
2. The main category (choose only one from the predefined categories)
3. The specific topics mentioned in the comment (there can be more than one topic)

Task 2: Extract a list of all significant entities mentioned in the comments, such as:
- Brand names
- Products
- Services
- Places
- Websites
- Applications
- Any other distinctive entities

Return the results in JSON format like this:
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "The comment text",
      "category": "Technical issues: App update",
      "topics": ["App update", "App slow"]
    },
    {
      "id": 2,
      "comment": "Another comment text",
      "category": "Customer Feedback: Customer Service",
      "topics": ["Customer Service", "Bad experience"]
    }
  ],
  "extractedTopics": [
    {
      "topic": "Product Name",
      "type": "product",
      "count": 5,
      "commentIds": [1, 3, 5, 7, 9]
    },
    {
      "topic": "Brand Name",
      "type": "brand",
      "count": 3,
      "commentIds": [2, 4, 8]
    }
  ]
}

Make sure to assign each comment to exactly one of the predefined categories. Choose the most appropriate category based on the content.`;
        }
        
        // Call Claude API
        console.log(`Sending categorization request to Claude API for batch ${i+1}...`);
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
        
        // Process the response
        const batchResult = parseClaudeResponse(response);
        console.log(`Batch ${i+1} processed successfully, got ${batchResult.categorizedComments?.length || 0} categorized comments`);
        
        // Add to our accumulated results
        if (batchResult.categorizedComments && Array.isArray(batchResult.categorizedComments)) {
          allCategorizedComments = [...allCategorizedComments, ...batchResult.categorizedComments];
        }
        
        // Collect extracted topics
        if (batchResult.extractedTopics && Array.isArray(batchResult.extractedTopics)) {
          batchResult.extractedTopics.forEach(topicInfo => {
            allExtractedTopics.add(JSON.stringify(topicInfo));
          });
        }
        
      } catch (error) {
        console.error(`Error processing batch ${i+1}:`, error.message);
        // Continue with next batch instead of failing completely
      }
    }
    
    // Merge all extracted topics
    const mergedTopics = Array.from(allExtractedTopics).map(topicStr => JSON.parse(topicStr));
    
    // Sort topics by count (most mentioned first)
    mergedTopics.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    // Return the combined results
    const finalResult = {
      categorizedComments: allCategorizedComments,
      extractedTopics: mergedTopics
    };
    
    console.log(`Categorization complete. Processed ${allCategorizedComments.length} comments out of ${comments.length} (${Math.round(allCategorizedComments.length/comments.length*100)}%)`);
    
    res.json(finalResult);
    
  } catch (error) {
    console.error('Error in /api/categorize endpoint:', error);
    
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
      error: 'Failed to categorize with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

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
    // This handles cases where Claude asks questions or provides explanations in Arabic or English
    if (responseContent.startsWith('قبل') || 
        responseContent.startsWith('هل') || 
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
    
    // Attempt to clean the JSON string before parsing
    jsonString = cleanJsonString(jsonString);
    
    // Log for debugging (limit to avoid flooding logs)
    console.log('Clean JSON string (first 100 chars):', jsonString.substring(0, 100));
    
    try {
      // Try to parse the JSON
      const jsonData = JSON.parse(jsonString);
      return jsonData;
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('JSON string (first 500 chars):', jsonString.substring(0, 500));
      
      // If parsing fails, try to manually fix common JSON issues
      const fixedJsonString = fixJsonString(jsonString);
      
      // Try parsing again after fixes
      try {
        const fixedJsonData = JSON.parse(fixedJsonString);
        console.log('Successfully parsed JSON after fixing common issues');
        return fixedJsonData;
      } catch (secondError) {
        // If still failing, try a different approach: extract just the categorizedComments array
        console.error('Second JSON parse error:', secondError.message);
        
        try {
          const commentsMatch = jsonString.match(/"categorizedComments"\s*:\s*(\[\s*{[\s\S]*?}\s*\])/);
          if (commentsMatch && commentsMatch[1]) {
            const commentsArrayString = commentsMatch[1];
            const cleanedCommentsString = cleanJsonString(commentsArrayString);
            const commentsArray = JSON.parse(cleanedCommentsString);
            
            console.log('Successfully extracted comments array with', commentsArray.length, 'items');
            return { 
              categorizedComments: commentsArray,
              extractedTopics: []
            };
          }
        } catch (extractError) {
          console.error('Failed to extract comments array:', extractError.message);
        }
        
        // For the original endpoint
        return { categorizedComments: [], extractedTopics: [] };
      }
    }
  } catch (error) {
    console.error('Error in parseClaudeResponse:', error);
    
    // Return a valid but empty response
    return { categorizedComments: [], extractedTopics: [] };
  }
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
    
    for (let i = 0; i < batches.length; i++) {
      const batchComments = batches[i];
      const batchStartIndex = i * batchSize;
      
      console.log(`Processing batch ${i+1}/${batches.length}`);
      
      try {
        // Wait between batches to avoid rate limits - longer delay
        if (i > 0) {
          console.log('Waiting 20 seconds between batches to avoid rate limits...');
          await delay(20000); // Increased from 15s to 20s
        }
        
        // Detect language of the comments
        const language = detectLanguage(batchComments);
        
        // Choose a consistent system message language
        const systemMessage = "Please respond in JSON format only, not conversation. Parse the comments according to instructions.";
        
        // Create prompt based on detected language
        let promptContent;
        
        if (language === 'ar') {
          promptContent = `${systemMessage}
          
قم بتصنيف كل من التعليقات التالية إلى فئة واحدة بالضبط من الفئات المحددة مسبقًا، واستخرج أيضًا الكيانات والموضوعات المهمة.

الفئات المحددة مسبقًا:
[مشكلات تقنية: تحديث التطبيق، تجميد/بطء التطبيق، مشكلات التطبيق، لا يعمل، تسجيل الدخول والوصول، الأمان]
[ملاحظات العملاء: معقد، خدمة العملاء، التصميم، مسيء، شكرًا]
[مالية: احتيال، التسعير، طلب استرداد]

التعليقات:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

مطلوب منك القيام بمهمتين:

المهمة 1: لكل تعليق، حدد:
1. رقم التعليق
2. الفئة الرئيسية (اختر واحدة فقط من الفئات المحددة مسبقًا)
3. الموضوعات المحددة داخل التعليق (يمكن أن يكون هناك أكثر من موضوع واحد)

المهمة 2: استخرج قائمة بجميع الكيانات المهمة المذكورة في التعليقات، مثل:
- أسماء العلامات التجارية
- المنتجات
- الخدمات
- الأماكن
- المواقع الإلكترونية
- التطبيقات
- أي كيانات مميزة أخرى

أعد النتائج بتنسيق JSON كما يلي فقط، بدون أي نص إضافي:
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "نص التعليق",
      "category": "مشكلات تقنية: تحديث التطبيق",
      "topics": ["تحديث التطبيق", "بطء التطبيق"]
    }
  ],
  "extractedTopics": [
    {
      "topic": "اسم المنتج",
      "type": "منتج",
      "count": 5,
      "commentIds": [1, 3, 5, 7, 9]
    }
  ]
}`;
        } else {
          promptContent = `${systemMessage}
          
Categorize each of the following comments into exactly one of the predefined categories and also extract important entities and topics.

Predefined Categories:
[Technical issues: App update, App Freeze/Slow, App issues, Doesn't work, Login and Access, Security]
[Customer Feedback: Complicated, Customer Service, Design, Offensive, Thank you]
[Monetary: Fraud, Pricing, Refund Request]

Comments:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

You have TWO tasks:

Task 1: For each comment, identify:
1. The comment number
2. The main category (choose only one from the predefined categories)
3. The specific topics mentioned in the comment (there can be more than one topic)

Task 2: Extract a list of all significant entities mentioned in the comments, such as:
- Brand names
- Products
- Services
- Places
- Websites
- Applications
- Any other distinctive entities

Return ONLY the results in JSON format like this, with no additional text:
{
  "categorizedComments": [
    {
      "id": 1,
      "comment": "The comment text",
      "category": "Technical issues: App update",
      "topics": ["App update", "App slow"]
    }
  ],
  "extractedTopics": [
    {
      "topic": "Product Name",
      "type": "product",
      "count": 5,
      "commentIds": [1, 3, 5, 7, 9]
    }
  ]
}`;
        }
        
        // Call Claude API with better error handling
        console.log(`Sending categorization request to Claude API for batch ${i+1}...`);
        try {
          const response = await axios.post('https://api.anthropic.com/v1/messages', {
            model: 'claude-3-5-haiku-latest',
            max_tokens: 4000, // Reduced to avoid memory issues
            system: systemMessage,
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
            timeout: 60000 // 1-minute timeout - reduced from 5 minutes
          });
          
          // Process the response with our improved parser
          const batchResult = parseClaudeResponse(response);
          const validResults = batchResult.categorizedComments?.length || 0;
          
          console.log(`Batch ${i+1} processed successfully, got ${validResults} categorized comments`);
          
          // Add to our accumulated results
          if (batchResult.categorizedComments && Array.isArray(batchResult.categorizedComments)) {
            allCategorizedComments = [...allCategorizedComments, ...batchResult.categorizedComments];
          }
          
          // Collect extracted topics
          if (batchResult.extractedTopics && Array.isArray(batchResult.extractedTopics)) {
            batchResult.extractedTopics.forEach(topicInfo => {
              allExtractedTopics.add(JSON.stringify(topicInfo));
            });
          }
        } catch (claudeError) {
          console.error(`Error calling Claude API for batch ${i+1}:`, claudeError.message);
          
          if (claudeError.response) {
            console.error('Claude API response:', claudeError.response.status, claudeError.response.data);
          }
          
          // Continue with next batch instead of failing completely
        }
      } catch (batchError) {
        console.error(`Error processing batch ${i+1}:`, batchError.message);
        // Continue with next batch instead of failing completely
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

// Catch-all route - serve the main HTML file for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
});
