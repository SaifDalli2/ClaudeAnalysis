// Enhanced Industry Manager - Unified Detection System
class UnifiedIndustryManager {
  constructor() {
    this.currentIndustry = 'Default';
    this.availableIndustries = [];
    this.categories = [];
    this.npsFactors = [];
    this.initialized = false;
    this.sources = {
      dashboard: null,
      userProfile: null,
      localStorage: null,
      urlParam: null
    };
  }

  async initialize() {
    try {
      console.log('🏭 Initializing Unified Industry Manager...');
      
      // Load available industries
      await this.loadAvailableIndustries();
      
      // Detect industry from all possible sources
      await this.detectIndustryFromAllSources();
      
      // Load categories for detected industry
      await this.loadIndustryConfig();
      
      // Sync across all components
      this.syncIndustryAcrossComponents();
      
      this.initialized = true;
      console.log(`✅ Unified Industry Manager initialized for: ${this.currentIndustry}`);
      
      return true;
    } catch (error) {
      console.error('❌ Industry Manager initialization failed:', error);
      this.currentIndustry = 'Default';
      return false;
    }
  }

  async detectIndustryFromAllSources() {
    // Priority order: URL param > Dashboard selection > User profile > LocalStorage > Default
    
    // 1. Check URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('industry')) {
      this.sources.urlParam = urlParams.get('industry');
      this.currentIndustry = this.sources.urlParam;
      console.log(`🔗 Industry from URL: ${this.currentIndustry}`);
      return;
    }
    
    // 2. Check dashboard selector (if on dashboard page)
    const dashboardSelector = document.getElementById('industrySelector');
    if (dashboardSelector && dashboardSelector.value) {
      this.sources.dashboard = dashboardSelector.value;
      this.currentIndustry = this.sources.dashboard;
      console.log(`📊 Industry from dashboard: ${this.currentIndustry}`);
      return;
    }
    
    // 3. Check user profile
    if (window.isAuthenticated && window.isAuthenticated()) {
      const user = window.getCurrentUser();
      if (user && user.industry) {
        this.sources.userProfile = user.industry;
        this.currentIndustry = this.sources.userProfile;
        console.log(`👤 Industry from user profile: ${this.currentIndustry}`);
        return;
      }
    }
    
    // 4. Check localStorage
    const storedIndustry = localStorage.getItem('selectedIndustry');
    if (storedIndustry) {
      this.sources.localStorage = storedIndustry;
      this.currentIndustry = this.sources.localStorage;
      console.log(`💾 Industry from localStorage: ${this.currentIndustry}`);
      return;
    }
    
    // 5. Default fallback
    this.currentIndustry = 'Default';
    console.log(`🔧 Using default industry: ${this.currentIndustry}`);
  }

  syncIndustryAcrossComponents() {
    // Update dashboard selector
    const dashboardSelector = document.getElementById('industrySelector');
    if (dashboardSelector && dashboardSelector.value !== this.currentIndustry) {
      dashboardSelector.value = this.currentIndustry;
    }
    
    // Update industry badge
    const industryBadge = document.getElementById('industryBadge');
    if (industryBadge) {
      industryBadge.textContent = this.currentIndustry;
      industryBadge.style.display = this.currentIndustry !== 'Default' ? 'inline-block' : 'none';
    }
    
    // Store in localStorage for persistence
    localStorage.setItem('selectedIndustry', this.currentIndustry);
    
    // Dispatch industry change event
    window.dispatchEvent(new CustomEvent('industryChanged', {
      detail: { 
        industry: this.currentIndustry,
        source: this.getActiveSource(),
        categories: this.categories,
        npsFactors: this.npsFactors 
      }
    }));
  }

  getActiveSource() {
    if (this.sources.urlParam) return 'url';
    if (this.sources.dashboard) return 'dashboard';
    if (this.sources.userProfile) return 'profile';
    if (this.sources.localStorage) return 'localStorage';
    return 'default';
  }

  async switchIndustry(industry, source = 'manual') {
    console.log(`🔄 Switching industry to: ${industry} (source: ${source})`);
    
    this.currentIndustry = industry;
    
    // Update the appropriate source
    this.sources[source] = industry;
    
    // Reload configuration
    await this.loadIndustryConfig();
    
    // Sync across all components
    this.syncIndustryAcrossComponents();
    
    console.log(`✅ Industry switched to: ${industry}`);
    return true;
  }

  async loadAvailableIndustries() {
    try {
      const response = await fetch('/api/industries');
      if (response.ok) {
        const data = await response.json();
        this.availableIndustries = data.industries;
      }
    } catch (error) {
      console.warn('Failed to load industries:', error);
      this.availableIndustries = [
        { name: 'SaaS/Technology', displayName: 'SaaS/Technology' },
        { name: 'E-commerce/Retail', displayName: 'E-commerce/Retail' },
        { name: 'Healthcare', displayName: 'Healthcare' },
        { name: 'Financial Services', displayName: 'Financial Services' },
        { name: 'Hospitality', displayName: 'Hospitality' },
        { name: 'Default', displayName: 'General' }
      ];
    }
  }

  async loadIndustryConfig() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (window.authToken) {
        headers['Authorization'] = `Bearer ${window.authToken}`;
      }
      
      const response = await fetch(`/api/industries/${encodeURIComponent(this.currentIndustry)}/config`, {
        headers: headers
      });
      
      if (response.ok) {
        const data = await response.json();
        this.categories = data.categories || [];
        this.npsFactors = data.npsFactors || [];
        console.log(`📊 Loaded ${this.categories.length} categories for ${this.currentIndustry}`);
        return true;
      }
    } catch (error) {
      console.warn('Failed to load industry config:', error);
      this.categories = await this.getDefaultCategories();
      this.npsFactors = await this.getDefaultFactors();
    }
  }

  // Enhanced processing options with source tracking
  getProcessingOptions() {
    return {
      industry: this.currentIndustry,
      industrySource: this.getActiveSource(),
      categories: this.categories,
      npsFactors: this.npsFactors,
      isUserIndustry: this.sources.userProfile === this.currentIndustry,
      isDashboardIndustry: this.sources.dashboard === this.currentIndustry
    };
  }

  async getDefaultCategories() {
    return [
      'Product/Service Quality',
      'Customer Service',
      'Pricing/Value',
      'User Experience',
      'Technical Issues',
      'Billing/Payment',
      'Delivery/Fulfillment',
      'Communication',
      'Features/Functionality',
      'Support/Help',
      'Reliability',
      'Ease of Use'
    ];
  }

  async getDefaultFactors() {
    return [
      'Overall Quality',
      'Customer Service',
      'Value for Money',
      'Ease of Use',
      'Reliability'
    ];
  }
}

// Global instance
window.unifiedIndustryManager = new UnifiedIndustryManager();

// Auto-initialize
document.addEventListener('DOMContentLoaded', async () => {
  await window.unifiedIndustryManager.initialize();
});