// Enhanced module-index.js with translation support
import * as Utils from './utils.js';
import * as Config from './config.js';
import * as ApiService from './api-service.js';
import * as Simulation from './simulation.js';
import * as TopicVisualizer from './topic-visualizer.js';
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
    console.log('🚀 Initializing Comment Categorization App...');
    
    // Set up global variables
    window.comments = [];
    
    // Wait for translations to be available
    function waitForTranslations() {
      return new Promise((resolve) => {
        function check() {
          if (window.translations) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        }
        check();
      });
    }
    
    await waitForTranslations();
    console.log('✅ Translations loaded');
    
    // Initialize language (this is now handled by the main auth script)
    console.log('✅ Language system ready');
    
    // Initialize topic visualizer
    TopicVisualizer.initializeTopicVisualizer();
    
    // Setup UI components
    UIHandlers.setupTabs();
    
    // Setup comment handling
    const addCommentHandler = UIHandlers.createAddCommentHandler(window.comments);
    UIHandlers.setupCommentEntry(addCommentHandler);
    UIHandlers.setupCSVUpload(window.comments);
    
    // Setup action buttons with the enhanced processing function
    UIHandlers.setupActionButtons(window.comments, UIHandlers.enhancedProcessComments);
    
    console.log('✅ App initialization complete');
    return true;
    
  } catch (error) {
    console.error('❌ Failed to initialize app:', error);
    return false;
  }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}