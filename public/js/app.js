/**
 * Fixed main application file with enhanced real-time processing
 * All duplicates and circular dependencies removed
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
  enhancedProcessComments  // Import the enhanced version from ui-handlers
} from './ui-handlers.js';
import {
  initializeTopicVisualizer
} from './topic-visualizer.js';

// Define comments array in global scope for accessibility
window.comments = [];

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
    

  }
}

/**
 * Main initialization function
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
    setupActionButtons(window.comments, enhancedProcessComments);
    
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

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupProgressNotifications();
});

// Export functions for external use
window.initApp = initApp;
window.showProcessingNotification = showProcessingNotification;