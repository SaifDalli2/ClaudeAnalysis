const axios = require('axios');
const { detectLanguage, delay } = require('../utils/helpers');
const { parseClaudeResponse, generateJobId } = require('../utils/processing');

// In-memory storage for processing jobs (use Redis in production)
const processingJobs = new Map();

function startCategorization(comments, apiKey, options = {}) {
  const jobId = generateJobId();
  
  // Extract options
  const { industry, categories, userId } = options;
  
  // Calculate estimates
  const estimatedBatches = Math.ceil(comments.length / 30);
  const estimatedTimeMinutes = Math.ceil(estimatedBatches * 1.5);
  
  // Initialize job status with industry information
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
    totalBatches: estimatedBatches,
    lastActivity: new Date(),
    retryCount: 0,
    successfulBatches: 0,
    failedBatches: 0,
    industry: industry || 'default',
    categoriesUsed: categories ? categories.length : 'default'
  });
  
  console.log(`🏭 Job ${jobId} - Industry: ${industry || 'default'}`);
  console.log(`📊 Job ${jobId} - Categories: ${categories ? categories.length + ' industry-specific' : 'default set'}`);
  
  if (categories && categories.length > 0) {
    console.log(`📋 Job ${jobId} - Category list: ${categories.slice(0, 3).join(', ')}${categories.length > 3 ? '...' : ''}`);
  }
  
  // Start processing asynchronously
  processCommentsAsync(jobId, comments, apiKey, { industry, categories, userId });

  // Set up cleanup (4 hours)
  setTimeout(() => {
    if (processingJobs.has(jobId)) {
      console.log(`Cleaning up job ${jobId} after 4 hours`);
      processingJobs.delete(jobId);
    }
  }, 14400000);
  
  return {
    jobId: jobId,
    status: 'started',
    message: 'Processing started successfully. Use the job ID to check status.',
    totalComments: comments.length,
    estimatedBatches: estimatedBatches,
    estimatedTimeMinutes: estimatedTimeMinutes,
    statusEndpoint: `/api/categorize/${jobId}/status`,
    resultsEndpoint: `/api/categorize/${jobId}/results`,
    cancelEndpoint: `/api/categorize/${jobId}/cancel`,
    tips: [
      'Processing happens in the background',
      'Check status every 30-60 seconds',
      'Partial results are available as processing continues',
      'Large datasets may take 1-3 hours to complete'
    ]
  };
}

function getJobStatus(jobId) {
  const job = processingJobs.get(jobId);
  if (!job) return null;
  
  const progressPercentage = job.totalBatches > 0 
    ? Math.round((job.batchesCompleted / job.totalBatches) * 100)
    : 0;
  
  const elapsedMs = new Date() - job.startTime;
  const elapsedMinutes = Math.round(elapsedMs / 60000 * 10) / 10;
  
  const response = {
    jobId: jobId,
    status: job.status,
    progress: progressPercentage,
    batchesCompleted: job.batchesCompleted,
    totalBatches: job.totalBatches,
    processedComments: job.processedComments || 0,
    totalComments: job.totalComments,
    elapsedMinutes: elapsedMinutes,
    error: job.error,
    hasPartialResults: !!(job.categorizedComments && job.categorizedComments.length > 0),
    partialResultsCount: job.categorizedComments ? job.categorizedComments.length : 0
  };
  
  // Always include partial results if available, regardless of status
  if (job.categorizedComments && job.categorizedComments.length > 0) {
    response.categorizedComments = job.categorizedComments;
    response.extractedTopics = job.extractedTopics || [];
    console.log(`Job ${jobId} status: Including ${job.categorizedComments.length} partial results`);
  }
  
  return response;
}

function getJobResults(jobId) {
  const job = processingJobs.get(jobId);
  if (!job) return null;
  
  // Allow results retrieval for completed jobs OR jobs with partial results
  if (job.status !== 'completed' && job.status !== 'failed' && (!job.categorizedComments || job.categorizedComments.length === 0)) {
    throw new Error('Job not completed yet and no partial results available');
  }
  
  // Always return available results, even if partial
  const results = {
    categorizedComments: job.categorizedComments || [],
    extractedTopics: job.extractedTopics || [],
    status: job.status,
    processedComments: job.processedComments || 0,
    totalComments: job.totalComments || 0,
    error: job.error,
    isPartial: job.status !== 'completed' || (job.processedComments || 0) < (job.totalComments || 0)
  };
  
  console.log(`Job ${jobId} results retrieved: ${results.categorizedComments.length} categorized comments, status: ${results.status}`);
  
  return results;
}

function cancelJob(jobId) {
  const job = processingJobs.get(jobId);
  if (!job) return null;
  
  job.status = 'cancelled';
  job.error = 'Job cancelled by user';
  
  console.log(`Job ${jobId} cancelled by user. Processed ${job.processedComments || 0}/${job.totalComments} comments.`);
  
  return {
    message: 'Job cancelled successfully',
    partialResults: {
      categorizedComments: job.categorizedComments || [],
      extractedTopics: job.extractedTopics || [],
      processedComments: job.processedComments || 0,
      totalComments: job.totalComments
    }
  };
}

async function processCommentsAsync(jobId, comments, apiKey, options = {}) {
  const job = processingJobs.get(jobId);
  if (!job) return;
  
  const { industry, categories, userId } = options;
  
  // Set up timeout handling
  const timeoutDuration = 25 * 60 * 1000; // 25 minutes
  const timeoutHandler = setTimeout(() => {
    if (job && job.status === 'processing') {
      console.log(`Job ${jobId} timed out after 25 minutes, but ${job.processedComments || 0} comments were successfully processed`);
      job.status = 'completed'; // Mark as completed with partial results
      job.error = `Processing timed out after 25 minutes. Successfully processed ${job.processedComments || 0}/${comments.length} comments.`;
      
      // Ensure results are preserved
      if (job.categorizedComments && job.categorizedComments.length > 0) {
        console.log(`Preserving ${job.categorizedComments.length} categorized comments from timeout`);
      }
    }
  }, timeoutDuration);
  
  try {
    console.log(`Starting async processing for job ${jobId} with ${comments.length} comments`);
    
    // Log industry context
    if (industry) {
      console.log(`🏭 Processing with industry: ${industry}`);
    }
    if (categories && categories.length > 0) {
      console.log(`📊 Using ${categories.length} industry-specific categories`);
    }
    
    job.status = 'processing';
    job.progress = 0;
    
    const batchSize = 30;
    const batches = [];
    
    for (let i = 0; i < comments.length; i += batchSize) {
      batches.push(comments.slice(i, i + batchSize));
    }
    
    job.totalBatches = batches.length;
    console.log(`Split into ${batches.length} batches of ${batchSize} comments each`);
    
    let allCategorizedComments = [];
    let allExtractedTopics = new Set();
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 8;
    let totalFailures = 0;
    const maxTotalFailureRate = 0.6;
    
    const retryConfig = {
      maxRetries: 3,
      baseDelay: 45000,
      backoffMultiplier: 1.5,
      timeoutMs: 90000
    };
    
    // Process each batch with industry context
    for (let i = 0; i < batches.length; i++) {
      const batchComments = batches[i];
      const batchStartIndex = i * batchSize;
      
      console.log(`Job ${jobId}: Processing batch ${i+1}/${batches.length}`);
      
      let batchSuccess = false;
      let lastError = null;
      
      // Retry logic for each batch
      for (let retryAttempt = 0; retryAttempt <= retryConfig.maxRetries; retryAttempt++) {
        try {
          // Progressive delay
          const baseDelay = i > 0 ? retryConfig.baseDelay : 5000;
          const failureMultiplier = Math.min(3, 1 + (consecutiveFailures * 0.5));
          const retryMultiplier = Math.pow(retryConfig.backoffMultiplier, retryAttempt);
          const delayTime = baseDelay * failureMultiplier * retryMultiplier;
          
          if (i > 0 || retryAttempt > 0) {
            console.log(`Job ${jobId}: Waiting ${Math.round(delayTime/1000)} seconds...`);
            await delay(delayTime);
          }
          
          // Check if job was cancelled
          if (job.status === 'cancelled') {
            console.log(`Job ${jobId} was cancelled, stopping processing`);
            return;
          }
          
          // Pass industry categories to batch processing
          const result = await processBatch(batchComments, batchStartIndex, apiKey, { categories });
          const validResults = result.categorizedComments?.length || 0;
          const expectedResults = batchComments.length;
          const batchSuccessRate = validResults / expectedResults;
          
          if (batchSuccessRate >= 0.3) {
            batchSuccess = true;
            consecutiveFailures = 0;
            
            // Add results
            if (result.categorizedComments && Array.isArray(result.categorizedComments)) {
              allCategorizedComments = [...allCategorizedComments, ...result.categorizedComments];
              job.processedComments = allCategorizedComments.length;
              job.categorizedComments = allCategorizedComments;
            }
            
            if (result.extractedTopics && Array.isArray(result.extractedTopics)) {
              result.extractedTopics.forEach(topicInfo => {
                allExtractedTopics.add(JSON.stringify(topicInfo));
              });
              
              const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
                try { return JSON.parse(topicStr); } catch (e) { return null; }
              }).filter(Boolean);
              job.extractedTopics = mergedTopics;
            }
            
            break;
          } else {
            throw new Error(`Low success rate: only ${Math.round(batchSuccessRate * 100)}% of comments processed`);
          }
          
        } catch (batchError) {
          lastError = batchError;
          console.error(`Job ${jobId}: Error in batch ${i+1}${retryAttempt > 0 ? ` retry ${retryAttempt}` : ''}: ${batchError.message}`);
          
          if (batchError.message.includes('Invalid API key')) {
            console.error(`Job ${jobId}: Authentication error, stopping all processing`);
            job.status = 'failed';
            job.error = batchError.message;
            return;
          }
          
          if (retryAttempt === retryConfig.maxRetries) {
            console.error(`Job ${jobId}: Batch ${i+1} failed after ${retryConfig.maxRetries + 1} attempts`);
            break;
          }
        }
      }
      
      if (!batchSuccess) {
        consecutiveFailures++;
        totalFailures++;
      }
      
      // Update progress
      job.batchesCompleted = i + 1;
      job.progress = Math.round((job.batchesCompleted / job.totalBatches) * 100);
      
      // Check stopping conditions
      const currentFailureRate = totalFailures / (i + 1);
      
      if (consecutiveFailures >= maxConsecutiveFailures && i < 5) {
        console.error(`Job ${jobId}: ${consecutiveFailures} consecutive failures in early batches - stopping`);
        job.status = 'failed';
        job.error = `Too many consecutive failures (${consecutiveFailures})`;
        return;
      }
      
      if (currentFailureRate > maxTotalFailureRate && i >= 10 && allCategorizedComments.length < comments.length * 0.2) {
        console.error(`Job ${jobId}: High failure rate (${Math.round(currentFailureRate * 100)}%) - stopping`);
        job.status = 'failed';
        job.error = `High failure rate: ${Math.round(currentFailureRate * 100)}% of batches failed`;
        return;
      }
    }
    
    // Finalize processing
    clearTimeout(timeoutHandler); // Clear the timeout since we completed normally
    
    const mergedTopics = Array.from(allExtractedTopics).map(topicStr => {
      try { return JSON.parse(topicStr); } catch (e) { return null; }
    }).filter(Boolean);
    
    mergedTopics.sort((a, b) => (b.count || 0) - (a.count || 0));
    
    job.categorizedComments = allCategorizedComments;
    job.extractedTopics = mergedTopics;
    job.status = 'completed';
    job.progress = 100;
    
    const successRate = Math.round((allCategorizedComments.length / comments.length) * 100);
    console.log(`Job ${jobId}: Processing complete. Processed ${allCategorizedComments.length}/${comments.length} comments (${successRate}%)`);
    
  } catch (error) {
    clearTimeout(timeoutHandler); // Clear the timeout on error
    console.error(`Job ${jobId}: Fatal error:`, error);
    job.status = 'failed';
    job.error = error.message;
    
    // Always preserve partial results even on error
    if (job.categorizedComments && job.categorizedComments.length > 0) {
      console.log(`Job ${jobId}: Failed but preserving ${job.categorizedComments.length} partial results`);
      job.status = 'completed'; // Change to completed so results are accessible
      job.error = `Processing failed but preserved ${job.categorizedComments.length} partial results: ${error.message}`;
    }
  }
}

async function processBatch(batchComments, batchStartIndex, apiKey, options = {}) {
  const { categories } = options;
  const language = detectLanguage(batchComments);
  
  let promptContent;
  if (language === 'ar') {
    promptContent = createArabicPrompt(batchComments, batchStartIndex, categories);
  } else {
    promptContent = createEnglishPrompt(batchComments, batchStartIndex, categories);
  }
  
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 4000,
    system: "Return only valid JSON. No explanations. No conversational text. Just JSON.",
    messages: [{ role: 'user', content: promptContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    timeout: 90000,
    validateStatus: function (status) {
      return status < 500;
    }
  });
  
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers['retry-after']) || 60;
    await delay(retryAfter * 1000 + 10000);
    throw new Error(`Rate limited, retry after ${retryAfter} seconds`);
  }
  
  if (response.status === 401) {
    throw new Error('Invalid API key. Please check your Claude API key.');
  }
  
  if (response.status >= 400) {
    throw new Error(`API returned status ${response.status}: ${response.data?.error?.message || 'Unknown error'}`);
  }
  
  return parseClaudeResponse(response);
}

function createArabicPrompt(batchComments, batchStartIndex, categories) {
  // Use industry-specific categories if provided, otherwise use default
  const categoryList = categories && categories.length > 0 ? categories : [
    'مشكلات تقنية: تحديث التطبيق',
    'مشكلات تقنية: تجميد/بطء التطبيق',
    'مشكلات تقنية: مشكلات التطبيق',
    'مشكلات تقنية: لا يعمل',
    'مشكلات تقنية: تسجيل الدخول والوصول',
    'مشكلات تقنية: الأمان',
    'ملاحظات العملاء: معقد',
    'ملاحظات العملاء: خدمة العملاء',
    'ملاحظات العملاء: التصميم',
    'ملاحظات العملاء: مسيء',
    'ملاحظات العملاء: شكرًا',
    'مالية: احتيال',
    'مالية: التسعير',
    'مالية: طلب استرداد'
  ];

  return `أرجع فقط JSON صالح. لا تكتب أي نص آخر.

صنف كل تعليق إلى فئة واحدة من هذه القائمة:
${categoryList.map(cat => `- ${cat}`).join('\n')}

التعليقات:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

أرجع هذا JSON فقط:
{"categorizedComments":[{"id":1,"comment":"النص","category":"اسم الفئة","topics":["موضوع"]}],"extractedTopics":[]}`;
}

function createEnglishPrompt(batchComments, batchStartIndex, categories) {
  // Use industry-specific categories if provided, otherwise use default
  const categoryList = categories && categories.length > 0 ? categories : [
    'Technical issues: App update',
    'Technical issues: App Freeze/Slow',
    'Technical issues: App issues',
    'Technical issues: Doesn\'t work',
    'Technical issues: Login and Access',
    'Technical issues: Security',
    'Customer Feedback: Complicated',
    'Customer Feedback: Customer Service',
    'Customer Feedback: Design',
    'Customer Feedback: Offensive',
    'Customer Feedback: Thank you',
    'Monetary: Fraud',
    'Monetary: Pricing',
    'Monetary: Refund Request'
  ];

  return `Return only valid JSON. No other text.

Categorize each comment into one category from this list:
${categoryList.map(cat => `- ${cat}`).join('\n')}

Comments:
${batchComments.map((comment, index) => `${batchStartIndex + index + 1}. ${comment}`).join('\n')}

Return only this JSON:
{"categorizedComments":[{"id":1,"comment":"text","category":"category name","topics":["topic"]}],"extractedTopics":[]}`;
}

module.exports = {
  startCategorization,
  getJobStatus,
  getJobResults,
  cancelJob
};