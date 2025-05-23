// Add this debugging script to your public/js folder as debug-helper.js

/**
 * Enhanced debugging utilities for comment categorization results
 */

// Global debugging function to inspect objects
window.debugObject = function(obj, label = 'Object') {
  console.group(`🐛 Debug: ${label}`);
  console.log('Raw object:', obj);
  console.log('Object type:', typeof obj);
  console.log('Is array:', Array.isArray(obj));
  console.log('Object keys:', Object.keys(obj || {}));
  console.log('JSON stringified:', JSON.stringify(obj, null, 2));
  console.groupEnd();
};

// Enhanced displayProcessingResults function with comprehensive debugging
window.enhancedDisplayProcessingResults = function(result, comments, isPartial = false) {
  console.group('🔍 Enhanced Display Processing Results');
  
  // Step 1: Validate inputs
  console.log('=== INPUT VALIDATION ===');
  console.log('Result provided:', !!result);
  console.log('Comments provided:', !!comments, comments ? comments.length : 0);
  console.log('Is partial:', isPartial);
  
  if (result) {
    window.debugObject(result, 'Processing Result');
  }
  
  const categoriesContainer = document.getElementById('categoriesContainer');
  if (!categoriesContainer) {
    console.error('❌ Categories container not found!');
    console.groupEnd();
    return;
  }
  
  // Step 2: Validate result structure
  console.log('=== RESULT STRUCTURE VALIDATION ===');
  if (!result) {
    console.error('❌ No result provided');
    categoriesContainer.innerHTML = '<div class="error">No results available - result is null/undefined</div>';
    console.groupEnd();
    return;
  }
  
  if (!result.categories) {
    console.error('❌ No categories property in result');
    window.debugObject(result, 'Result without categories');
    categoriesContainer.innerHTML = '<div class="error">No categories property found in results</div>';
    console.groupEnd();
    return;
  }
  
  if (!Array.isArray(result.categories)) {
    console.error('❌ Categories is not an array:', typeof result.categories);
    window.debugObject(result.categories, 'Non-array categories');
    categoriesContainer.innerHTML = '<div class="error">Categories is not an array</div>';
    console.groupEnd();
    return;
  }
  
  if (result.categories.length === 0) {
    console.warn('⚠️ Categories array is empty');
    categoriesContainer.innerHTML = '<div class="error">No categories found - empty categories array</div>';
    console.groupEnd();
    return;
  }
  
  console.log('✅ Result structure is valid');
  console.log(`Found ${result.categories.length} categories`);
  
  // Step 3: Validate each category
  console.log('=== CATEGORY VALIDATION ===');
  const validCategories = [];
  
  result.categories.forEach((category, index) => {
    console.log(`Validating category ${index + 1}:`, category?.name || 'Unknown');
    
    if (!category) {
      console.error(`❌ Category ${index + 1} is null/undefined`);
      return;
    }
    
    if (!category.name) {
      console.error(`❌ Category ${index + 1} has no name`);
      window.debugObject(category, `Category ${index + 1} without name`);
      return;
    }
    
    if (!category.comments || !Array.isArray(category.comments)) {
      console.warn(`⚠️ Category ${index + 1} has invalid comments array`);
      category.comments = []; // Fix it
    }
    
    validCategories.push(category);
    console.log(`✅ Category ${index + 1} is valid: ${category.name} (${category.comments.length} comments)`);
  });
  
  if (validCategories.length === 0) {
    console.error('❌ No valid categories found');
    categoriesContainer.innerHTML = '<div class="error">No valid categories found after validation</div>';
    console.groupEnd();
    return;
  }
  
  console.log(`✅ ${validCategories.length} valid categories found`);
  
  // Step 4: Clear container and add partial notice if needed
  console.log('=== CONTAINER SETUP ===');
  const existingHeader = categoriesContainer.querySelector('.partial-results-header');
  
  if (isPartial && !existingHeader) {
    console.log('Adding partial results header');
    const partialHeader = document.createElement('div');
    partialHeader.className = 'partial-results-header';
    partialHeader.innerHTML = `
      <div class="partial-notice">
        <strong>⏳ Partial Results</strong> - Processing continues in background. 
        Results will update automatically as more comments are processed.
      </div>
    `;
    categoriesContainer.innerHTML = '';
    categoriesContainer.appendChild(partialHeader);
  } else if (!isPartial) {
    console.log('Clearing container for final results');
    categoriesContainer.innerHTML = '';
  } else {
    console.log('Keeping existing partial header, clearing other content');
    const children = Array.from(categoriesContainer.children);
    children.forEach(child => {
      if (!child.classList.contains('partial-results-header')) {
        child.remove();
      }
    });
  }
  
  // Step 5: Create category cards
  console.log('=== CREATING CATEGORY CARDS ===');
  validCategories.forEach((category, index) => {
    console.log(`Creating card for category ${index + 1}: ${category.name}`);
    
    try {
      const categoryCard = createEnhancedCategoryCard(category, comments, index + 1);
      categoriesContainer.appendChild(categoryCard);
      console.log(`✅ Successfully created card for: ${category.name}`);
    } catch (error) {
      console.error(`❌ Failed to create card for category ${index + 1}:`, error);
      
      // Create a simple error card as fallback
      const errorCard = document.createElement('div');
      errorCard.className = 'category-card error-card';
      errorCard.innerHTML = `
        <div class="category-header">
          <div class="category-name">Error displaying: ${category.name || 'Unknown'}</div>
        </div>
        <div class="error">Failed to display this category: ${error.message}</div>
      `;
      categoriesContainer.appendChild(errorCard);
    }
  });
  
  // Step 6: Update statistics
  console.log('=== UPDATING STATISTICS ===');
  try {
    updateOverallStats({ categories: validCategories }, comments);
    console.log('✅ Statistics updated successfully');
  } catch (error) {
    console.error('❌ Failed to update statistics:', error);
  }
  
  // Step 7: Display topics if available
  console.log('=== DISPLAYING TOPICS ===');
  if (result.extractedTopics && result.extractedTopics.length > 0) {
    try {
      console.log(`Displaying ${result.extractedTopics.length} topics`);
      if (window.displayTopics) {
        window.displayTopics(result.extractedTopics, comments, categoriesContainer);
      }
      console.log('✅ Topics displayed successfully');
    } catch (error) {
      console.error('❌ Failed to display topics:', error);
    }
  } else {
    console.log('No topics to display');
  }
  
  console.log('✅ Display processing completed successfully');
  console.groupEnd();
};

// Enhanced category card creation function
function createEnhancedCategoryCard(category, comments, cardNumber) {
  console.log(`Creating enhanced card ${cardNumber} for: ${category.name}`);
  
  const categoryCard = document.createElement('div');
  categoryCard.className = 'category-card';
  categoryCard.id = `category-card-${cardNumber}`;
  
  // Validate and prepare data
  const categoryName = category.name || 'Unknown Category';
  const commentCount = (category.comments && Array.isArray(category.comments)) ? category.comments.length : 0;
  const categorySummary = category.summary || 'No summary available';
  const sentiment = typeof category.sentiment === 'number' ? category.sentiment : 0;
  
  // Get sentiment class and emoji
  const sentimentClass = sentiment > 0.3 ? 'sentiment-positive' : sentiment < -0.3 ? 'sentiment-negative' : 'sentiment-neutral';
  const sentimentEmoji = sentiment > 0.3 ? '😃' : sentiment < -0.3 ? '😞' : '😐';
  const sentimentPercentage = Math.round((sentiment + 1) / 2 * 100);
  
  console.log(`Card ${cardNumber} data: ${categoryName}, ${commentCount} comments, sentiment: ${sentiment}`);
  
  // Create the HTML structure
  categoryCard.innerHTML = `
    <div class="category-header">
      <div class="category-name">${escapeHtml(categoryName)}</div>
      <div class="category-count">${commentCount} comments</div>
    </div>
    
    <div class="category-summary">${escapeHtml(categorySummary)}</div>
    
    <div class="sentiment-details">
      <span class="sentiment-emoji">${sentimentEmoji}</span>
      <div style="flex-grow: 1;">
        <div class="sentiment-label">
          <span>Sentiment:</span>
          <span>${sentiment.toFixed(1)}</span>
        </div>
        <div class="sentiment-bar-container">
          <div class="sentiment-bar ${sentimentClass}" style="width: ${sentimentPercentage}%"></div>
        </div>
        <div class="sentiment-label">
          <span>Negative</span>
          <span>Positive</span>
        </div>
      </div>
    </div>
    
    ${category.commonIssues && category.commonIssues.length > 0 ? `
      <div class="category-issues">
        <h4>Common Issues:</h4>
        <ul>
          ${category.commonIssues.map(issue => `<li>${escapeHtml(issue)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    ${category.suggestedActions && category.suggestedActions.length > 0 ? `
      <div class="category-actions">
        <h4>Suggested Actions:</h4>
        <ul>
          ${category.suggestedActions.map(action => `<li>${escapeHtml(action)}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
    
    <button class="show-comments-btn" data-action="show">Show Comments</button>
    
    <div class="category-comments" style="display: none;">
      ${createCommentsHTML(category.comments, comments)}
    </div>
  `;
  
  // Add event handler for show/hide comments
  const showHideBtn = categoryCard.querySelector('.show-comments-btn');
  const commentsDiv = categoryCard.querySelector('.category-comments');
  
  showHideBtn.addEventListener('click', function() {
    const action = this.getAttribute('data-action');
    if (action === 'show') {
      commentsDiv.style.display = 'block';
      this.textContent = 'Hide Comments';
      this.setAttribute('data-action', 'hide');
      console.log(`Showing comments for: ${categoryName}`);
    } else {
      commentsDiv.style.display = 'none';
      this.textContent = 'Show Comments';
      this.setAttribute('data-action', 'show');
      console.log(`Hiding comments for: ${categoryName}`);
    }
  });
  
  console.log(`✅ Enhanced card created for: ${categoryName}`);
  return categoryCard;
}

// Helper function to create comments HTML
function createCommentsHTML(commentIds, allComments) {
  if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
    return '<div class="no-comments">No comments available</div>';
  }
  
  const commentsHTML = commentIds.map(commentId => {
    const index = commentId - 1; // Convert to 0-based index
    const comment = (index >= 0 && index < allComments.length) 
      ? allComments[index] 
      : `[Comment #${commentId} not found]`;
    
    return `<div class="category-comment">${escapeHtml(comment)}</div>`;
  }).join('');
  
  return commentsHTML || '<div class="no-comments">No valid comments found</div>';
}

// Utility function for HTML escaping (fallback if not available)
function escapeHtml(text) {
  if (typeof text !== 'string') return String(text || '');
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Enhanced statistics update function
function updateOverallStats(result, comments) {
  const overallStats = document.getElementById('overallStats');
  const totalCommentsEl = document.getElementById('totalComments');
  const categoryCountEl = document.getElementById('categoryCount');
  const avgSentimentEl = document.getElementById('avgSentiment');
  
  if (!overallStats || !totalCommentsEl || !categoryCountEl || !avgSentimentEl) {
    console.warn('⚠️ Some statistics elements not found');
    return;
  }
  
  if (!result.categories || !Array.isArray(result.categories)) {
    console.warn('⚠️ Invalid categories for statistics');
    return;
  }
  
  let totalSentiment = 0;
  result.categories.forEach(cat => {
    const sentiment = typeof cat.sentiment === 'number' ? cat.sentiment : 0;
    totalSentiment += sentiment;
  });
  
  const avgSentiment = result.categories.length > 0 
    ? (totalSentiment / result.categories.length).toFixed(1) 
    : '0.0';
  
  totalCommentsEl.textContent = comments ? comments.length : 0;
  categoryCountEl.textContent = result.categories.length;
  avgSentimentEl.textContent = avgSentiment;
  
  overallStats.style.display = 'block';
  
  console.log(`Statistics updated: ${comments?.length || 0} comments, ${result.categories.length} categories, avg sentiment: ${avgSentiment}`);
}

// Override the original display function when this script loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Enhanced debugging utilities loaded');
  
  // Replace the original function if it exists
  if (window.displayProcessingResults) {
    window.originalDisplayProcessingResults = window.displayProcessingResults;
    window.displayProcessingResults = window.enhancedDisplayProcessingResults;
    console.log('✅ Enhanced displayProcessingResults function activated');
  }
});

// Export for module use if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debugObject: window.debugObject,
    enhancedDisplayProcessingResults: window.enhancedDisplayProcessingResults,
    createEnhancedCategoryCard,
    updateOverallStats
  };
}