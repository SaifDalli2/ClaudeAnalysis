// Language translations
window.translations = {
  en: {
    // App header
    "app-title": "Comment Categorization System",
    "app-description": "Enter comments to be categorized and summarized. Each comment will be assigned to exactly one category.",
    
    // Processing section
    "processing-method": "Processing Method",
    "use-simulation": "Use Simulation (No API key required)",
    "use-api": "Use Claude API",
    "api-key": "Claude API Key:",
    "api-key-placeholder": "Enter your Claude API key",
    "api-key-storage": "Your API key is stored locally in your browser only.",
    "note": "Note:",
    "api-instructions": "For this to work with the Claude API:",
    "api-instruction-1": "The app must be deployed with a backend server that proxies requests to Claude API",
    "api-instruction-2": "The API endpoint should be configured at \"/api/claude\"",
    "simulation-fallback": "Otherwise, the app will use simulated results.",
    
    // Tabs
    "manual-entry": "Manual Entry",
    "csv-upload": "CSV Upload",
    
    // Manual entry
    "add-comment": "Add Comment",
    "comment-placeholder": "Type your comment here...",
    "add-comment-btn": "Add Comment",
    
    // CSV upload
    "upload-csv": "Upload CSV File",
    "select-csv": "Select a CSV file with comments (one comment per line or in a 'comment' column):",
    "load-csv": "Load Comments from CSV",
    
    // Comments section
    "comments-list": "Comments List",
    "clear-comments": "Clear All Comments",
    "process-comments": "Process Comments",
    
    // Results section
    "categorized-comments": "Categorized Comments",
    "result-info": "Each comment is assigned to exactly one category based on its primary topic or sentiment.",
    "overall-stats": "Overall Statistics",
    "total-comments": "Total Comments",
    "categories": "Categories",
    "avg-sentiment": "Avg. Sentiment",
    
    // Category display
    "show-comments": "Show Comments",
    "hide-comments": "Hide Comments",
    "sentiment": "Sentiment",
    "negative": "Negative",
    "positive": "Positive",
    "comments": "comments",
    
    // Topics
    "top-topics": "Top Topics Mentioned",
    "topics-description": "Click on a topic to see related comments.",
    
    // Error messages
    "no-comments": "Please add some comments first.",
    "select-csv": "Please select a CSV file first."
  },
  ar: {
    // App header
    "app-title": "نظام تصنيف التعليقات",
    "app-description": "أدخل التعليقات لتصنيفها وتلخيصها. سيتم تخصيص كل تعليق لفئة واحدة بالضبط.",
    
    // Processing section
    "processing-method": "طريقة المعالجة",
    "use-simulation": "استخدام المحاكاة (لا يلزم مفتاح API)",
    "use-api": "استخدام Claude API",
    "api-key": "مفتاح Claude API:",
    "api-key-placeholder": "أدخل مفتاح Claude API الخاص بك",
    "api-key-storage": "يتم تخزين مفتاح API الخاص بك محليًا في متصفحك فقط.",
    "note": "ملاحظة:",
    "api-instructions": "لكي يعمل هذا مع Claude API:",
    "api-instruction-1": "يجب نشر التطبيق باستخدام خادم خلفي يعمل كوسيط للطلبات إلى Claude API",
    "api-instruction-2": "يجب تكوين نقطة نهاية API في \"/api/claude\"",
    "simulation-fallback": "وإلا، سيستخدم التطبيق نتائج المحاكاة.",
    
    // Tabs
    "manual-entry": "إدخال يدوي",
    "csv-upload": "تحميل CSV",
    
    // Manual entry
    "add-comment": "إضافة تعليق",
    "comment-placeholder": "اكتب تعليقك هنا...",
    "add-comment-btn": "إضافة تعليق",
    
    // CSV upload
    "upload-csv": "تحميل ملف CSV",
    "select-csv": "حدد ملف CSV مع التعليقات (تعليق واحد لكل سطر أو في عمود 'comment'):",
    "load-csv": "تحميل التعليقات من CSV",
    
    // Comments section
    "comments-list": "قائمة التعليقات",
    "clear-comments": "مسح جميع التعليقات",
    "process-comments": "معالجة التعليقات",
    
    // Results section
    "categorized-comments": "التعليقات المصنفة",
    "result-info": "يتم تعيين كل تعليق إلى فئة واحدة بالضبط بناءً على موضوعه الرئيسي أو المشاعر.",
    "overall-stats": "الإحصائيات العامة",
    "total-comments": "إجمالي التعليقات",
    "categories": "الفئات",
    "avg-sentiment": "متوسط المشاعر",
    
    // Category display
    "show-comments": "عرض التعليقات",
    "hide-comments": "إخفاء التعليقات",
    "sentiment": "المشاعر",
    "negative": "سلبي",
    "positive": "إيجابي",
    "comments": "تعليقات",
    
    // Topics
    "top-topics": "أكثر المواضيع ذكرًا",
    "topics-description": "انقر على موضوع لعرض التعليقات المتعلقة به.",
    
    // Error messages
    "no-comments": "الرجاء إضافة بعض التعليقات أولا.",
    "select-csv": "الرجاء تحديد ملف CSV أولا."
  }
};

console.log("Translations loaded globally");