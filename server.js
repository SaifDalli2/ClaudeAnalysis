const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// Increase limits to handle large batches of comments
app.use(express.json({ limit: '50mb' }));  
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// NEW ENDPOINT: Step 1 - Categorize comments
app.post('/api/categorize', async (req, res) => {
  try {
    // Get comments from request
    const { comments, apiKey } = req.body;
    
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
        // Wait between batches to avoid rate limits
        if (i > 0) {
          console.log('Waiting 10 seconds between batches to avoid rate limits...');
          await delay(10000);
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
function parseClaudeResponse(response) {
  try {
    // First try to get the content from the response
    const responseContent = response.data.content[0].text;
    
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
    // Remove comment lines and other non-JSON content
    jsonString = jsonString.replace(/\/\/.*$/gm, ''); // Remove single-line comments
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    
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
      jsonString = jsonString
        .replace(/\\"/g, '"')      // Fix escaped quotes
        .replace(/\\n/g, ' ')      // Replace newlines with spaces
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
        .replace(/,\s*}/g, '}')    // Remove trailing commas
        .replace(/,\s*]/g, ']');   // Remove trailing commas in arrays
      
      // Try parsing again after fixes
      try {
        const fixedJsonData = JSON.parse(jsonString);
        console.log('Successfully parsed JSON after fixing common issues');
        return fixedJsonData;
      } catch (secondError) {
        // If still failing, try to reconstruct a minimal valid response
        console.error('Second JSON parse error:', secondError.message);
        
        // For categorization endpoint, return a minimal valid response
        if (jsonString.includes('categorizedComments')) {
          return { categorizedComments: [], extractedTopics: [] };
        }
        
        // For summarization endpoint
        if (jsonString.includes('summaries')) {
          return { summaries: [], topTopics: [] };
        }
        
        // For the original endpoint
        return { categories: [] };
      }
    }
  } catch (error) {
    console.error('Error in parseClaudeResponse:', error);
    
    // Return a valid but empty response based on context clues in the error
    const errorMsg = error.message?.toLowerCase() || '';
    if (errorMsg.includes('categorized')) {
      return { categorizedComments: [], extractedTopics: [] };
    } else if (errorMsg.includes('summar')) {
      return { summaries: [], topTopics: [] };
    } else {
      return { categories: [] };
    }
  }
}

// Catch-all route - serve the main HTML file for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
