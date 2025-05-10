/**
 * Configuration file for the Comment Categorization application
 */

// Server URL to connect to your Heroku instance
export const SERVER_URL = 'https://comment-analyzer-e15255a314d2.herokuapp.com';

// Default language
export const DEFAULT_LANGUAGE = 'en';

// API endpoints
export const API_ENDPOINTS = {
  PING: '/api/ping',
  CATEGORIZE: '/api/categorize',
  SUMMARIZE: '/api/summarize'
};

// Request timeouts in milliseconds
export const TIMEOUTS = {
  NORMAL: 30000,    // 30 seconds
  EXTENDED: 120000, // 2 minutes for larger requests
  WAKEUP: 60000     // 1 minute for waking up the server
};

// Retry configuration
export const RETRY = {
  MAX_ATTEMPTS: 3,        // Maximum number of retry attempts
  BASE_DELAY: 2000,       // Initial delay in ms
  BACKOFF_FACTOR: 1.5,    // Exponential backoff multiplier
  JITTER: 500,            // Random jitter in ms to add/subtract
  STATUS_CODES: [429, 503, 504] // HTTP status codes that should trigger retry
};

// UI related constants
export const UI = {
  MAX_DISPLAYED_TOPICS: 30,
  MAX_COMMENTS_PER_CATEGORY: 50,
  MAX_COMMENT_PREVIEW_LENGTH: 150,
  SENTIMENT_THRESHOLDS: {
    POSITIVE: 0.3,
    NEGATIVE: -0.3
  }
};