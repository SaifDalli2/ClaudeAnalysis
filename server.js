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

// Add this test endpoint to your server.js to validate the parsing works before processing large batches

app.post('/api/test-categorize', async (req, res) => {
  try {
    const { apiKey } = req.body;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return res.status(400).json({ 
        error: 'Invalid API key', 
        details: 'A valid Claude API key must be provided' 
      });
    }
    
    // Test with a small set of mixed language comments
    const testComments = [
      "التطبيق لا يعمل بشكل صحيح",
      "خدمة العملاء ممتازة", 
      "الرسوم مرتفعة جداً",
      "App is very slow",
      "Great customer service"
    ];
    
    console.log('Running categorization test with 5 sample comments...');
    
    // Detect language
    const language = detectLanguage(testComments);
    console.log(`Detected language: ${language}`);
    
    // Create test prompt
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
${testComments.map((comment, index) => `${index + 1}. ${comment}`).join('\n')}

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
${testComments.map((comment, index) => `${index + 1}. ${comment}`).join('\n')}

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
    
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest',
      max_tokens: 2000,
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
      timeout: 30000
    });
    
    // Test the parser
    const testResult = parseClaudeResponseImproved(response, 0);
    const successCount = testResult.categorizedComments?.length || 0;
    const successRate = (successCount / testComments.length) * 100;
    
    console.log(`Test completed: ${successCount}/${testComments.length} comments categorized (${successRate}%)`);
    
    const testSummary = {
      status: successRate >= 80 ? 'PASS' : successRate >= 50 ? 'WARNING' : 'FAIL',
      successRate: successRate,
      successCount: successCount,
      totalComments: testComments.length,
      detectedLanguage: language,
      categorizedComments: testResult.categorizedComments,
      recommendation: successRate >= 80 
        ? 'System is working well. You can proceed with larger batches.' 
        : successRate >= 50 
          ? 'Partial success. Consider smaller batch sizes or reviewing the prompts.'
          : 'System has issues. Check API key, prompts, and parsing logic before processing large batches.'
    };
    
    res.json(testSummary);
    
  } catch (error) {
    console.error('Test categorization error:', error);
    
    res.status(500).json({
      status: 'ERROR',
      error: 'Test failed',
      details: error.response?.data?.error || error.message,
      recommendation: 'Check your API key and internet connection. Review server logs for more details.'
    });
  }
});

// NEW ENDPOINT: Step 1 - Categorize comments
// NEW ENDPOINT: Step 1 - Categorize comments - FIXED VERSION
// Add to your server.js - Replace the existing /api/categorize endpoint

// In-memory storage for processing jobs (in production, use Redis or a database)
const processingJobs = new Map();

// Helper function to generate unique job IDs
function generateJobId() {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// NEW APPROACH: Start async processing and return immediately
app.post('/api/categorize', async (req, res) => {
  try {
    const { comments, apiKey } = req.body;
    
    // Validate inputs
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

    // Create a job ID and start processing asynchronously
    const jobId = generateJobId();
    
    // Initialize job status
    processingJobs.set(jobId, {
      status: 'starting',
      progress: 0,
      totalComments: comments.length,
      processedComments: 0,
      categorizedComments: [],
      extractedTopics: [],
      error: null,
      startTime: new Date(),
      batchesCompleted: 0,
      totalBatches: Math.ceil(comments.length / 50)
    });
    
    // Start processing in the background (don't await)
    processCommentsAsync(jobId, comments, apiKey);
    
    // Return immediately with job ID
    res.json({
      jobId: jobId,
      status: 'started',
      message: 'Processing started. Use the job ID to check status.',
      totalComments: comments.length,
      estimatedBatches: Math.ceil(comments.length / 50),
      estimatedTimeMinutes: Math.ceil(comments.length / 50) * 0.5 // Rough estimate
    });
    
  } catch (error) {
    console.error('Error starting categorization job:', error);
    res.status(500).json({
      error: 'Failed to start categorization job',
      details: error.message
    });
  }
});

// Status endpoint to check job progress
app.get('/api/categorize/:jobId/status', (req, res) => {
  const jobId = req.params.jobId;
  const job = processingJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      details: 'The specified job ID does not exist or has expired.'
    });
  }
  
  // Calculate progress percentage
  const progressPercentage = job.totalBatches > 0 
    ? Math.round((job.batchesCompleted / job.totalBatches) * 100)
    : 0;
  
  // Calculate elapsed time
  const elapsedMs = new Date() - job.startTime;
  const elapsedMinutes = Math.round(elapsedMs / 60000 * 10) / 10;
  
  res.json({
    jobId: jobId,
    status: job.status,
    progress: progressPercentage,
    batchesCompleted: job.batchesCompleted,
    totalBatches: job.totalBatches,
    processedComments: job.processedComments,
    totalComments: job.totalComments,
    elapsedMinutes: elapsedMinutes,
    error: job.error,
    // Include results if completed
    ...(job.status === 'completed' && {
      categorizedComments: job.categorizedComments,
      extractedTopics: job.extractedTopics
    })
  });
});

// Enhanced server.js sections - ADD these improvements to your existing server.js

// 1. Enhanced job status endpoint to return partial results
app.get('/api/categorize/:jobId/results', (req, res) => {
  const jobId = req.params.jobId;
  const job = processingJobs.get(jobId);
  
  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      details: 'The specified job ID does not exist or has expired.'
    });
  }
  
  if (job.status !== 'completed' && job.status !== 'failed') {
    return res.status(425).json({
      error: 'Job not completed',
      details: 'The job is still processing.',
      progress: Math.round((job.batchesCompleted / job.totalBatches) * 100)
    });
  }
  
  // Return results even if job failed but has partial results
  res.json({
    categorizedComments: job.categorizedComments || [],
    extractedTopics: job.extractedTopics || [],
    status: job.status,
    processedComments: job.processedComments || 0,
    totalComments: job.totalComments || 0,
    error: job.error
  });
});

// 2. Enhanced async processing function with better timeout handling
async function processCommentsAsync(jobId, comments, apiKey) {
  const job = processingJobs.get(jobId);
  if (!job) return;
  
  try {
    console.log(`Starting async processing for job ${jobId} with ${comments.length} comments`);
    
    job.status = 'processing';
    job.progress = 0;
    
    const batchSize = 50;
    const batches = [];
    
    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }
    
    job.totalBatches = batches.length;
    console.log(`Split into ${batches.length} batches of ${batchSize} comments each`);
    
    let allCategorizedComments = [];
    let allExtractedTopics = new Set();
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 3;
    
    // Process each batch with enhanced error handling
    for (let i = 0; i < batches.length; i++) {
      const batchComments = batches[i];
      const batchStartIndex = i * batchSize;
      
      console.log(`Job ${jobId}: Processing batch ${i+1}/${batches.length}`);
      
      try {
        // **ENHANCED**: Adaptive delay based on previous failures
        if (i > 0) {
          const delayTime = consecutiveFailures > 0 ? 30000 : 15000; // Longer delay after failures
          console.log(`Job ${jobId}: Waiting ${delayTime/1000} seconds between batches...`);
          await delay(delayTime);
        }
        
        // Detect language
        const language = detectLanguage(batchComments);
        
        // Create prompt (same as before)
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
        
        // **ENHANCED**: Adaptive timeout based on batch size and previous failures
        const timeoutMs = Math.min(120000, 45000 + (batchComments.length * 1000) + (consecutiveFailures * 15000));
        
        console.log(`Job ${jobId}: Sending request to Claude API for batch ${i+1}...`);
        
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
          timeout: timeoutMs,
          validateStatus: function (status) {
            return status < 500;
          }
        });
        
        // Handle rate limiting with exponential backoff
        if (response.status === 429) {
          const retryAfter = response.headers['retry-after'] || 60;
          console.log(`Job ${jobId}: Rate limited on batch ${i+1}, waiting ${retryAfter} seconds...`);
          await delay(retryAfter * 1000);
          i--; // Retry this batch
          consecutiveFailures++;
          continue;
        }
        
        if (response.status >= 400) {
          throw new Error(`API returned status ${response.status}: ${response.data?.error?.message || 'Unknown error'}`);
        }
        
        // Parse response
        const batchResult = parseClaudeResponseImproved(response, i);
        const validResults = batchResult.categorizedComments?.length || 0;
        
        console.log(`Job ${jobId}: Batch ${i+1} processed successfully, got ${validResults} categorized comments`);
        
        // **ENHANCED**: Early termination only if first few batches fail completely
        if (i < 3 && validResults === 0) {
          consecutiveFailures++;
          if (consecutiveFailures >= maxConsecutiveFailures) {
            console.error(`Job ${jobId}: ${consecutiveFailures} consecutive batch failures - stopping processing`);
            job.status = 'failed';
            job.error = `Failed after ${consecutiveFailures} consecutive batch failures`;
            return;
          }
        } else {
          consecutiveFailures = 0; // Reset failure counter on success
        }
        
        // Add results
        if (batchResult.categorizedComments && Array.isArray(batchResult.categorizedComments)) {
          allCategorizedComments = [...allCategorizedComments, ...batchResult.categorizedComments];
          job.processedComments = allCategorizedComments.length;
          
          // **ENHANCED**: Update job with partial results for real-time display
          job.categorizedComments = allCategorizedComments;
        }
        
        if (batchResult.extractedTopics && Array.isArray(batchResult.extractedTopics)) {
          batchResult.extractedTopics.forEach(topicInfo => {
            allExtractedTopics.add(JSON.stringify(topicInfo));
          });
          
          // **ENHANCED**: Update job with partial topics
          const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
            try { return JSON.parse(topicStr); } catch (e) { return null; }
          }).filter(Boolean);
          job.extractedTopics = mergedTopics;
        }
        
        // Update progress
        job.batchesCompleted = i + 1;
        job.progress = Math.round((job.batchesCompleted / job.totalBatches) * 100);
        
        console.log(`Job ${jobId}: Progress: ${job.progress}% (${job.batchesCompleted}/${job.totalBatches} batches)`);
        
      } catch (batchError) {
        console.error(`Job ${jobId}: Error processing batch ${i+1}:`, batchError.message);
        consecutiveFailures++;
        
        // **ENHANCED**: More flexible error handling
        if (i === 0 && consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`Job ${jobId}: First batches failed - stopping all processing`);
          job.status = 'failed';
          job.error = `First ${consecutiveFailures} batches failed: ${batchError.message}`;
          return;
        }
        
        // For timeout errors, add adaptive delay
        if (batchError.message.includes('timeout') || batchError.code === 'ECONNABORTED') {
          const timeoutDelay = Math.min(60000, 30000 + (consecutiveFailures * 10000));
          console.log(`Job ${jobId}: Timeout on batch ${i+1}, waiting ${timeoutDelay/1000} seconds before continuing...`);
          await delay(timeoutDelay);
        }
        
        // **ENHANCED**: Continue processing if we have some successful results
        if (allCategorizedComments.length > 0) {
          console.log(`Job ${jobId}: Continuing with remaining batches despite error in batch ${i+1}`);
          continue;
        } else if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`Job ${jobId}: Too many consecutive failures, stopping processing`);
          job.status = 'failed';
          job.error = `Failed after ${consecutiveFailures} consecutive batch failures`;
          return;
        }
      }
    }
    
    // **ENHANCED**: Complete processing even with partial results
    const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
      try {
        return JSON.parse(topicStr);
      } catch (e) {
        return null;
      }
    }).filter(Boolean);
    
    mergedTopics.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    // Update final results
    job.categorizedComments = allCategorizedComments;
    job.extractedTopics = mergedTopics;
    job.status = 'completed';
    job.progress = 100;
    
    const successRate = Math.round((allCategorizedComments.length / comments.length) * 100);
    console.log(`Job ${jobId}: Processing complete. Processed ${allCategorizedComments.length} comments out of ${comments.length} (${successRate}%)`);
    
    // Clean up job after 2 hours (increased from 1 hour)
    setTimeout(() => {
      processingJobs.delete(jobId);
      console.log(`Job ${jobId}: Cleaned up after 2 hours`);
    }, 7200000);
    
  } catch (error) {
    console.error(`Job ${jobId}: Fatal error:`, error);
    job.status = 'failed';
    job.error = error.message;
    
    // **ENHANCED**: Even if job fails, preserve any partial results
    if (job.categorizedComments && job.categorizedComments.length > 0) {
      console.log(`Job ${jobId}: Failed but preserving ${job.categorizedComments.length} partial results`);
    }
  }
}

// 3. Enhanced response parser with better timeout handling
function parseClaudeResponseImproved(response, batchIndex = 0) {
  try {
    const responseContent = response.data.content[0].text;
    
    console.log(`Raw Claude response for batch ${batchIndex + 1} (first 200 chars):`, responseContent.substring(0, 200));
    
    // Check if the response is conversational rather than JSON
    const conversationalPatterns = [
      'سأقوم', 'قبل أن', 'نظرًا ل', 'هل تريد', 'اقتراح:', 'من خلال تحليل',
      'I will', 'Before I', 'Let me', 'Would you like', 'Here is', 'Based on',
      'I understand', 'To categorize', 'Looking at these'
    ];
    
    const isConversational = conversationalPatterns.some(starter => 
      responseContent.trim().toLowerCase().startsWith(starter.toLowerCase())
    );
    
    if (isConversational) {
      console.log(`Batch ${batchIndex + 1}: Detected conversational response, returning empty result`);
      return { categorizedComments: [], extractedTopics: [] };
    }
    
    // Try to extract JSON from the response
    let jsonString = responseContent;
    
    // Try multiple extraction methods
    const extractionMethods = [
      // Method 1: Code blocks
      () => {
        const jsonBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        return jsonBlockMatch ? jsonBlockMatch[1] : null;
      },
      
      // Method 2: First complete JSON object
      () => {
        const firstBrace = responseContent.indexOf('{');
        if (firstBrace === -1) return null;
        
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
        
        return responseContent.substring(firstBrace, endIndex + 1);
      },
      
      // Method 3: Extract between JSON markers
      () => {
        const jsonMatch = responseContent.match(/\{[\s\S]*"categorizedComments"[\s\S]*\}/);
        return jsonMatch ? jsonMatch[0] : null;
      }
    ];
    
    for (const method of extractionMethods) {
      try {
        const extracted = method();
        if (extracted) {
          jsonString = extracted;
          console.log(`Batch ${batchIndex + 1}: Successfully extracted JSON using method`);
          break;
        }
      } catch (e) {
        continue;
      }
    }
    
    if (!jsonString || jsonString === responseContent) {
      console.log(`Batch ${batchIndex + 1}: No JSON extraction method succeeded`);
      if (batchIndex === 0) {
        console.error('FIRST BATCH DIAGNOSTIC: No JSON structure found in response');
        console.error('Response preview:', responseContent.substring(0, 500));
      }
      return { categorizedComments: [], extractedTopics: [] };
    }
    
    // Enhanced JSON cleaning with the thorough function
    console.log(`Batch ${batchIndex + 1}: Applying thorough JSON cleaning...`);
    jsonString = cleanJsonStringThoroughly(jsonString);
    
    console.log(`Batch ${batchIndex + 1}: Cleaned JSON (first 100 chars):`, jsonString.substring(0, 100));
    
    // Multiple parsing attempts with different strategies
    const parsingStrategies = [
      // Strategy 1: Direct parsing
      () => JSON.parse(jsonString),
      
      // Strategy 2: Ultra clean and parse
      () => JSON.parse(ultraCleanJsonString(jsonString)),
      
      // Strategy 3: Reconstruct from patterns
      () => reconstructJsonFromPatternsFixed(jsonString)
    ];
    
    for (let i = 0; i < parsingStrategies.length; i++) {
      try {
        const parsedData = parsingStrategies[i]();
        console.log(`Batch ${batchIndex + 1}: Successfully parsed JSON using strategy ${i + 1}`);
        return parsedData;
      } catch (parseError) {
        console.error(`Batch ${batchIndex + 1}: Strategy ${i + 1} parse error:`, parseError.message);
        continue;
      }
    }
    
    // If all parsing fails
    console.error(`Batch ${batchIndex + 1}: All parsing strategies failed`);
    if (batchIndex === 0) {
      console.error('FIRST BATCH COMPREHENSIVE DIAGNOSTIC:');
      console.error('Original response length:', responseContent.length);
      console.error('Extracted JSON length:', jsonString.length);
      console.error('JSON preview:', jsonString.substring(0, 300));
      console.error('JSON ending:', jsonString.substring(Math.max(0, jsonString.length - 100)));
    }
    
    return { categorizedComments: [], extractedTopics: [] };
    
  } catch (error) {
    console.error(`Batch ${batchIndex + 1}: Error in parseClaudeResponseImproved:`, error);
    if (batchIndex === 0) {
      console.error('FIRST BATCH PARSER ERROR:', error.message);
    }
    return { categorizedComments: [], extractedTopics: [] };
  }
}

// 4. Enhanced JSON reconstruction function
function reconstructJsonFromPatterns(jsonString) {
  console.log('Attempting JSON reconstruction from patterns...');
  
  // More comprehensive regex patterns
  const patterns = [
    // Pattern 1: Standard format
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"[^}]*?"topics":\s*\[([^\]]*)\]/g,
    
    // Pattern 2: Malformed category
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*([^,}]+)[^}]*?"topics":\s*\[([^\]]*)\]/g,
    
    // Pattern 3: Missing topics
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"/g
  ];
  
  let bestResults = [];
  
  for (const pattern of patterns) {
    const results = [];
    let match;
    
    while ((match = pattern.exec(jsonString)) !== null) {
      try {
        const [, id, comment, category, topicsStr] = match;
        
        let topics = [];
        if (topicsStr && topicsStr.trim()) {
          topics = topicsStr.split(',')
            .map(topic => topic.trim().replace(/^["']|["']$/g, ''))
            .filter(topic => topic.length > 0);
        }
        
        // Clean category name
        const cleanCategory = category.replace(/^["']|["']$/g, '').trim();
        
        results.push({
          id: parseInt(id),
          comment: comment,
          category: cleanCategory,
          topics: topics
        });
      } catch (e) {
        console.log('Failed to parse individual match, skipping...');
      }
    }
    
    if (results.length > bestResults.length) {
      bestResults = results;
    }
  }
  
  console.log(`Reconstructed JSON with ${bestResults.length} comments`);
  
  return JSON.stringify({
    categorizedComments: bestResults,
    extractedTopics: []
  });
}

// 3. ADD this improved pattern reconstruction function
function reconstructJsonFromPatternsFixed(jsonString) {
  console.log('Attempting improved JSON reconstruction from patterns...');
  
  try {
    // More comprehensive regex patterns for different malformed cases
    const patterns = [
      // Pattern 1: Standard format
      /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"[^}]*?"topics":\s*\[([^\]]*)\]/g,
      
      // Pattern 2: Malformed category with unescaped content
      /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"?([^",}]+)"?[^}]*?"topics":\s*\[([^\]]*)\]/g,
      
      // Pattern 3: Missing topics array
      /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"/g,
      
      // Pattern 4: Simplified extraction for severely malformed JSON
      /(\d+)\.\s*([^"]*)\s*"category":\s*"?([^",}]+)"?/g
    ];
    
    let bestResults = [];
    
    for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
      const pattern = patterns[patternIndex];
      const results = [];
      let match;
      
      // Reset regex state
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(jsonString)) !== null) {
        try {
          const [, id, comment, category, topicsStr] = match;
          
          let topics = [];
          if (topicsStr && topicsStr.trim()) {
            topics = topicsStr.split(',')
              .map(topic => topic.trim().replace(/^["']|["']$/g, ''))
              .filter(topic => topic.length > 0);
          }
          
          // Clean category name more aggressively
          const cleanCategory = category
            .replace(/^["']|["']$/g, '')
            .replace(/[""]/g, '')
            .trim();
          
          // Validate the extracted data
          if (id && comment && cleanCategory) {
            results.push({
              id: parseInt(id),
              comment: comment.trim(),
              category: cleanCategory,
              topics: topics
            });
          }
        } catch (e) {
          console.log(`Failed to parse individual match in pattern ${patternIndex + 1}, skipping...`);
        }
      }
      
      if (results.length > bestResults.length) {
        bestResults = results;
        console.log(`Pattern ${patternIndex + 1} extracted ${results.length} comments`);
      }
    }
    
    console.log(`Reconstructed JSON with ${bestResults.length} comments using pattern matching`);
    
    return {
      categorizedComments: bestResults,
      extractedTopics: []
    };
    
  } catch (error) {
    console.error('Pattern reconstruction failed:', error);
    return { categorizedComments: [], extractedTopics: [] };
  }
}

// 5. Enhanced ultra clean function
function ultraCleanJsonString(jsonString) {
  try {
    console.log('Performing ultra-aggressive JSON cleaning...');
    
    let cleaned = jsonString;
    
    // Fix the most common Arabic category issues
    const categoryFixes = [
      [/"مالية":\s*التسعير/g, '"مالية: التسعير"'],
      [/"مشكلات\s+"تقنية":\s*([^,}"]+)/g, '"مشكلات تقنية: $1"'],
      [/"ملاحظات\s+"العملاء":\s*([^,}"]+)/g, '"ملاحظات العملاء: $1"'],
      [/"category":\s*"([^"]*)"([^"]*)":\s*([^",}]+)/g, '"category": "$1$2: $3"'],
      [/"category":\s*([^",{}]+)([,}])/g, '"category": "$1"$2']
    ];
    
    for (const [pattern, replacement] of categoryFixes) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    // General structural fixes
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
    
    // Fix unbalanced braces and brackets
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
    
    console.log(`Ultra clean: Fixed structure and category names`);
    return cleaned;
    
  } catch (error) {
    console.error('Ultra clean function error:', error.message);
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

// Add this function to your server.js file - this is the missing function causing the error
function cleanJsonStringThoroughly(jsonString) {
  try {
    console.log('Performing thorough JSON cleaning...');
    
    let cleaned = jsonString;
    
    // Fix the most common Arabic category issues
    const categoryFixes = [
      [/"مالية":\s*التسعير/g, '"مالية: التسعير"'],
      [/"مشكلات\s+"تقنية":\s*([^,}"]+)/g, '"مشكلات تقنية: $1"'],
      [/"ملاحظات\s+"العملاء":\s*([^,}"]+)/g, '"ملاحظات العملاء: $1"'],
      [/"category":\s*"([^"]*)"([^"]*)":\s*([^",}]+)/g, '"category": "$1$2: $3"'],
      [/"category":\s*([^",{}]+)([,}])/g, '"category": "$1"$2']
    ];
    
    for (const [pattern, replacement] of categoryFixes) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    // General structural fixes
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
    
    // Fix unbalanced braces and brackets
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
    
    console.log(`Thorough clean: Fixed structure and category names`);
    return cleaned;
    
  } catch (error) {
    console.error('Thorough clean function error:', error.message);
    return '{"categorizedComments": [], "extractedTopics": []}';
  }
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
    const batchResult = parseClaudeResponseImproved(response, i);
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
