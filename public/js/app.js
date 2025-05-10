/**
 * Main application file for the Comment Categorization System
 * Orchestrates functionality between all modules
 */

// Import modules
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
  checkServerAvailability, 
  processCommentsWithAPI 
} from './api-service.js';
import {
  setupTabs,
  setupProcessingMethodToggle,
  setupCommentEntry,
  createAddCommentHandler,
  setupCSVUpload,
  setupActionButtons,
  addDiagnosticButton,
  displayProcessingResults,
  toggleLoader
} from './ui-handlers.js';
import {
  processCommentsWithSimulation
} from './simulation.js';
import {
  initializeTopicVisualizer
} from './topic-visualizer.js';

// Define comments array in global scope for accessibility
window.comments = [];

/**
 * Process comments (either with API or simulation)
 */
async function processComments() {
  clearLogs();
  addLogEntry('Starting comment processing...');
  
  // Show loader
  toggleLoader(true);
  
  try {
    // Get API key if using API
    const useApi = document.getElementById('useApi').checked;
    const apiKey = useApi ? document.getElementById('apiKeyInput').value : null;
    
    let result;
    
    if (useApi && apiKey) {
      // Process with Claude API
      addLogEntry('Using Claude API with two-step processing');
      addLogEntry(`Processing ${window.comments.length} comments...`);
      
      try {
        result = await processCommentsWithAPI(window.comments, apiKey);
      } catch (error) {
        addLogEntry(`Processing Error: ${error.message}`, 'error');
        addLogEntry('Falling back to simulation mode...', 'warning');
        
        // Show user-friendly message about server issues
        alert('Could not connect to the server for API processing: ' + error.message + '\n\nUsing simulation mode instead.');
        
        // Fall back to simulation
        result = processCommentsWithSimulation(window.comments);
      }
    } else {
      // Use simulation
      addLogEntry('Using simulation mode');
      result = processCommentsWithSimulation(window.comments);
    }
    
    // Process and display the results
    addLogEntry('Displaying results...');
    displayProcessingResults(result, window.comments);
    
  } catch (error) {
    console.error('Error processing comments:', error);
    
    // Log error in debug log
    addLogEntry(`Error: ${error.message}`, 'error');
    
    // Show error
    const categoriesContainer = document.getElementById('categoriesContainer');
    if (categoriesContainer) {
      categoriesContainer.innerHTML = `<div class="error">Error processing comments: ${error.message}</div>`;
    }
  } finally {
    // Hide loader
    toggleLoader(false);
  }
}

/**
 * Initialize language settings
 */
function initializeLanguageSettings() {
  const languageSelector = document.getElementById('languageSelector');
  if (languageSelector) {
    // Initialize language
    const currentLanguage = initializeLanguage();
    languageSelector.value = currentLanguage;
    
    // Apply stored/default language
    applyLanguage(currentLanguage);
    
    // Add change event listener
    languageSelector.addEventListener('change', function() {
      const newLanguage = this.value;
      setCurrentLanguage(newLanguage);
      applyLanguage(newLanguage);
    });
  }
}

/**
 * Initialize the application
 */
function initApp() {
  console.log("App initialization started");
  
  try {
    // Initialize language
    initializeLanguageSettings();
    
    // Initialize topic visualizer
    initializeTopicVisualizer();
    
    // Setup tabs functionality
    setupTabs();
    
    // Setup API/Simulation toggle
    setupProcessingMethodToggle();
    
    // Setup comment entry functionality
    const addCommentHandler = createAddCommentHandler(window.comments);
    setupCommentEntry(addCommentHandler);
    
    // Setup CSV upload functionality
    setupCSVUpload(window.comments);
    
    // Setup process/clear buttons
    setupActionButtons(window.comments, processComments);
    
    // Add diagnostic button
    addDiagnosticButton(checkServerAvailability);
    
    console.log("App initialized successfully");
  } catch(e) {
    console.error("Error initializing app:", e);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);