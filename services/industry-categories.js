// services/industry-categories.js
const { getIndustryConfig } = require('../utils/database');

/**
 * Industry-specific category configurations
 */
const INDUSTRY_CATEGORIES = {
  'SaaS/Technology': {
    categories: [
      'Technical Issues: Bug Reports',
      'Technical Issues: Feature Requests', 
      'Technical Issues: Performance',
      'Technical Issues: Integration Issues',
      'Technical Issues: API/SDK Issues',
      'Customer Success: Onboarding',
      'Customer Success: Training',
      'Customer Success: Support Quality',
      'Customer Success: Documentation',
      'Product Feedback: UI/UX',
      'Product Feedback: Functionality',
      'Product Feedback: Mobile Experience',
      'Product Feedback: Accessibility',
      'Billing: Pricing',
      'Billing: Invoicing',
      'Billing: Payment Issues',
      'Billing: Subscription Management'
    ],
    npsFactors: [
      'Product Quality',
      'Customer Support', 
      'Ease of Use',
      'Value for Money',
      'Feature Completeness',
      'Performance',
      'Documentation Quality'
    ]
  },

  'E-commerce/Retail': {
    categories: [
      'Product Quality: Defects',
      'Product Quality: Durability', 
      'Product Quality: Description Accuracy',
      'Product Quality: Size/Fit Issues',
      'Shipping: Delivery Speed',
      'Shipping: Packaging',
      'Shipping: Tracking',
      'Shipping: Damage in Transit',
      'Customer Service: Response Time',
      'Customer Service: Resolution',
      'Customer Service: Helpfulness',
      'Customer Service: Return Process',
      'Website Experience: Navigation',
      'Website Experience: Checkout',
      'Website Experience: Search',
      'Website Experience: Mobile App',
      'Pricing: Competitiveness',
      'Pricing: Promotions',
      'Pricing: Hidden Fees'
    ],
    npsFactors: [
      'Product Quality',
      'Shipping Experience',
      'Customer Service', 
      'Website Usability',
      'Value for Money',
      'Return Policy',
      'Product Selection'
    ]
  },

  'Healthcare': {
    categories: [
      'Clinical Care: Treatment Quality',
      'Clinical Care: Provider Communication',
      'Clinical Care: Care Coordination',
      'Clinical Care: Follow-up Care',
      'Facility Experience: Wait Times',
      'Facility Experience: Cleanliness',
      'Facility Experience: Accessibility',
      'Facility Experience: Parking',
      'Administrative: Billing',
      'Administrative: Scheduling',
      'Administrative: Insurance',
      'Administrative: Records Access',
      'Staff Interaction: Professionalism',
      'Staff Interaction: Empathy',
      'Staff Interaction: Responsiveness',
      'Staff Interaction: Courtesy',
      'Technology: Portal/App',
      'Technology: Telemedicine',
      'Technology: Communication Tools'
    ],
    npsFactors: [
      'Care Quality',
      'Staff Friendliness',
      'Wait Times',
      'Facility Cleanliness',
      'Billing Clarity',
      'Appointment Scheduling',
      'Communication'
    ]
  },

  'Financial Services': {
    categories: [
      'Account Management: Access',
      'Account Management: Features',
      'Account Management: Statements',
      'Account Management: Account Changes',
      'Transaction Processing: Speed',
      'Transaction Processing: Accuracy', 
      'Transaction Processing: Fees',
      'Transaction Processing: Fraud Protection',
      'Customer Support: Knowledge',
      'Customer Support: Availability',
      'Customer Support: Resolution',
      'Customer Support: Phone Experience',
      'Digital Experience: Mobile App',
      'Digital Experience: Website',
      'Digital Experience: Security',
      'Digital Experience: Features',
      'Lending: Application Process',
      'Lending: Approval Speed',
      'Lending: Terms and Rates'
    ],
    npsFactors: [
      'Service Quality',
      'Digital Experience',
      'Fees and Pricing',
      'Security',
      'Customer Support',
      'Product Offerings',
      'Branch Experience'
    ]
  },

  'Hospitality': {
    categories: [
      'Accommodation: Room Quality',
      'Accommodation: Cleanliness',
      'Accommodation: Amenities',
      'Accommodation: Comfort',
      'Service: Front Desk',
      'Service: Housekeeping',
      'Service: Concierge',
      'Service: Room Service',
      'Dining: Food Quality',
      'Dining: Service',
      'Dining: Variety',
      'Dining: Pricing',
      'Facilities: Pool/Spa',
      'Facilities: Gym/Fitness',
      'Facilities: Business Center',
      'Facilities: WiFi',
      'Location: Accessibility',
      'Location: Safety',
      'Location: Attractions Nearby',
      'Booking: Reservation Process',
      'Booking: Check-in/Check-out',
      'Booking: Pricing Transparency'
    ],
    npsFactors: [
      'Room Quality',
      'Service Quality',
      'Location',
      'Value for Money',
      'Cleanliness',
      'Amenities',
      'Food & Beverage'
    ]
  },

  'Default': {
    categories: [
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
    ],
    npsFactors: [
      'Overall Quality',
      'Customer Service',
      'Value for Money',
      'Ease of Use',
      'Reliability'
    ]
  }
};

/**
 * Get categories for a specific industry
 * @param {string} industry - Industry name
 * @returns {Array} Array of category names
 */
async function getCategoriesForIndustry(industry) {
  try {
    // First try to get from database
    if (getIndustryConfig) {
      const dbConfig = await getIndustryConfig(industry);
      if (dbConfig && dbConfig.categories) {
        console.log(`✅ Loaded ${dbConfig.categories.length} categories for ${industry} from database`);
        return dbConfig.categories;
      }
    }
    
    // Fallback to in-memory configuration
    const config = INDUSTRY_CATEGORIES[industry] || INDUSTRY_CATEGORIES['Default'];
    console.log(`✅ Loaded ${config.categories.length} categories for ${industry} from memory`);
    return config.categories;
    
  } catch (error) {
    console.error(`Error loading categories for ${industry}:`, error);
    return INDUSTRY_CATEGORIES['Default'].categories;
  }
}

/**
 * Get NPS factors for a specific industry
 * @param {string} industry - Industry name
 * @returns {Array} Array of NPS factor names
 */
async function getNpsFactorsForIndustry(industry) {
  try {
    // First try to get from database
    if (getIndustryConfig) {
      const dbConfig = await getIndustryConfig(industry);
      if (dbConfig && dbConfig.nps_factors) {
        console.log(`✅ Loaded ${dbConfig.nps_factors.length} NPS factors for ${industry} from database`);
        return dbConfig.nps_factors;
      }
    }
    
    // Fallback to in-memory configuration
    const config = INDUSTRY_CATEGORIES[industry] || INDUSTRY_CATEGORIES['Default'];
    console.log(`✅ Loaded ${config.npsFactors.length} NPS factors for ${industry} from memory`);
    return config.npsFactors;
    
  } catch (error) {
    console.error(`Error loading NPS factors for ${industry}:`, error);
    return INDUSTRY_CATEGORIES['Default'].npsFactors;
  }
}

/**
 * Get all available industries
 * @returns {Array} Array of industry names
 */
function getAvailableIndustries() {
  return Object.keys(INDUSTRY_CATEGORIES).filter(key => key !== 'Default');
}

/**
 * Add or update industry configuration
 * @param {string} industry - Industry name
 * @param {Object} config - Configuration object with categories and npsFactors
 */
async function updateIndustryConfig(industry, config) {
  try {
    // Update in-memory configuration
    INDUSTRY_CATEGORIES[industry] = {
      categories: config.categories || [],
      npsFactors: config.npsFactors || []
    };
    
    // If database is available, update there too
    if (updateIndustryConfig) {
      // This would be implemented with a database update function
      console.log(`✅ Updated industry config for ${industry}`);
    }
    
    return true;
  } catch (error) {
    console.error(`Error updating industry config for ${industry}:`, error);
    return false;
  }
}

/**
 * Validate industry configuration
 * @param {Object} config - Configuration to validate
 * @returns {Object} Validation result
 */
function validateIndustryConfig(config) {
  const errors = [];
  
  if (!config.categories || !Array.isArray(config.categories)) {
    errors.push('Categories must be an array');
  } else if (config.categories.length === 0) {
    errors.push('At least one category is required');
  } else if (config.categories.length > 50) {
    errors.push('Maximum 50 categories allowed');
  }
  
  if (!config.npsFactors || !Array.isArray(config.npsFactors)) {
    errors.push('NPS factors must be an array');
  } else if (config.npsFactors.length === 0) {
    errors.push('At least one NPS factor is required');
  } else if (config.npsFactors.length > 20) {
    errors.push('Maximum 20 NPS factors allowed');
  }
  
  // Validate category names
  if (config.categories) {
    config.categories.forEach((category, index) => {
      if (typeof category !== 'string' || category.trim().length === 0) {
        errors.push(`Category ${index + 1} must be a non-empty string`);
      } else if (category.length > 100) {
        errors.push(`Category ${index + 1} must be less than 100 characters`);
      }
    });
  }
  
  // Validate NPS factor names
  if (config.npsFactors) {
    config.npsFactors.forEach((factor, index) => {
      if (typeof factor !== 'string' || factor.trim().length === 0) {
        errors.push(`NPS factor ${index + 1} must be a non-empty string`);
      } else if (factor.length > 50) {
        errors.push(`NPS factor ${index + 1} must be less than 50 characters`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Get category suggestions based on partial input
 * @param {string} industry - Industry name
 * @param {string} partial - Partial category name
 * @returns {Array} Array of suggested categories
 */
async function getCategorySuggestions(industry, partial) {
  try {
    const categories = await getCategoriesForIndustry(industry);
    const query = partial.toLowerCase();
    
    return categories
      .filter(category => category.toLowerCase().includes(query))
      .sort((a, b) => {
        // Prioritize categories that start with the query
        const aStarts = a.toLowerCase().startsWith(query);
        const bStarts = b.toLowerCase().startsWith(query);
        
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        
        // Then sort alphabetically
        return a.localeCompare(b);
      })
      .slice(0, 10); // Limit to 10 suggestions
      
  } catch (error) {
    console.error('Error getting category suggestions:', error);
    return [];
  }
}

module.exports = {
  getCategoriesForIndustry,
  getNpsFactorsForIndustry,
  getAvailableIndustries,
  updateIndustryConfig,
  validateIndustryConfig,
  getCategorySuggestions,
  INDUSTRY_CATEGORIES
};