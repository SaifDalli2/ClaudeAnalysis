const axios = require('axios');
const { detectLanguage } = require('../utils/helpers');
const { parseClaudeResponse } = require('../utils/processing');

async function summarizeComments(categorizedComments, extractedTopics, apiKey) {
  console.log(`Summarizing ${categorizedComments.length} categorized comments...`);
  
  // ... existing code ...
  
  const summaryData = parseClaudeResponse(response);
  
  // DEBUG: Log the parsed summary data
  console.log('📊 Parsed summary data structure:', Object.keys(summaryData || {}));
  console.log('📊 Parsed summary data:', summaryData);
  
  // Add actual comment counts for each category
  if (summaryData.summaries && Array.isArray(summaryData.summaries)) {
    summaryData.summaries.forEach(summary => {
      if (commentsByCategory[summary.category]) {
        summary.commentCount = commentsByCategory[summary.category].length;
      }
    });
    console.log(`📊 Enhanced ${summaryData.summaries.length} summaries with comment counts`);
  } else {
    console.warn('⚠️ No summaries array found in parsed data');
    
    // If no summaries found, check if we have categorizedComments instead
    if (summaryData.categorizedComments) {
      console.log('📊 Found categorizedComments in summary data');
    }
  }
  
  return summaryData;
}

/**
 * Enhanced summarizeComments function with better error handling
 */
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
  console.log('📊 Prompt preview (first 500 chars):', promptContent.substring(0, 500));
  
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 8191,
    system: "Return only valid JSON. No explanations. No conversational text. Just JSON with summaries array.",
    messages: [{ role: 'user', content: promptContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    timeout: 300000 // 5-minute timeout
  });
  
  console.log('📊 Raw summary response (first 500 chars):', response.data.content[0].text.substring(0, 500));
  
  const summaryData = parseClaudeResponse(response);
  
  // Enhanced validation and debugging
  console.log('📊 Parsed summary data structure:', Object.keys(summaryData || {}));
  console.log('📊 Has summaries array:', !!(summaryData && summaryData.summaries && Array.isArray(summaryData.summaries)));
  
  if (summaryData && summaryData.summaries && Array.isArray(summaryData.summaries)) {
    console.log(`📊 Found ${summaryData.summaries.length} summaries`);
    
    // Add actual comment counts for each category
    summaryData.summaries.forEach(summary => {
      if (commentsByCategory[summary.category]) {
        summary.commentCount = commentsByCategory[summary.category].length;
      }
    });
    
    console.log(`📊 Enhanced ${summaryData.summaries.length} summaries with comment counts`);
  } else {
    console.warn('⚠️ No summaries array found in parsed data');
    console.log('📊 Available keys in summary data:', Object.keys(summaryData || {}));
    
    // If parsing failed, try to manually extract summaries
    if (response.data.content[0].text) {
      const rawText = response.data.content[0].text;
      console.log('📊 Attempting manual summary extraction...');
      
      // Try to find JSON in the response
      const jsonMatch = rawText.match(/\{[\s\S]*"summaries"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const manualParsed = JSON.parse(jsonMatch[0]);
          console.log('📊 Manual parsing successful');
          return manualParsed;
        } catch (e) {
          console.warn('📊 Manual parsing failed:', e.message);
        }
      }
      
      // Last resort: create summaries from category names
      console.log('📊 Creating fallback summaries from categories...');
      const categoryNames = Object.keys(commentsByCategory);
      const fallbackSummaries = categoryNames.map(categoryName => ({
        category: categoryName,
        commentCount: commentsByCategory[categoryName].length,
        summary: `Category containing ${commentsByCategory[categoryName].length} comments about ${categoryName.toLowerCase()}.`,
        commonIssues: [`Issues related to ${categoryName}`],
        suggestedActions: [`Review ${categoryName} feedback`, `Address ${categoryName} concerns`],
        sentiment: 0
      }));
      
      return {
        summaries: fallbackSummaries,
        topTopics: extractedTopics || []
      };
    }
  }
  
  return summaryData;
}

/**
 * Create summary prompt for categorized comments
 */
function createSummaryPrompt(limitedCommentsByCategory, allCommentsByCategory, extractedTopics, language) {
  if (language === 'ar') {
    return `قم بتحليل التعليقات المصنفة التالية وإنشاء ملخصات مفيدة لكل فئة.

البيانات:
${Object.entries(limitedCommentsByCategory).map(([category, comments]) => 
  `الفئة: ${category}\nعدد التعليقات: ${allCommentsByCategory[category].length}\nالتعليقات:\n${comments.map((comment, i) => `${i+1}. ${comment}`).join('\n')}`
).join('\n\n')}

لكل فئة، قدم:
1. ملخص موجز ودقيق يلتقط النقاط الرئيسية
2. المشاكل الشائعة (2-3 مشاكل)
3. الإجراءات المقترحة (2-3 إجراءات)
4. درجة المشاعر (-1 إلى 1)

أرجع النتائج بتنسيق JSON فقط:
{
  "summaries": [
    {
      "category": "اسم الفئة",
      "summary": "ملخص موجز ودقيق",
      "commonIssues": ["مشكلة 1", "مشكلة 2"],
      "suggestedActions": ["إجراء 1", "إجراء 2"],
      "sentiment": 0.5
    }
  ],
  "topTopics": [
    {"topic": "موضوع", "count": 5}
  ]
}`;
  } else {
    return `Analyze the following categorized comments and create helpful summaries for each category.

Data:
${Object.entries(limitedCommentsByCategory).map(([category, comments]) => 
  `Category: ${category}\nTotal Comments: ${allCommentsByCategory[category].length}\nComments:\n${comments.map((comment, i) => `${i+1}. ${comment}`).join('\n')}`
).join('\n\n')}

For each category, provide:
1. A concise, accurate summary capturing key points
2. Common issues (2-3 issues)
3. Suggested actions (2-3 actions)
4. Sentiment score (-1 to 1)

Return results in JSON format only:
{
  "summaries": [
    {
      "category": "Category Name",
      "summary": "Concise, accurate summary",
      "commonIssues": ["Issue 1", "Issue 2"],
      "suggestedActions": ["Action 1", "Action 2"],
      "sentiment": 0.5
    }
  ],
  "topTopics": [
    {"topic": "topic", "count": 5}
  ]
}`;
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