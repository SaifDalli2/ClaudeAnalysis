/**
 * Application constants and configuration
 */

// API Configuration
const API_CONFIG = {
  CLAUDE: {
    BASE_URL: 'https://api.anthropic.com/v1/messages',
    MODEL: 'claude-3-5-haiku-latest',
    VERSION: '2023-06-01',
    DEFAULT_MAX_TOKENS: 4000,
    SUMMARIZATION_MAX_TOKENS: 8191
  },
  TIMEOUTS: {
    NORMAL: 30000,        // 30 seconds
    EXTENDED: 90000,      // 90 seconds for batch processing
    SUMMARIZATION: 300000 // 5 minutes for summarization
  },
  RETRY: {
    MAX_ATTEMPTS: 3,
    BASE_DELAY: 45000,     // 45 seconds
    BACKOFF_MULTIPLIER: 1.5,
    TIMEOUT_MS: 90000
  }
};

// Processing Configuration
const PROCESSING_CONFIG = {
  BATCH_SIZE: 30,
  MAX_COMMENTS_PER_REQUEST: 10000,
  MAX_COMMENTS_FOR_SUMMARY: 50,
  MAX_CONSECUTIVE_FAILURES: 8,
  MAX_TOTAL_FAILURE_RATE: 0.6,
  JOB_CLEANUP_HOURS: 4
};

// Rate Limiting
const RATE_LIMITS = {
  DEFAULT: {
    MAX_REQUESTS: 100,
    WINDOW_MS: 60000  // 1 minute
  },
  API_HEAVY: {
    MAX_REQUESTS: 10,
    WINDOW_MS: 60000  // 1 minute for heavy API operations
  }
};

// Request Size Limits
const SIZE_LIMITS = {
  JSON_PAYLOAD: '50mb',
  URL_ENCODED: '50mb',
  MAX_REQUEST_SIZE_MB: 50
};

// Monitoring Configuration
const MONITORING_CONFIG = {
  HEALTH_LOG_INTERVAL: 1800000,    // 30 minutes
  MEMORY_CHECK_INTERVAL: 30000,    // 30 seconds
  PERFORMANCE_HISTORY_SIZE: 1000,
  SLOW_REQUEST_THRESHOLD: 5000,    // 5 seconds
  MAX_SLOW_REQUESTS_STORED: 100,
  MEMORY_THRESHOLDS: {
    WARNING: 80,   // 80% heap usage
    CRITICAL: 95   // 95% heap usage
  },
  ALERT_COOLDOWN: 300000  // 5 minutes
};

// Predefined Categories
const CATEGORIES = {
  ARABIC: [
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
  ],
  ENGLISH: [
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
  ]
};

// Language Detection
const LANGUAGE_CONFIG = {
  ARABIC_PATTERN: /[\u0600-\u06FF]/,
  ARABIC_THRESHOLD: 0.5  // 50% of comments must contain Arabic to be classified as Arabic
};

// Error Messages
const ERROR_MESSAGES = {
  INVALID_API_KEY: {
    error: 'Invalid API key',
    details: 'A valid Claude API key must be provided. The key should be at least 10 characters long.',
    suggestion: 'Get your API key from the Claude console at https://console.anthropic.com/'
  },
  INVALID_COMMENTS: {
    error: 'Invalid request',
    details: 'Comments must be provided as a non-empty array'
  },
  TOO_MANY_COMMENTS: {
    error: 'Too many comments',
    details: 'Maximum 10,000 comments allowed per request',
    suggestion: 'Split your comments into smaller batches for processing.'
  },
  JOB_NOT_FOUND: {
    error: 'Job not found',
    details: 'The specified job ID does not exist or has expired.'
  },
  RATE_LIMIT_EXCEEDED: {
    error: 'Rate limit exceeded',
    details: 'Too many requests. Please wait before making another request.',
    suggestion: 'Implement delays between requests or reduce request frequency.'
  },
  REQUEST_TOO_LARGE: {
    error: 'Request too large',
    suggestion: 'Reduce the number of comments or split into smaller batches.'
  }
};

// System Prompts
const SYSTEM_PROMPTS = {
  CATEGORIZATION: "Return only valid JSON. No explanations. No conversational text. Just JSON.",
  JSON_ONLY: "You are a JSON-only categorization tool. Return only valid JSON with no explanations or conversational text. Do not start responses with explanatory text in any language."
};

// File and Path Configuration
const PATHS = {
  PUBLIC: 'public',
  STATIC_FILES: 'public',
  INDEX_HTML: 'public/index.html'
};

// Environment Configuration
const ENV_CONFIG = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  TEST: 'test'
};

// HTTP Status Codes
const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
};

// Job Status Types
const JOB_STATUS = {
  STARTING: 'starting',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Validation Rules
const VALIDATION_RULES = {
  API_KEY_MIN_LENGTH: 10,
  COMMENT_MAX_LENGTH: 5000,
  MAX_INVALID_COMMENT_RATIO: 0.5,
  JOB_ID_PATTERN: /^job_\d+_[a-zA-Z0-9]+$/,
  MAX_TOPICS_RETURNED: 100
};

module.exports = {
  API_CONFIG,
  PROCESSING_CONFIG,
  RATE_LIMITS,
  SIZE_LIMITS,
  MONITORING_CONFIG,
  CATEGORIES,
  LANGUAGE_CONFIG,
  ERROR_MESSAGES,
  SYSTEM_PROMPTS,
  PATHS,
  ENV_CONFIG,
  HTTP_STATUS,
  JOB_STATUS,
  VALIDATION_RULES
};