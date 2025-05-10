/**
 * Topic visualization functions for the Comment Categorization application
 */
import { UI } from './config.js';
import { escapeHtml, getTranslation } from './utils.js';

/**
 * Add CSS styles for topic visualization
 */
export function addTopicStyles() {
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .topics-section {
      margin-bottom: 30px;
      background: var(--dark-surface);
      border-radius: 6px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    
    .topics-title {
      color: var(--dark-primary-hover);
      margin-top: 0;
    }
    
    .topics-description {
      color: var(--dark-text-secondary);
      margin-bottom: 15px;
    }
    
    .topics-cloud {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .topic-button {
      background-color: var(--dark-surface-lighter);
      color: var(--dark-primary);
      border: 1px solid var(--dark-primary);
      border-radius: 20px;
      padding: 5px 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      margin: 5px;
    }
    
    .topic-button:hover {
      background-color: var(--dark-primary);
      color: black;
    }
    
    .topic-comments {
      background: var(--dark-surface-lighter);
      border-radius: 6px;
      padding: 15px;
      margin-top: 20px;
      border-left: 3px solid var(--dark-primary);
      display: none;
    }
    
    .topic-comments-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .topic-comments-header h3 {
      margin: 0;
      color: var(--dark-primary-hover);
    }
    
    .topic-close-btn {
      background: transparent;
      color: var(--dark-text);
      border: none;
      font-size: 24px;
      cursor: pointer;
      padding: 0 5px;
      margin: 0;
    }
    
    .topic-comments-list {
      max-height: 400px;
      overflow-y: auto;
    }
    
    .topic-comment-item {
      padding: 10px;
      margin-bottom: 8px;
      border-bottom: 1px solid var(--dark-border);
    }
    
    .topic-summary {
      padding: 10px;
      margin-bottom: 15px;
      border-radius: 4px;
      background: rgba(226, 255, 102, 0.05);
      border: 1px solid rgba(226, 255, 102, 0.1);
    }
    
    .no-topic-comments {
      padding: 10px;
      text-align: center;
      color: var(--dark-text-secondary);
    }
    
    .rtl .topic-comments {
      border-left: none;
      border-right: 3px solid var(--dark-primary);
    }
  `;
  
  document.head.appendChild(styleEl);
}

/**
 * Display topics cloud and visualization
 * @param {Array<Object>} topics - Topic data
 * @param {Array<string>} comments - Comments array
 * @param {HTMLElement} container - Container element to append topics
 */
export function displayTopics(topics, comments, container) {
  if (!topics || !Array.isArray(topics) || topics.length === 0 || !container) {
    return;
  }
  
  const topicsContainer = document.createElement('div');
  topicsContainer.className = 'topics-section';
  
  // Create section title
  const titleEl = document.createElement('h2');
  titleEl.textContent = getTranslation('top-topics', 'Top Topics Mentioned');
  titleEl.className = 'topics-title';
  topicsContainer.appendChild(titleEl);
  
  // Create description
  const descEl = document.createElement('p');
  descEl.textContent = getTranslation('topics-description', 'Click on a topic to see related comments.');
  descEl.className = 'topics-description';
  topicsContainer.appendChild(descEl);
  
  // Create topics cloud
  const cloudEl = document.createElement('div');
  cloudEl.className = 'topics-cloud';
  
  // Sort topics by count if not already sorted
  const sortedTopics = [...topics].sort((a, b) => (b.count || 0) - (a.count || 0));
  
  // Limit to top N topics for display
  const displayTopics = sortedTopics.slice(0, UI.MAX_DISPLAYED_TOPICS);
  
  // Create topic buttons
  displayTopics.forEach(topic => {
    const topicButton = document.createElement('button');
    topicButton.textContent = `${topic.topic} (${topic.count || 0})`;
    topicButton.className = 'topic-button';
    
    // Calculate size based on count (for visual emphasis)
    const minFontSize = 14;
    const maxFontSize = 24;
    const maxCount = displayTopics[0].count || 1;
    const fontSize = minFontSize + ((topic.count || 1) / maxCount) * (maxFontSize - minFontSize);
    
    topicButton.style.fontSize = `${fontSize}px`;
    
    // Add click handler to show related comments
    topicButton.addEventListener('click', () => {
      showCommentsForTopic(topic, comments);
    });
    
    cloudEl.appendChild(topicButton);
  });
  
  topicsContainer.appendChild(cloudEl);
  
  // Create container for topic comments (initially empty)
  const topicCommentsEl = document.createElement('div');
  topicCommentsEl.className = 'topic-comments';
  topicCommentsEl.id = 'topicComments';
  topicsContainer.appendChild(topicCommentsEl);
  
  // Insert at the beginning of the provided container
  container.insertBefore(topicsContainer, container.firstChild);
}

/**
 * Show comments for a specific topic
 * @param {Object} topic - Topic data
 * @param {Array<string>} comments - Comments array
 */
export function showCommentsForTopic(topic, comments) {
  const topicCommentsEl = document.getElementById('topicComments');
  if (!topicCommentsEl) return;
  
  // Clear previous content
  topicCommentsEl.innerHTML = '';
  
  // Create topic header
  const headerEl = document.createElement('div');
  headerEl.className = 'topic-comments-header';
  
  const titleEl = document.createElement('h3');
  titleEl.textContent = `${topic.topic} (${topic.count || 0} comments)`;
  headerEl.appendChild(titleEl);
  
  // Add a close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.className = 'topic-close-btn';
  closeBtn.addEventListener('click', () => {
    topicCommentsEl.innerHTML = '';
    topicCommentsEl.style.display = 'none';
  });
  headerEl.appendChild(closeBtn);
  
  topicCommentsEl.appendChild(headerEl);
  
  // If we have topic summary, display it
  if (topic.summary) {
    const summaryEl = document.createElement('div');
    summaryEl.className = 'topic-summary';
    summaryEl.textContent = topic.summary;
    topicCommentsEl.appendChild(summaryEl);
  }
  
  // Create comments list
  const commentsListEl = document.createElement('div');
  commentsListEl.className = 'topic-comments-list';
  
  // If we have commentIds, use them
  if (topic.commentIds && Array.isArray(topic.commentIds)) {
    topic.commentIds.forEach(commentId => {
      const index = commentId - 1; // Convert to 0-based index
      
      if (index >= 0 && index < comments.length) {
        const commentText = comments[index];
        
        const commentEl = document.createElement('div');
        commentEl.className = 'topic-comment-item';
        commentEl.textContent = commentText;
        commentsListEl.appendChild(commentEl);
      }
    });
  } else {
    // Otherwise do a simple text search
    const keyword = topic.topic.toLowerCase();
    
    comments.forEach((comment, index) => {
      if (comment.toLowerCase().includes(keyword)) {
        const commentEl = document.createElement('div');
        commentEl.className = 'topic-comment-item';
        commentEl.textContent = comment;
        commentsListEl.appendChild(commentEl);
      }
    });
  }
  
  // If no comments found, show a message
  if (commentsListEl.children.length === 0) {
    const noCommentsEl = document.createElement('div');
    noCommentsEl.className = 'no-topic-comments';
    noCommentsEl.textContent = 'No comments found for this topic.';
    commentsListEl.appendChild(noCommentsEl);
  }
  
  topicCommentsEl.appendChild(commentsListEl);
  topicCommentsEl.style.display = 'block';
}

/**
 * Initialize topic visuals and translations
 */
export function initializeTopicVisualizer() {
  addTopicStyles();
  
  // Add translations for topics if not already defined
  if (window.translations) {
    if (window.translations.en && !window.translations.en['top-topics']) {
      window.translations.en['top-topics'] = 'Top Topics Mentioned';
      window.translations.en['topics-description'] = 'Click on a topic to see related comments.';
    }
    
    if (window.translations.ar && !window.translations.ar['top-topics']) {
      window.translations.ar['top-topics'] = 'أكثر المواضيع ذكرًا';
      window.translations.ar['topics-description'] = 'انقر على موضوع لعرض التعليقات المتعلقة به.';
    }
  }
}