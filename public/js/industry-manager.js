// public/js/industry-manager.js
/**
 * Industry-specific category management for the frontend
 */

class IndustryManager {
  constructor() {
    this.currentIndustry = null;
    this.availableIndustries = [];
    this.categories = [];
    this.npsFactors = [];
    this.initialized = false;
  }

  /**
   * Initialize the industry manager
   */
  async initialize() {
    try {
      console.log('🏭 Initializing Industry Manager...');
      
      // Load available industries
      await this.loadAvailableIndustries();
      
      // Detect user's industry if authenticated
      await this.detectUserIndustry();
      
      // Load categories for current industry
      await this.loadIndustryConfig();
      
      this.initialized = true;
      console.log(`✅ Industry Manager initialized for: ${this.currentIndustry}`);
      
      return true;
    } catch (error) {
      console.error('❌ Industry Manager initialization failed:', error);
      // Set defaults on failure
      this.currentIndustry = 'Default';
      this.categories = await this.getDefaultCategories();
      return false;
    }
  }

  /**
   * Load available industries from API
   */
  async loadAvailableIndustries() {
    try {
      const response = await fetch('/api/industries');
      if (response.ok) {
        const data = await response.json();
        this.availableIndustries = data.industries;
        console.log(`📋 Loaded ${data.industries.length} available industries`);
      }
    } catch (error) {
      console.warn('Failed to load industries:', error);
      this.availableIndustries = [
        { name: 'SaaS/Technology', displayName: 'SaaS/Technology' },
        { name: 'E-commerce/Retail', displayName: 'E-commerce/Retail' },
        { name: 'Healthcare', displayName: 'Healthcare' },
        { name: 'Financial Services', displayName: 'Financial Services' },
        { name: 'Default', displayName: 'General' }
      ];
    }
  }

  /**
   * Detect user's industry from authentication
   */
  async detectUserIndustry() {
    try {
      // Check if user is authenticated
      if (window.isAuthenticated && window.isAuthenticated()) {
        const user = window.getCurrentUser();
        if (user && user.industry) {
          this.currentIndustry = user.industry;
          console.log(`👤 User industry detected: ${this.currentIndustry}`);
          return this.currentIndustry;
        }
      }
      
      // Fallback to default
      this.currentIndustry = 'Default';
      console.log('👤 No user industry found, using Default');
      return this.currentIndustry;
      
    } catch (error) {
      console.warn('Error detecting user industry:', error);
      this.currentIndustry = 'Default';
      return this.currentIndustry;
    }
  }

  /**
   * Load industry configuration (categories and factors)
   */
  async loadIndustryConfig() {
    try {
      const industry = this.currentIndustry || 'Default';
      
      const headers = { 'Content-Type': 'application/json' };
      
      // Add authentication if available
      if (window.authToken) {
        headers['Authorization'] = `Bearer ${window.authToken}`;
      }
      
      const response = await fetch(`/api/industries/${encodeURIComponent(industry)}/config`, {
        headers: headers
      });
      
      if (response.ok) {
        const data = await response.json();
        this.categories = data.categories || [];
        this.npsFactors = data.npsFactors || [];
        
        console.log(`📊 Loaded ${this.categories.length} categories for ${industry}`);
        console.log(`⚖️ Loaded ${this.npsFactors.length} NPS factors for ${industry}`);
        
        return true;
      } else {
        throw new Error(`Failed to load config: ${response.status}`);
      }
      
    } catch (error) {
      console.warn('Failed to load industry config:', error);
      // Load defaults
      this.categories = await this.getDefaultCategories();
      this.npsFactors = await this.getDefaultFactors();
      return false;
    }
  }

  /**
   * Get categories for current industry
   */
  getCategories() {
    return this.categories || [];
  }

  /**
   * Get NPS factors for current industry
   */
  getNpsFactors() {
    return this.npsFactors || [];
  }

  /**
   * Get current industry
   */
  getCurrentIndustry() {
    return this.currentIndustry || 'Default';
  }

  /**
   * Get available industries
   */
  getAvailableIndustries() {
    return this.availableIndustries || [];
  }

  /**
   * Switch to a different industry
   */
  async switchIndustry(industry) {
    try {
      console.log(`🔄 Switching from ${this.currentIndustry} to ${industry}`);
      
      this.currentIndustry = industry;
      
      // Reload configuration for new industry
      await this.loadIndustryConfig();
      
      // Notify about the change
      this.notifyIndustryChange();
      
      console.log(`✅ Switched to ${industry} industry`);
      return true;
      
    } catch (error) {
      console.error('Failed to switch industry:', error);
      return false;
    }
  }

  /**
   * Check if current industry is user's default
   */
  isUserIndustry() {
    if (window.isAuthenticated && window.isAuthenticated()) {
      const user = window.getCurrentUser();
      return user && user.industry === this.currentIndustry;
    }
    return false;
  }

  /**
   * Get category suggestions
   */
  async getCategorySuggestions(query) {
    try {
      if (!query || query.length < 2) {
        return [];
      }
      
      const industry = this.currentIndustry || 'Default';
      const response = await fetch(
        `/api/industries/${encodeURIComponent(industry)}/categories/suggest?q=${encodeURIComponent(query)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.suggestions || [];
      }
      
      return [];
    } catch (error) {
      console.warn('Failed to get category suggestions:', error);
      return [];
    }
  }

  /**
   * Update UI with industry information
   */
  updateIndustryDisplay() {
    // Update industry badge if exists
    const industryBadge = document.getElementById('industryBadge');
    if (industryBadge) {
      industryBadge.textContent = this.currentIndustry;
      industryBadge.style.display = this.currentIndustry !== 'Default' ? 'inline-block' : 'none';
    }

    // Update category count display
    const categoryCount = document.getElementById('categoryCount');
    if (categoryCount) {
      categoryCount.textContent = this.categories.length;
    }

    // Add industry info to processing section
    this.addIndustryInfo();
  }

  /**
   * Add industry information to the processing section
   */
  addIndustryInfo() {
    const apiKeySection = document.querySelector('.api-key-section');
    if (apiKeySection && !document.getElementById('industryInfo')) {
      const industryInfo = document.createElement('div');
      industryInfo.id = 'industryInfo';
      industryInfo.className = 'industry-info';
      industryInfo.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        background: rgba(226, 255, 102, 0.1);
        border: 1px solid rgba(226, 255, 102, 0.2);
        border-radius: 4px;
        font-size: 13px;
        color: var(--dark-text-secondary);
      `;
      
      this.updateIndustryInfoContent(industryInfo);
      apiKeySection.appendChild(industryInfo);
    } else if (document.getElementById('industryInfo')) {
      this.updateIndustryInfoContent(document.getElementById('industryInfo'));
    }
  }

  /**
   * Update industry info content
   */
  updateIndustryInfoContent(element) {
    if (!element) return;
    
    const isUserIndustry = this.isUserIndustry();
    const categoryCount = this.categories.length;
    
    if (this.currentIndustry === 'Default') {
      element.innerHTML = `
        <strong>📋 Using General Categories</strong><br>
        ${categoryCount} categories available. ${isUserIndustry ? '' : 'Login and set your industry for specialized categories.'}
      `;
    } else {
      element.innerHTML = `
        <strong>🏭 Industry: ${this.currentIndustry}</strong><br>
        Using ${categoryCount} specialized categories for your industry.
      `;
    }
  }

  /**
   * Notify other parts of the app about industry change
   */
  notifyIndustryChange() {
    // Update UI
    this.updateIndustryDisplay();
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('industryChanged', {
      detail: {
        industry: this.currentIndustry,
        categories: this.categories,
        npsFactors: this.npsFactors
      }
    }));
  }

  /**
   * Get default categories (fallback)
   */
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

  /**
   * Get default NPS factors (fallback)
   */
  async getDefaultFactors() {
    return [
      'Overall Quality',
      'Customer Service',
      'Value for Money',
      'Ease of Use',
      'Reliability'
    ];
  }

  /**
   * Get industry-aware processing options
   */
  getProcessingOptions() {
    return {
      industry: this.currentIndustry,
      categories: this.categories,
      npsFactors: this.npsFactors,
      isUserIndustry: this.isUserIndustry()
    };
  }
}

// Create global instance with proper initialization
if (!window.industryManager) {
  window.industryManager = new IndustryManager();
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IndustryManager;
}

console.log('🏭 Industry Manager loaded');