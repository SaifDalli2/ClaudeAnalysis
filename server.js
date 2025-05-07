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
    
    // Detect language of the comments
    const language = detectLanguage(comments);
    
    // Create prompt based on detected language
    let promptContent;
    
    if (language === 'ar') {
      promptContent = `قم بتصنيف كل من التعليقات التالية إلى فئة واحدة بالضبط من الفئات المحددة مسبقًا أدناه.

الفئات المحددة مسبقًا:
[مشكلات تقنية: تحديث التطبيق، تجميد/بطء التطبيق، مشكلات التطبيق، لا يعمل، تسجيل الدخول والوصول، الأمان]
[ملاحظات العملاء: معقد، خدمة العملاء، التصميم، مسيء، شكرًا]
[مالية: احتيال، التسعير، طلب استرداد]

التعليقات:
${comments.map((comment, index) => `${index+1}. ${comment}`).join('\n')}

لكل تعليق، حدد:
1. رقم التعليق
2. الفئة الرئيسية (اختر واحدة فقط من الفئات المحددة مسبقًا)
3. الموضوعات المحددة داخل التعليق (يمكن أن يكون هناك أكثر من موضوع واحد)

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
  ]
}

تأكد من تعيين كل تعليق إلى واحدة فقط من الفئات المحددة مسبقًا. اختر أكثر فئة مناسبة بناءً على المحتوى.`;
    } else {
      promptContent = `Categorize each of the following comments into exactly one of the predefined categories listed below.

Predefined Categories:
[Technical issues: App update, App Freeze/Slow, App issues, Doesn't work, Login and Access, Security]
[Customer Feedback: Complicated, Customer Service, Design, Offensive, Thank you]
[Monetary: Fraud, Pricing, Refund Request]

Comments:
${comments.map((comment, index) => `${index+1}. ${comment}`).join('\n')}

For each comment, identify:
1. The comment number
2. The main category (choose only one from the predefined categories)
3. The specific topics mentioned in the comment (there can be more than one topic)

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
  ]
}

Make sure to assign each comment to exactly one of the predefined categories. Choose the most appropriate category based on the content.`;
    }
    
    // Call Claude API
    console.log('Sending categorization request to Claude API...');
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest', // Using your model from original code
      max_tokens: 8192, // Increase token limit for large batches
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
      timeout: 300000 // 5-minute timeout for large batches
    });
    
    // Extract the response content
    const responseContent = response.data.content[0].text;
    
    // Try to extract JSON from the response
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/) || 
                      responseContent.match(/({[\s\S]*})/);
    
    let categorizedData;
    if (jsonMatch && jsonMatch[1]) {
      categorizedData = JSON.parse(jsonMatch[1].trim());
    } else {
      categorizedData = JSON.parse(responseContent);
    }
    
    res.json(categorizedData);
  } catch (error) {
    console.error('Error proxying categorization to Claude API:');
    
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
    const { categorizedComments, apiKey } = req.body;
    
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
    
    // Create prompt based on detected language
    let promptContent;
    
    if (language === 'ar') {
      promptContent = `قم بتلخيص التعليقات في كل فئة وتقديم إجراءات مقترحة استنادًا إلى المشكلات المشتركة.

التعليقات المصنفة حسب الفئة:
${Object.entries(commentsByCategory).map(([category, comments]) => 
  `# ${category}\n${comments.map((comment, i) => `- ${comment}`).join('\n')}`
).join('\n\n')}

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
  ]
}

تأكد من أن يكون الملخص موجزًا ولكن شاملًا، والإجراءات المقترحة قابلة للتنفيذ وذات صلة مباشرة بالمشكلات المذكورة.`;
    } else {
      promptContent = `Summarize the comments in each category and provide suggested actions based on common issues.

Categorized comments:
${Object.entries(commentsByCategory).map(([category, comments]) => 
  `# ${category}\n${comments.map((comment, i) => `- ${comment}`).join('\n')}`
).join('\n\n')}

For each category, provide:
1. A concise summary (3-5 sentences) that captures the key points and sentiment
2. An analysis of common issues mentioned
3. 2-3 suggested actions to address these issues

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
  ]
}

Make sure the summary is concise but comprehensive, and the suggested actions are actionable and directly relevant to the issues mentioned.`;
    }
    
    // Call Claude API
    console.log('Sending summarization request to Claude API...');
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-5-haiku-latest', // Using your model from original code
      max_tokens: 8192, // Increase token limit for large summaries
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
      timeout: 300000 // 5-minute timeout for large batches
    });
    
    // Extract the response content
    const responseContent = response.data.content[0].text;
    
    // Try to extract JSON from the response
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/) || 
                      responseContent.match(/({[\s\S]*})/);
    
    let summaryData;
    if (jsonMatch && jsonMatch[1]) {
      summaryData = JSON.parse(jsonMatch[1].trim());
    } else {
      summaryData = JSON.parse(responseContent);
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
    
    // Extract the response content
    const responseContent = response.data.content[0].text;
    
    // Try to extract JSON from the response
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/) || 
                      responseContent.match(/({[\s\S]*})/);
    
    let jsonData;
    if (jsonMatch && jsonMatch[1]) {
      jsonData = JSON.parse(jsonMatch[1].trim());
    } else {
      jsonData = JSON.parse(responseContent);
    }
    
    res.json(jsonData);
  } catch (error) {
    console.error('Error proxying to Claude API:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    res.status(500).json({
      error: 'Failed to process with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Catch-all route - serve the main HTML file for any unknown routes
// This ensures that client-side routing works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
