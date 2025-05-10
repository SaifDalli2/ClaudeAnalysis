/**
 * Utility functions for the Comment Categorization application
 */
import { DEFAULT_LANGUAGE } from './config.js';

// Store the current language - default from config
let currentLanguage = DEFAULT_LANGUAGE;

/**
 * Get the current application language
 * @returns {string} Current language code
 */
export function getCurrentLanguage() {
  return currentLanguage;
}

/**
 * Set the current application language
 * @param {string} lang - Language code to set
 */
export function setCurrentLanguage(lang) {
  currentLanguage = lang;
  localStorage.setItem('preferredLanguage', lang);
}

/**
 * Initialize language settings from local storage
 * @returns {string} The initialized language
 */
export function initializeLanguage() {
  const storedLanguage = localStorage.getItem('preferredLanguage');
  if (storedLanguage) {
    currentLanguage = storedLanguage;
  }
  return currentLanguage;
}

/**
 * Apply language translations to the UI
 * @param {string} lang - Language code to apply
 */
export function applyLanguage(lang) {
  // Ensure translations are available
  if (!window.translations) {
    console.error("Translations not loaded yet. Retrying in 500ms...");
    setTimeout(() => applyLanguage(lang), 500);
    return;
  }
  
  if (!window.translations[lang]) {
    console.error(`Language '${lang}' not found in translations`);
    return;
  }
  
  // Apply RTL for Arabic
  document.body.classList.toggle('rtl', lang === 'ar');
  
  // Update all elements with data-lang-key attribute
  document.querySelectorAll('[data-lang-key]').forEach(element => {
    const key = element.getAttribute('data-lang-key');
    if (window.translations[lang][key]) {
      // Handle different element types
      if (element.tagName === 'INPUT' && element.getAttribute('type') === 'text' || 
          element.tagName === 'TEXTAREA' || 
          element.tagName === 'INPUT' && element.getAttribute('type') === 'password') {
        element.placeholder = window.translations[lang][key];
      } else {
        element.textContent = window.translations[lang][key];
      }
    }
  });
}

/**
 * Format file size to human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  else return (bytes / 1048576).toFixed(1) + ' MB';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped HTML
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Get translation for a specific key
 * @param {string} key - Translation key
 * @param {string} defaultText - Default text if translation not found
 * @returns {string} Translated text or default
 */
export function getTranslation(key, defaultText) {
  if (window.translations && 
      window.translations[currentLanguage] && 
      window.translations[currentLanguage][key]) {
    return window.translations[currentLanguage][key];
  }
  return defaultText;
}

/**
 * Detect language of a set of comments
 * @param {Array<string>} comments - Array of comment strings
 * @returns {string} Detected language code ('ar' or 'en')
 */
export function detectLanguage(comments) {
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

/**
 * Process CSV content and extract comments
 * @param {string} content - Raw CSV content
 * @returns {Array<string>} Extracted comments
 */
export function processCSVContent(content) {
  // Basic CSV parsing
  const lines = content.split(/\r\n|\n|\r/).filter(line => line.trim());
  
  // Check if it's a simple list or has a header row
  let comments = [];
  
  if (lines[0].toLowerCase().includes('comment')) {
    // This is likely a CSV with headers
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',');
      // Try to find the comment column
      let commentText = '';
      for (let col of columns) {
        col = col.trim();
        if (col && col.length > 5) {  // Simple heuristic to find the comment column
          commentText = col.replace(/^["']|["']$/g, ''); // Remove quotes
          break;
        }
      }
      if (commentText) {
        comments.push(commentText);
      }
    }
  } else {
    // Simple list of comments
    comments = lines.map(line => line.replace(/^["']|["']$/g, '').trim()).filter(Boolean);
  }
  
  return comments;
}

/**
 * Add diagnostic log entry
 * @param {string} message - Log message
 * @param {string} type - Log type ('info', 'error', 'warning', 'success')
 */
export function addLogEntry(message, type = 'info') {
  const debugLog = document.getElementById('debugLog');
  if (!debugLog) return;
  
  // Set display style
  debugLog.style.display = 'block';
  
  // Set color based on type
  let color = 'inherit';
  switch (type) {
    case 'error': color = 'red'; break;
    case 'warning': color = 'orange'; break;
    case 'success': color = 'green'; break;
  }
  
  // Add the log entry
  debugLog.innerHTML += `<div style="color: ${color}">[${new Date().toLocaleTimeString()}] ${message}</div>`;
  
  // Auto-scroll to bottom
  debugLog.scrollTop = debugLog.scrollHeight;
}

/**
 * Clear all log entries
 */
export function clearLogs() {
  const debugLog = document.getElementById('debugLog');
  if (debugLog) {
    debugLog.innerHTML = '';
  }
}

/**
 * Creates a delay (Promise-based timeout)
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after the delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}