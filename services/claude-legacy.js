const axios = require('axios');
const { detectLanguage } = require('../utils/helpers');
const { parseClaudeResponse } = require('../utils/processing');

async function processCommentsLegacy(comments, apiKey) {
  const language = detectLanguage(comments);
  const promptContent = createLegacyPrompt(comments, language);
  
  console.log('Sending request to Claude API...');
  const response = await axios.post('https://api.anthropic.com/v1/messages', {
    model: 'claude-3-5-haiku-latest',
    max_tokens: 4000,
    messages: [{ role: 'user', content: promptContent }]
  }, {
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }
  });
  
  return parseClaudeResponse(response);
}

function createLegacyPrompt(comments, language) {
  if (language === 'ar') {
    return `قم بتصنيف كل من التعليقات التالية إلى فئة واحدة بالضبط بناءً على موضوعها الرئيسي أو المشاعر. يجب تعيين كل تعليق إلى فئة واحدة بالضبط.

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
    return `Please categorize each of the following comments into exactly one category based on its primary topic or sentiment. Each comment must be assigned to exactly one category.

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
}

module.exports = {
  processCommentsLegacy
};