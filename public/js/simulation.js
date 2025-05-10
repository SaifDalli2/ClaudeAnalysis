/**
 * Simulation functions for the Comment Categorization application
 * Used when API mode is unavailable
 */
import { addLogEntry } from './utils.js';

/**
 * Generate enhanced simulated categories for comments
 * @param {Array<string>} comments - List of comments
 * @returns {Object} Simulated categorization results
 */
export function simulateEnhancedCategories(comments) {
  addLogEntry('Generating enhanced simulated categorization...');
  
  // Predefined categories with topics and sentiment ranges
  const predefinedCategories = [
    {
      name: "Technical issues: App update",
      sentimentRange: [-0.8, -0.3],
      possibleTopics: ["App update", "Update failed", "Latest version", "Download issues"],
      commonIssues: [
        "Update failures",
        "App crashes after update",
        "Missing features in new update"
      ],
      suggestedActions: [
        "Improve update validation process",
        "Add rollback option for failed updates",
        "Better communicate new features"
      ]
    },
    {
      name: "Technical issues: App Freeze/Slow",
      sentimentRange: [-0.9, -0.5],
      possibleTopics: ["App freezing", "App slow", "Unresponsive", "Performance issues"],
      commonIssues: [
        "App freezes during specific actions",
        "Slow loading times",
        "Battery drain during use"
      ],
      suggestedActions: [
        "Optimize code for better performance",
        "Reduce background processes",
        "Investigate memory leaks"
      ]
    },
    {
      name: "Technical issues: App issues",
      sentimentRange: [-0.7, -0.2],
      possibleTopics: ["App problem", "Bug", "Not working right", "Error message"],
      commonIssues: [
        "Sporadic error messages",
        "Inconsistent behavior",
        "Feature malfunctions"
      ],
      suggestedActions: [
        "Expand automated testing",
        "Improve error logging",
        "Review user-reported bugs weekly"
      ]
    },
    {
      name: "Technical issues: Doesn't work",
      sentimentRange: [-0.9, -0.6],
      possibleTopics: ["Doesn't work", "Not functioning", "Broken", "Unusable"],
      commonIssues: [
        "Complete app failure",
        "Key features not working",
        "Compatibility issues with devices"
      ],
      suggestedActions: [
        "Establish emergency response team",
        "Create service status page",
        "Improve device compatibility testing"
      ]
    },
    {
      name: "Technical issues: Login and Access",
      sentimentRange: [-0.8, -0.3],
      possibleTopics: ["Login", "Password", "Can't access", "Account issues"],
      commonIssues: [
        "Failed login attempts",
        "Password reset not working",
        "Account lockouts"
      ],
      suggestedActions: [
        "Simplify password reset process",
        "Improve error messages for login issues",
        "Add alternative authentication methods"
      ]
    },
    {
      name: "Technical issues: Security",
      sentimentRange: [-0.7, 0.2],
      possibleTopics: ["Security", "Privacy", "Data protection", "Unauthorized access"],
      commonIssues: [
        "Privacy concerns",
        "Suspicious activity alerts",
        "Data handling questions"
      ],
      suggestedActions: [
        "Enhance data encryption",
        "Update privacy policy with clearer language",
        "Add two-factor authentication option"
      ]
    },
    {
      name: "Customer Feedback: Complicated",
      sentimentRange: [-0.6, -0.1],
      possibleTopics: ["Too complicated", "Confusing", "Hard to use", "Complex"],
      commonIssues: [
        "Confusing navigation",
        "Too many steps for simple tasks",
        "Overwhelming interface"
      ],
      suggestedActions: [
        "Conduct usability testing",
        "Simplify most common user flows",
        "Add interactive tutorials"
      ]
    },
    {
      name: "Customer Feedback: Customer Service",
      sentimentRange: [-0.8, 0.8],
      possibleTopics: ["Customer service", "Support", "Help", "Response time"],
      commonIssues: [
        "Slow response times",
        "Unhelpful support agents",
        "Difficulty finding contact information"
      ],
      suggestedActions: [
        "Reduce support response time targets",
        "Improve support agent training",
        "Make contact options more visible"
      ]
    },
    {
      name: "Customer Feedback: Design",
      sentimentRange: [-0.5, 0.8],
      possibleTopics: ["Design", "Interface", "Layout", "Appearance"],
      commonIssues: [
        "Outdated design",
        "Inconsistent UI elements",
        "Poor readability"
      ],
      suggestedActions: [
        "Refresh UI with modern design patterns",
        "Standardize visual elements",
        "Improve text contrast and readability"
      ]
    },
    {
      name: "Customer Feedback: Offensive",
      sentimentRange: [-0.9, -0.7],
      possibleTopics: ["Offensive", "Inappropriate", "Objectionable", "Disturbing"],
      commonIssues: [
        "Inappropriate content",
        "Offensive language",
        "Inadequate content filtering"
      ],
      suggestedActions: [
        "Strengthen content moderation",
        "Improve reporting mechanisms",
        "Review and update community guidelines"
      ]
    },
    {
      name: "Customer Feedback: Thank you",
      sentimentRange: [0.7, 1.0],
      possibleTopics: ["Thank you", "Great app", "Love it", "Appreciation"],
      commonIssues: [
        "Users want more features",
        "Requests for expanded services",
        "Suggestions from happy users"
      ],
      suggestedActions: [
        "Create loyalty program",
        "Feature positive testimonials",
        "Encourage reviews on app stores"
      ]
    },
    {
      name: "Monetary: Fraud",
      sentimentRange: [-1.0, -0.8],
      possibleTopics: ["Fraud", "Scam", "Unauthorized charge", "Suspicious activity"],
      commonIssues: [
        "Unauthorized transactions",
        "Fraudulent account activity",
        "Phishing attempts"
      ],
      suggestedActions: [
        "Implement advanced fraud detection",
        "Add transaction verification steps",
        "Educate users about security best practices"
      ]
    },
    {
      name: "Monetary: Pricing",
      sentimentRange: [-0.7, 0.3],
      possibleTopics: ["Price", "Cost", "Expensive", "Subscription"],
      commonIssues: [
        "Perceived high prices",
        "Unclear pricing structure",
        "Unexpected charges"
      ],
      suggestedActions: [
        "Review pricing strategy",
        "Make pricing more transparent",
        "Consider introducing tiered options"
      ]
    },
    {
      name: "Monetary: Refund Request",
      sentimentRange: [-0.8, -0.2],
      possibleTopics: ["Refund", "Money back", "Cancel", "Return"],
      commonIssues: [
        "Difficulty obtaining refunds",
        "Unclear refund policy",
        "Delayed refund processing"
      ],
      suggestedActions: [
        "Streamline refund process",
        "Make refund policy more prominent",
        "Improve refund status notifications"
      ]
    }
  ];
  
  // Create random distribution of comments among categories
  const categories = [];
  const assignedComments = new Set();
  
  // Determine how many categories to use based on comment count
  const numCategories = Math.min(
    predefinedCategories.length,
    Math.max(3, Math.ceil(comments.length / 10))
  );
  
  // Randomly select categories
  const selectedCategories = [];
  const shuffledCategories = [...predefinedCategories].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < numCategories; i++) {
    selectedCategories.push(shuffledCategories[i]);
  }
  
  // Distribute comments among categories
  for (let i = 0; i < selectedCategories.length; i++) {
    const categoryTemplate = selectedCategories[i];
    const categoryComments = [];
    
    // Assign approximately equal number of comments to each category
    const targetCount = Math.floor(comments.length / selectedCategories.length);
    
    // For each category, find unassigned comments
    for (let j = 0; j < comments.length && categoryComments.length < targetCount; j++) {
      if (!assignedComments.has(j)) {
        categoryComments.push(j + 1); // 1-based indexing for comments
        assignedComments.add(j);
      }
    }
    
    // Skip categories with no comments
    if (categoryComments.length === 0) continue;
    
    // Random sentiment within the category's range
    const sentRange = categoryTemplate.sentimentRange;
    const sentiment = sentRange[0] + Math.random() * (sentRange[1] - sentRange[0]);
    
    // Select random topics from possible topics
    const numTopics = Math.min(
      categoryTemplate.possibleTopics.length, 
      Math.max(1, Math.floor(Math.random() * 3) + 1)
    );
    
    const selectedTopics = [];
    const shuffledTopics = [...categoryTemplate.possibleTopics].sort(() => Math.random() - 0.5);
    
    for (let j = 0; j < numTopics; j++) {
      selectedTopics.push(shuffledTopics[j]);
    }
    
    // Create simulated summary based on topics
    let summary = `Users reported issues related to ${selectedTopics.join(', ')}. `;
    
    if (categoryComments.length > 1) {
      summary += `Across ${categoryComments.length} comments, common themes include ${categoryTemplate.commonIssues.slice(0, 2).join(' and ')}.`;
    } else {
      summary += `The comment mentioned ${categoryTemplate.commonIssues[0]}.`;
    }
    
    // Add to results
    categories.push({
      name: categoryTemplate.name,
      comments: categoryComments,
      summary: summary,
      sentiment: parseFloat(sentiment.toFixed(2)),
      commonIssues: categoryTemplate.commonIssues,
      suggestedActions: categoryTemplate.suggestedActions
    });
  }
  
  // Assign any remaining comments to random categories
  for (let j = 0; j < comments.length; j++) {
    if (!assignedComments.has(j)) {
      const randomCategoryIndex = Math.floor(Math.random() * categories.length);
      categories[randomCategoryIndex].comments.push(j + 1); // 1-based indexing
      assignedComments.add(j);
    }
  }
  
  addLogEntry(`Created ${categories.length} simulated categories`);
  
  return { categories };
}

/**
 * Generate simulated topics from comments
 * @param {Array<string>} comments - List of comments
 * @returns {Array<Object>} Simulated topics
 */
export function simulateTopTopics(comments) {
  // Generate random topics based on common words
  const topicTemplates = [
    { word: "app", type: "application" },
    { word: "website", type: "website" },
    { word: "product", type: "product" },
    { word: "service", type: "service" },
    { word: "company", type: "organization" },
    { word: "support", type: "service" },
    { word: "price", type: "feature" },
    { word: "quality", type: "feature" },
    { word: "feature", type: "feature" },
    { word: "design", type: "feature" },
    { word: "interface", type: "feature" },
    { word: "customer service", type: "service" },
    { word: "payment", type: "process" },
    { word: "delivery", type: "process" },
    { word: "account", type: "feature" },
    { word: "login", type: "feature" },
    { word: "registration", type: "process" },
    { word: "issue", type: "problem" },
    { word: "error", type: "problem" },
    { word: "bug", type: "problem" }
  ];
  
  // Generate a random count of topics
  const numTopics = Math.min(topicTemplates.length, Math.max(5, Math.ceil(comments.length / 50)));
  
  // Shuffle and pick topics
  const shuffledTopics = [...topicTemplates].sort(() => Math.random() - 0.5);
  const selectedTopics = shuffledTopics.slice(0, numTopics);
  
  // Create simulated topic data
  return selectedTopics.map((template, index) => {
    // Generate a random count proportional to the number of comments
    const maxCount = Math.min(comments.length, 100);
    const count = Math.max(2, Math.floor(Math.random() * maxCount));
    
    // Generate random comment IDs
    const commentIds = [];
    for (let i = 0; i < count; i++) {
      const randomIndex = Math.floor(Math.random() * comments.length);
      commentIds.push(randomIndex + 1); // 1-based indexing
    }
    
    return {
      topic: template.word,
      type: template.type,
      count: count,
      commentIds: commentIds
    };
  });
}

/**
 * Basic simulation function (fallback)
 * @param {Array<string>} comments - List of comments
 * @returns {Object} Simple categorization results
 */
export function simulateBasicCategories(comments) {
  // Create random categories based on the comments
  const categories = [];
  const sentiments = [-0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8];
  
  // Create 2-4 categories
  const numCategories = Math.max(2, Math.min(4, Math.ceil(comments.length / 3)));
  
  // Distribute comments among categories
  const assignedComments = new Set();
  
  for (let i = 0; i < numCategories; i++) {
    const categoryComments = [];
    const categoryName = `Category ${i + 1}`;
    
    // Assign comments to this category
    const targetCount = Math.floor(comments.length / numCategories);
    
    // For each category, find unassigned comments
    for (let j = 0; j < comments.length && categoryComments.length < targetCount; j++) {
      if (!assignedComments.has(j)) {
        categoryComments.push(j + 1); // 1-based indexing for comments
        assignedComments.add(j);
      }
    }
    
    // Random sentiment
    const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    
    // Create simulated summary
    const summary = `This is a simulated summary for ${categoryComments.length} comments in ${categoryName}.`;
    
    categories.push({
      name: categoryName,
      comments: categoryComments,
      summary: summary,
      sentiment: sentiment
    });
  }
  
  // Assign any remaining comments to random categories
  for (let j = 0; j < comments.length; j++) {
    if (!assignedComments.has(j)) {
      const randomCategory = Math.floor(Math.random() * categories.length);
      categories[randomCategory].comments.push(j + 1); // 1-based indexing
      assignedComments.add(j);
    }
  }
  
  return { categories };
}

/**
 * Process comments with simulation
 * @param {Array<string>} comments - List of comments to process
 * @returns {Object} Simulated results
 */
export function processCommentsWithSimulation(comments) {
  addLogEntry('Using simulation mode for processing comments');
  
  const result = simulateEnhancedCategories(comments);
  const extractedTopics = simulateTopTopics(comments);
  
  return {
    ...result,
    extractedTopics
  };
}