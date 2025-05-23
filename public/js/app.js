/**
 * Updated main application file with enhanced real-time processing
 * Replace your existing app.js with this version
 */

import { DEFAULT_LANGUAGE } from './config.js';
import { 
  getCurrentLanguage, 
  setCurrentLanguage, 
  initializeLanguage, 
  applyLanguage,
  addLogEntry,
  clearLogs
} from './utils.js';
import { 
  checkServerAvailability
} from './api-service.js';
import {
  setupTabs,
  setupProcessingMethodToggle,
  setupCommentEntry,
  createAddCommentHandler,
  setupCSVUpload,
  setupActionButtons,
  addDiagnosticButton,
  enhancedProcessComments  // Import the enhanced version
} from './ui-handlers.js';
import {
  initializeTopicVisualizer
} from './topic-visualizer.js';

// Define comments array in global scope for accessibility
window.comments = [];

/**
 * Enhanced process comments function that uses the new real-time approach
 */
async function processComments() {
  clearLogs();
  addLogEntry('Starting enhanced comment processing...');
  
  try {
    // Check which processing method is selected
    const useSimulation = document.getElementById('useSimulation').checked;
    
    if (!useSimulation) {
      // Check if API key is provided
      const apiKey = document.getElementById('apiKeyInput').value;
      if (!apiKey || apiKey.trim() === '') {
        alert('Please provide a Claude API key for API processing, or switch to Simulation mode.');
        return;
      }
    }
    
    // Use the enhanced processing function
    await enhancedProcessComments(window.comments, useSimulation);
    
  } catch (error) {
    console.error('Error in processComments:', error);
    addLogEntry(`Processing failed: ${error.message}`, 'error');
  }
}

/**
 * Initialize language settings
 */
function initializeLanguageSettings() {
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    const currentLanguage = initializeLanguage();
    languageSelector.value = currentLanguage;
    applyLanguage(currentLanguage);
    
    languageSelector.addEventListener('change', function() {
      const newLanguage = this.value;
      setCurrentLanguage(newLanguage);
      applyLanguage(newLanguage);
    });
  }
}

/**
 * Remove simulation mode from the interface
 */
function configureProcessingMethods() {
  // Hide simulation radio button and always default to API
  const simulationOption = document.querySelector('.radio-option:has(#useSimulation)');
  if (simulationOption) {
    simulationOption.style.display = 'none';
  }
  
  // Default to API mode
  const useApiRadio = document.getElementById('useApi');
  if (useApiRadio) {
    useApiRadio.checked = true;
    
    // Trigger change event to show API key section
    const event = new Event('change');
    useApiRadio.dispatchEvent(event);
  }
  
  // Update instructions to remove simulation references
  const deployInstructions = document.querySelector('.deploy-instructions');
  if (deployInstructions) {
    deployInstructions.innerHTML = `
      <strong>API Configuration:</strong>
      <p>This system uses the Claude API for real-time comment categorization with progress tracking.</p>
      <ol>
        <li>Enter your Claude API key above</li>
        <li>The system will process comments in batches with real-time progress updates</li>
        <li>Results will appear as batches complete, even if some batches timeout</li>
      </ol>
    `;
  }
}

/**
 * Add enhanced progress monitoring
 */
function setupProgressMonitoring() {
  // Add status indicators to the UI
  const inputSection = document.querySelector('.input-section');
  if (inputSection) {
    // Add a status display element
    const statusDiv = document.createElement('div');
    statusDiv.id = 'systemStatus';
    statusDiv.className = 'system-status';
    statusDiv.innerHTML = `
      <div class="status-item">
        <span class="status-label">API Status:</span>
        <span id="apiStatus" class="status-value">Not checked</span>
      </div>
    `;
    
    // Insert before the debug log
    const debugLog = document.getElementById('debugLog');
    if (debugLog) {
      inputSection.insertBefore(statusDiv, debugLog);
    }
  }
}

/**
 * Enhanced initialization function
 */
function initApp() {
  console.log("Enhanced app initialization started");
  
  try {
    // Initialize language
    initializeLanguageSettings();
    
    // Initialize topic visualizer
    initializeTopicVisualizer();
    
    // Setup tabs functionality
    setupTabs();
    
    // Setup API/Simulation toggle (enhanced to hide simulation)
    setupProcessingMethodToggle();
    configureProcessingMethods();
    
    // Setup progress monitoring
    setupProgressMonitoring();
    
    // Setup comment entry functionality
    const addCommentHandler = createAddCommentHandler(window.comments);
    setupCommentEntry(addCommentHandler);
    
    // Setup CSV upload functionality
    setupCSVUpload(window.comments);
    
    // Setup process/clear buttons with enhanced processing
    setupActionButtons(window.comments, processComments);
    
    // Add diagnostic button
    addDiagnosticButton(checkServerAvailability);
    
    // Add enhanced error handling
    setupGlobalErrorHandling();
    
    // Add periodic status checks
    setupPeriodicStatusChecks();
    
    console.log("Enhanced app initialized successfully");
  } catch(e) {
    console.error("Error initializing enhanced app:", e);
    addLogEntry(`Initialization error: ${e.message}`, 'error');
  }
}

/**
 * Setup global error handling for better user experience
 */
function setupGlobalErrorHandling() {
  // Handle unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    addLogEntry(`System error: ${event.reason.message || event.reason}`, 'error');
    
    // Prevent the default browser error handling
    event.preventDefault();
  });
  
  // Handle general errors
  window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    addLogEntry(`Application error: ${event.error?.message || event.message}`, 'error');
  });
}

/**
 * Setup periodic status checks to monitor system health
 */
function setupPeriodicStatusChecks() {
  const apiStatusEl = document.getElementById('apiStatus');
  
  if (apiStatusEl) {
    // Initial status check
    updateApiStatus('Checking...', 'checking');
    
    // Check API status periodically (every 5 minutes)
    setInterval(async () => {
      try {
        const isAvailable = await checkServerAvailability();
        updateApiStatus(isAvailable ? 'Available' : 'Unavailable', isAvailable ? 'available' : 'unavailable');
      } catch (error) {
        updateApiStatus('Error', 'error');
      }
    }, 300000); // 5 minutes
    
    // Initial check
    setTimeout(async () => {
      try {
        const isAvailable = await checkServerAvailability();
        updateApiStatus(isAvailable ? 'Available' : 'Unavailable', isAvailable ? 'available' : 'unavailable');
      } catch (error) {
        updateApiStatus('Error', 'error');
      }
    }, 1000);
  }
}

/**
 * Update API status display
 */
function updateApiStatus(status, type) {
  const apiStatusEl = document.getElementById('apiStatus');
  if (apiStatusEl) {
    apiStatusEl.textContent = status;
    apiStatusEl.className = `status-value status-${type}`;
  }
}

/**
 * Enhanced comment validation
 */
function validateComments(comments) {
  if (!comments || !Array.isArray(comments)) {
    throw new Error('Comments must be provided as an array');
  }
  
  if (comments.length === 0) {
    throw new Error('At least one comment is required');
  }
  
  if (comments.length > 1000) {
    throw new Error('Maximum 1000 comments allowed per batch');
  }
  
  // Check for valid comment content
  const validComments = comments.filter(comment => 
    comment && typeof comment === 'string' && comment.trim().length > 0
  );
  
  if (validComments.length === 0) {
    throw new Error('No valid comments found');
  }
  
  if (validComments.length < comments.length) {
    addLogEntry(`Filtered out ${comments.length - validComments.length} invalid comments`, 'warning');
  }
  
  return validComments;
}

/**
 * Enhanced progress tracking with user notifications
 */
function setupProgressNotifications() {
  // Request notification permission if supported
  if ('Notification' in window) {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }
}

/**
 * Show browser notification for processing milestones
 */
function showProcessingNotification(message, type = 'info') {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Comment Analyzer', {
      body: message,
      icon: '/img/logo.png',
      badge: '/img/logo.png'
    });
    
    // Auto-close after 5 seconds
    setTimeout(() => notification.close(), 5000);
  }
}

/**
 * Enhanced comment processing with notifications and validation
 */
async function enhancedProcessComments() {
  try {
    // Validate comments before processing
    const validComments = validateComments(window.comments);
    
    addLogEntry(`Starting processing of ${validComments.length} valid comments`, 'info');
    
    // Show notification for large batches
    if (validComments.length > 100) {
      showProcessingNotification(`Starting to process ${validComments.length} comments. This may take several minutes.`);
    }
    
    // Get processing method
    const useSimulation = document.getElementById('useSimulation')?.checked || false;
    
    // Process comments with the enhanced function
    const result = await enhancedProcessComments(validComments, useSimulation);
    
    // Show completion notification
    if (result && result.categories) {
      const categorizedCount = result.categories.reduce((sum, cat) => sum + cat.comments.length, 0);
      showProcessingNotification(`Processing complete! Categorized ${categorizedCount} comments into ${result.categories.length} categories.`);
    }
    
    return result;
    
  } catch (error) {
    console.error('Enhanced processing error:', error);
    addLogEntry(`Processing failed: ${error.message}`, 'error');
    showProcessingNotification(`Processing failed: ${error.message}`, 'error');
    throw error;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupProgressNotifications();
});

// Export enhanced processing function for external use
window.enhancedProcessComments = enhancedProcessComments;
window.validateComments = validateComments;
window.showProcessingNotification = showProcessingNotification;