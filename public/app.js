// Define comments array in global scope
window.comments = [];

// Basic initialization function
function initApp() {
  console.log("App initialized successfully");
  
  // Get basic elements
  const addCommentBtn = document.getElementById('addCommentBtn');
  const commentInput = document.getElementById('commentInput');
  const commentsList = document.getElementById('commentsList');
  
  // Add comment functionality
  if (addCommentBtn && commentInput && commentsList) {
    addCommentBtn.addEventListener('click', function() {
      const text = commentInput.value.trim();
      if (text) {
        window.comments.push(text);
        
        // Add to list
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.textContent = text;
        commentsList.appendChild(item);
        
        // Clear input
        commentInput.value = '';
      }
    });
    
    console.log("Comment functionality enabled");
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  try {
    initApp();
  } catch(e) {
    console.error("Error initializing app:", e);
  }
});
