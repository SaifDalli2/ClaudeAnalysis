/**
 * Dashboard functionality for NPS Analytics
 */

// Global dashboard state
window.dashboardData = {
  npsScore: 47,
  promoters: 68,
  passives: 21,
  detractors: 11,
  categories: [],
  factors: []
};

// Initialize Dashboard
function initializeDashboard() {
  console.log('🚀 Initializing NPS Dashboard...');
  
  try {
    initializeCharts();
    initializeNavigation();
    initializeFileUpload();
    loadWidgetContent();
    setupRealTimeUpdates();
    loadSampleData();
    
    console.log('✅ Dashboard initialized successfully!');
  } catch (error) {
    console.error('❌ Dashboard initialization failed:', error);
  }
}

// Initialize Charts
function initializeCharts() {
  // NPS Trend Chart
  const npsCtx = document.getElementById('npsChart');
  if (npsCtx) {
    const npsChart = new Chart(npsCtx.getContext('2d'), {
      type: 'line',
      data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        datasets: [{
          label: 'Overall NPS',
          data: [32, 38, 42, 39, 45, 47, 44, 49, 46, 51, 47, 47],
          borderColor: '#E2FF66',
          backgroundColor: 'rgba(226, 255, 102, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Promoters %',
          data: [58, 62, 65, 63, 67, 68, 66, 70, 68, 72, 69, 68],
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          tension: 0.4
        }, {
          label: 'Detractors %',
          data: [26, 24, 23, 24, 22, 21, 22, 21, 22, 21, 22, 21],
          borderColor: '#F44336',
          backgroundColor: 'rgba(244, 67, 54, 0.1)',
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#E8E8FF' }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: { color: '#333355' },
            ticks: { color: '#B4B4D0' }
          },
          x: {
            grid: { color: '#333355' },
            ticks: { color: '#B4B4D0' }
          }
        }
      }
    });
  }

  // Distribution Chart
  const distCtx = document.getElementById('distributionChart');
  if (distCtx) {
    const distributionChart = new Chart(distCtx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Promoters (9-10)', 'Passives (7-8)', 'Detractors (0-6)'],
        datasets: [{
          data: [68, 21, 11],
          backgroundColor: ['#4CAF50', '#FF9800', '#F44336'],
          borderWidth: 2,
          borderColor: '#1E1E2F'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#E8E8FF', padding: 20 }
          }
        }
      }
    });
  }

  console.log('✅ Charts initialized');
}

// Initialize Navigation
function initializeNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function() {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
      
      const view = this.getAttribute('data-view');
      switchDashboardView(view);
    });
  });
  
  console.log('✅ Navigation initialized');
}

// Switch Dashboard Views
function switchDashboardView(view) {
  console.log(`Switching to view: ${view}`);
  
  switch(view) {
    case 'dashboard':
      // Show main dashboard content
      break;
    case 'trends':
      alert('Trends view - Coming soon!');
      break;
    case 'segments':
      alert('Segments view - Coming soon!');
      break;
    case 'reports':
      alert('Reports view - Coming soon!');
      break;
  }
}

// Load Widget Content
function loadWidgetContent() {
  const iframe = document.getElementById('commentToolFrame');
  const loading = document.getElementById('widgetLoading');
  
  if (iframe && loading) {
    // Show iframe after loading delay
    setTimeout(() => {
      loading.style.display = 'none';
      iframe.style.display = 'block';
      console.log('✅ Widget content loaded');
    }, 2000);
  }
}

// Initialize File Upload
function initializeFileUpload() {
  const dropZone = document.getElementById('fileDropZone');
  const fileInput = document.getElementById('fileInput');

  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => {
      fileInput.click();
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        fileInput.files = files;
        console.log('File dropped:', files[0].name);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        console.log('File selected:', e.target.files[0].name);
      }
    });
    
    console.log('✅ File upload initialized');
  }
}

// Load Sample Data
function loadSampleData() {
  const categories = [
    { name: 'Customer Service', count: 156, sentiment: -0.4 },
    { name: 'Product Quality', count: 142, sentiment: 0.6 },
    { name: 'Pricing', count: 98, sentiment: -0.2 },
    { name: 'User Experience', count: 87, sentiment: 0.3 },
    { name: 'Performance', count: 76, sentiment: 0.0 }
  ];

  const factors = [
    { name: 'Product Quality', weight: 85, score: 8.5 },
    { name: 'Customer Support', weight: 60, score: 6.0 },
    { name: 'Ease of Use', weight: 78, score: 7.8 },
    { name: 'Value for Money', weight: 45, score: 4.5 }
  ];

  updateCategoriesList(categories);
  updateFactorsList(factors);
}

// Update Categories List
function updateCategoriesList(categories) {
  const container = document.getElementById('categoriesList');
  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <div class="insight-item">
      <span class="insight-name">${cat.name}</span>
      <div class="insight-metrics">
        <span class="insight-count">${cat.count} comments</span>
        <span class="sentiment-badge sentiment-${getSentimentClass(cat.sentiment)}">${cat.sentiment.toFixed(1)}</span>
      </div>
    </div>
  `).join('');
}

// Update Factors List
function updateFactorsList(factors) {
  const container = document.getElementById('factorsList');
  if (!container) return;

  container.innerHTML = factors.map(factor => `
    <div class="insight-item">
      <span class="insight-name">${factor.name}</span>
      <div class="insight-metrics">
        <span class="insight-count">Weight: ${factor.weight}%</span>
        <span class="sentiment-badge sentiment-${getScoreClass(factor.score)}">${factor.score}</span>
      </div>
    </div>
  `).join('');
}

// Helper Functions
function getSentimentClass(sentiment) {
  if (sentiment > 0.3) return 'positive';
  if (sentiment < -0.3) return 'negative';
  return 'neutral';
}

function getScoreClass(score) {
  if (score > 7) return 'positive';
  if (score < 5) return 'negative';
  return 'neutral';
}

// Real-time Updates
function setupRealTimeUpdates() {
  setInterval(() => {
    updateMetrics();
  }, 30000); // Update every 30 seconds
}

function updateMetrics() {
  const npsElement = document.getElementById('overallNPS');
  if (npsElement) {
    const currentNPS = parseInt(npsElement.textContent.replace('+', ''));
    const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
    const newNPS = Math.max(-100, Math.min(100, currentNPS + change));
    npsElement.textContent = newNPS > 0 ? `+${newNPS}` : newNPS.toString();
  }
}

// Modal Functions
function openUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeUploadModal() {
  const modal = document.getElementById('uploadModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function processUpload() {
  const fileInput = document.getElementById('fileInput');
  if (fileInput && fileInput.files.length > 0) {
    console.log('Processing file:', fileInput.files[0].name);
    alert('File upload functionality will be implemented in the next phase!');
    closeUploadModal();
  } else {
    alert('Please select a file first.');
  }
}

// Widget Functions
function toggleWidget() {
  const widget = document.querySelector('.comment-analysis-widget');
  const container = document.querySelector('.dashboard-container');
  const button = document.querySelector('.widget-toggle');
  
  if (!widget || !container || !button) return;
  
  if (widget.classList.contains('expanded')) {
    // Collapse widget
    widget.classList.remove('expanded');
    if (window.innerWidth > 1200) {
      container.style.gridTemplateColumns = '1fr 400px';
    }
    button.textContent = 'Expand';
  } else {
    // Expand widget
    widget.classList.add('expanded');
    if (window.innerWidth > 1200) {
      container.style.gridTemplateColumns = '1fr 800px';
    }
    button.textContent = 'Collapse';
  }
}

// Language Support for Dashboard
function applyDashboardLanguage(lang) {
  // Update dashboard-specific elements based on language
  const elements = {
    'upload-data-btn': lang === 'ar' ? 'رفع بيانات NPS' : 'Upload NPS Data'
  };
  
  Object.entries(elements).forEach(([id, text]) => {
    const element = document.querySelector(`[data-lang-key="${id}"]`) || document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  });
}

// Window resize handler for responsive charts
function handleWindowResize() {
  // Charts will auto-resize thanks to Chart.js responsive option
  const widget = document.querySelector('.comment-analysis-widget');
  const container = document.querySelector('.dashboard-container');
  
  if (widget && container && window.innerWidth <= 1200) {
    // Reset grid for mobile
    container.style.gridTemplateColumns = '1fr';
    widget.classList.remove('expanded');
  }
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt + U for upload
    if (e.altKey && e.key === 'u') {
      e.preventDefault();
      openUploadModal();
    }
    
    // Alt + W for widget toggle
    if (e.altKey && e.key === 'w') {
      e.preventDefault();
      toggleWidget();
    }
    
    // Alt + D for dashboard (if on other pages)
    if (e.altKey && e.key === 'd') {
      e.preventDefault();
      if (window.location.pathname !== '/dashboard') {
        window.location.href = '/dashboard';
      }
    }
    
    // Alt + C for comment tool
    if (e.altKey && e.key === 'c') {
      e.preventDefault();
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  });
}

// Click outside handler for dropdowns
function setupClickOutsideHandlers() {
  document.addEventListener('click', function(e) {
    // Close user dropdown when clicking outside
    const dropdown = document.getElementById('userDropdown');
    if (dropdown && !e.target.closest('.user-profile')) {
      dropdown.classList.remove('show');
    }
    
    // Close upload modal when clicking outside
    const modal = document.getElementById('uploadModal');
    if (modal && e.target === modal) {
      closeUploadModal();
    }
  });
}

// Error handling for dashboard
function handleDashboardError(error, context = 'Dashboard') {
  console.error(`${context} Error:`, error);
  
  // Show user-friendly error message
  const errorDiv = document.createElement('div');
  errorDiv.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #F44336;
    color: white;
    padding: 15px 20px;
    border-radius: 6px;
    z-index: 1001;
    max-width: 300px;
  `;
  errorDiv.textContent = `${context} error occurred. Check console for details.`;
  
  document.body.appendChild(errorDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (errorDiv.parentNode) {
      errorDiv.parentNode.removeChild(errorDiv);
    }
  }, 5000);
}

// Make functions globally available
window.initializeDashboard = initializeDashboard;
window.openUploadModal = openUploadModal;
window.closeUploadModal = closeUploadModal;
window.processUpload = processUpload;
window.toggleWidget = toggleWidget;
window.applyDashboardLanguage = applyDashboardLanguage;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  try {
    initializeDashboard();
    setupKeyboardShortcuts();
    setupClickOutsideHandlers();
    
    // Handle window resize
    window.addEventListener('resize', handleWindowResize);
    
    console.log('📊 Dashboard fully loaded and ready!');
  } catch (error) {
    handleDashboardError(error, 'Dashboard Initialization');
  }
});

console.log('📊 Dashboard JavaScript loaded');