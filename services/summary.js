const axios = require('axios');
const { detectLanguage } = require('../utils/helpers');
const { parseClaudeResponse } = require('../utils/processing');

async function summarizeComments(categorizedComments, extractedTopics, apiKey) {
  console.log(`Summarizing ${categorizedComments.length} categorized comments...`);
  
  // Group comments by category
  const commentsByCategory = {};
  categorizedComments.forEach(item => {
    if (!commentsByCategory[item.category]) {
      commentsByCategory[item.category] = [];
    }
    commentsByCategory[item.category].push(item.comment);
  });
  
  // Detect language
  const sampleComments = categorizedComments.map(item => item.comment).slice(0, 10);
  const language = detectLanguage(sampleComments);
  
  // Limit comments per category to avoid token limits
  const limitedCommentsByCategory = {};
  for (const category in commentsByCategory) {
    limitedCommentsByCategory[category] = commentsByCategory[category].slice(0, 50);
    if (commentsByCategory[category].length > 50) {
      console.log(`Limited category ${category} from ${commentsByCategory[category].length} to 50 comments for summarization`);
    }
  }
  
  const promptContent = createSummaryPrompt(limitedCommentsByCategory, commentsByCategory, extractedTopics, language);
  
  console.log('Sending summarization request to Claude API...');
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 8191,
    messages: [{ role: 'user', content: promptContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    timeout: 300000 // 5-minute timeout
  });
  
  const summaryData = parseClaudeResponse(response);
  
  // Add actual comment counts for each category
  if (summaryData.summaries && Array.isArray(summaryData.summaries)) {
    summaryData.summaries.forEach(summary => {
      if (commentsByCategory[summary.category]) {
        summary.commentCount = commentsByCategory[summary.category].length;
      }
    });
  }
  
  return summaryData;
}

function createSummaryPrompt(limitedCommentsByCategory, commentsByCategory, extractedTopics, language) {
  if (language === 'ar') {
    return `قم بتلخيص التعليقات في كل فئة وتقديم إجراءات مقترحة استنادًا إلى المشكلات المشتركة.

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
    return `Summarize the comments in each category and provide suggested actions based on common issues.

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
}

async function testCategorization(apiKey) {
  console.log('Running categorization test with 5 sample comments...');
  
  const testComments = [
    "التطبيق لا يعمل بشكل صحيح",
    "خدمة العملاء ممتازة", 
    "الرسوم مرتفعة جداً",
    "App is very slow",
    "Great customer service"
  ];
  
  const language = detectLanguage(testComments);
  console.log(`Detected language: ${language}`);
  
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
    messages: [{ role: 'user', content: promptContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    timeout: 30000
  });
  
  const testResult = parseClaudeResponse(response);
  const successCount = testResult.categorizedComments?.length || 0;
  const successRate = (successCount / testComments.length) * 100;
  
  console.log(`Test completed: ${successCount}/${testComments.length} comments categorized (${successRate}%)`);
  
  return {
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
}

module.exports = {
  summarizeComments,
  testCategorization
};