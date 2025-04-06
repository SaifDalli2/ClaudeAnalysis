// Store comments
let comments = [];

// Debug mode
const DEBUG = true;

// Current language (en or ar)
let currentLang = 'en';

// Translations for dynamic content
const translations = {
  en: {
    showComments: 'Show Comments',
    hideComments: 'Hide Comments',
    noCommentsAlert: 'Please add some comments first.',
    apiKeyAlert: 'Please enter your Claude API key.',
    csvFileAlert: 'Please select a CSV file first.',
    emptyCSVAlert: 'The CSV file appears to be empty.',
    noCommentsFoundAlert: 'No comments found in the CSV file. Make sure it has a "comment" column or one comment per line.',
    csvLoadSuccess: 'Successfully loaded {count} comments from CSV.',
    apiError: 'There was an error connecting to the Claude API. Using simulation instead.\n\nError: {message}\n\nNote: This app needs a backend server to proxy requests to Claude API.',
    processingError: 'Error processing comments: {message}',
    positive: 'Positive',
    negative: 'Negative',
    sentiment: 'Sentiment: {score}',
    selectedFile: 'Selected file: {filename} ({size})'
  },
  ar: {
    showComments: 'عرض التعليقات',
    hideComments: 'إخفاء التعليقات',
    noCommentsAlert: 'الرجاء إضافة بعض التعليقات أولاً.',
    apiKeyAlert: 'الرجاء إدخال مفتاح Claude API الخاص بك.',
    csvFileAlert: 'الرجاء تحديد ملف CSV أولاً.',
    emptyCSVAlert: 'يبدو أن ملف CSV فارغ.',
    noCommentsFoundAlert: 'لم يتم العثور على تعليقات في ملف CSV. تأكد من أنه يحتوي على عمود "comment" أو تعليق واحد لكل سطر.',
    csvLoadSuccess: 'تم تحميل {count} تعليقات من CSV بنجاح.',
    apiError: 'حدث خطأ أثناء الاتصال بـ Claude API. استخدام المحاكاة بدلاً من ذلك.\n\nخطأ: {message}\n\nملاحظة: يحتاج هذا التطبيق إلى خادم خلفي لتوجيه الطلبات إلى Claude API.',
    processingError: 'خطأ في معالجة التعليقات: {message}',
    positive: 'إيجابي',
    negative: 'سلبي',
    sentiment: 'المشاعر: {score}',
    selectedFile: 'الملف المحدد: {filename} ({size})'
  }
};

// Wait for DOM to fully load before accessing elements
document.addEventListener('DOMContentLoaded', function() {
  // DOM elements
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
