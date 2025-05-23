/**
 * Module index file to organize dependencies and avoid circular imports
 * This file should replace or supplement existing module loading
 */

// Core utilities (no dependencies)
import * as Utils from './utils.js';
import * as Config from './config.js';

// Services (depend on utils and config only)
import * as ApiService from './api-service.js';
import * as Simulation from './simulation.js';

// UI components (depend on utils, config, and services)
import * as TopicVisualizer from './topic-visualizer.js';

// Main UI handlers (depend on all above)
import * as UIHandlers from './ui-handlers.js';

// Export organized modules
export {
  Utils,
  Config,
  ApiService,
  Simulation,
  TopicVisualizer,
  UIHandlers
};

// Initialize the application
export async function initializeApp() {
  try {
    console.log('Initializing Comment Categorization App...');
    
    // Set up global variables
    window.comments = [];
    
    // Initialize language
    const currentLanguage = Utils.initializeLanguage();
    Utils.applyLanguage(currentLanguage);
    
    // Initialize topic visualizer
    TopicVisualizer.initializeTopicVisualizer();
    
    // Setup UI components
    UIHandlers.setupTabs();
    UIHandlers.setupProcessingMethodToggle();
    
    // Setup comment handling
    const addCommentHandler = UIHandlers.createAddCommentHandler(window.comments);
    UIHandlers.setupCommentEntry(addCommentHandler);
    UIHandlers.setupCSVUpload(window.comments);
    
    // Setup action buttons with the enhanced processing function
    UIHandlers.setupActionButtons(window.comments, UIHandlers.enhancedProcessComments);
    
    // Add diagnostic button
    UIHandlers.addDiagnosticButton(ApiService.checkServerAvailability);
    
    // Set up language selector
    const languageSelector = document.getElementById('languageSelector');
    if (languageSelector) {
      languageSelector.value = currentLanguage;
      languageSelector.addEventListener('change', function() {
        const newLanguage = this.value;
        Utils.setCurrentLanguage(newLanguage);
        Utils.applyLanguage(newLanguage);
      });
    }
    
    console.log('App initialization complete');
    return true;
    
  } catch (error) {
    console.error('Failed to initialize app:', error);
    Utils.addLogEntry(`Initialization error: ${error.message}`, 'error');
    return false;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}