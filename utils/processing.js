const { generateJobId, cleanJsonString, fixJsonString } = require('./helpers');

/**
 * Parse Claude API response with enhanced error handling
 * @param {Object} response - Axios response object
 * @param {number} batchIndex - Batch index for logging
 * @returns {Object} Parsed categorization results
 */
function parseClaudeResponse(response, batchIndex = 0) {
  try {
    const responseContent = response.data.content[0].text;
    
    console.log(`Raw Claude response for batch ${batchIndex + 1} (first 200 chars):`, responseContent.substring(0, 200));
    
    // Check if response is conversational rather than JSON
    const conversationalPatterns = [
      'سأقوم', 'قبل أن', 'نظرًا ل', 'هل تريد', 'اقتراح:', 'من خلال تحليل',
      'I will', 'Before I', 'Let me', 'Would you like', 'Here is', 'Based on',
      'I understand', 'To categorize', 'Looking at these'
    ];
    
    const isConversational = conversationalPatterns.some(starter => 
      responseContent.trim().toLowerCase().startsWith(starter.toLowerCase())
    );
    
    if (isConversational) {
      console.log(`Batch ${batchIndex + 1}: Detected conversational response, returning empty result`);
      return { categorizedComments: [], extractedTopics: [] };
    }
    
    // Multiple extraction strategies with fallbacks
    const extractionStrategies = [
      // Strategy 1: Direct JSON extraction
      () => {
        const jsonMatch = responseContent.match(/\{[\s\S]*"categorizedComments"[\s\S]*?\}/);
        return jsonMatch ? jsonMatch[0] : null;
      },
      
      // Strategy 2: Code block extraction
      () => {
        const codeBlockMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        return codeBlockMatch ? codeBlockMatch[1] : null;
      },
      
      // Strategy 3: First complete JSON object
      () => {
        const firstBrace = responseContent.indexOf('{');
        if (firstBrace === -1) return null;
        
        let braceCount = 0;
        let endIndex = firstBrace;
        
        for (let i = firstBrace; i < responseContent.length; i++) {
          if (responseContent[i] === '{') braceCount++;
          if (responseContent[i] === '}') braceCount--;
          if (braceCount === 0) {
            endIndex = i;
            break;
          }
        }
        
        return responseContent.substring(firstBrace, endIndex + 1);
      },
      
      // Strategy 4: Pattern matching reconstruction
      () => {
        return reconstructFromPatterns(responseContent, batchIndex);
      }
    ];
    
    for (let strategyIndex = 0; strategyIndex < extractionStrategies.length; strategyIndex++) {
      try {
        const extracted = extractionStrategies[strategyIndex]();
        if (!extracted) continue;
        
        // Clean and parse the extracted JSON
        const cleaned = cleanJsonRobust(extracted);
        const parsed = JSON.parse(cleaned);
        
        if (parsed.categorizedComments && Array.isArray(parsed.categorizedComments) && parsed.categorizedComments.length > 0) {
          console.log(`Batch ${batchIndex + 1}: Successfully parsed using strategy ${strategyIndex + 1}`);
          return parsed;
        }
      } catch (e) {
        console.log(`Batch ${batchIndex + 1}: Strategy ${strategyIndex + 1} failed: ${e.message}`);
        continue;
      }
    }
    
    console.log(`Batch ${batchIndex + 1}: All parsing strategies failed`);
    return { categorizedComments: [], extractedTopics: [] };
    
  } catch (error) {
    console.error(`Batch ${batchIndex + 1}: Error in parseClaudeResponse:`, error);
    return { categorizedComments: [], extractedTopics: [] };
  }
}

/**
 * Robust JSON cleaning function
 */
function cleanJsonRobust(jsonString) {
  try {
    let cleaned = jsonString;
    
    // Fix common Arabic category formatting issues
    const categoryFixes = [
      [/"مالية":\s*التسعير/g, '"مالية: التسعير"'],
      [/"مشكلات\s*تقنية":\s*([^",}]+)/g, '"مشكلات تقنية: $1"'],
      [/"ملاحظات\s*العملاء":\s*([^",}]+)/g, '"ملاحظات العملاء: $1"'],
      [/"category":\s*"([^"]*)"([^"]*)":\s*([^",}]+)/g, '"category": "$1$2: $3"'],
      [/"category":\s*([^",{}]+)([,}])/g, '"category": "$1"$2'],
      // Fix incomplete categories
      [/"category":\s*"([^"]*)"([^"]*)"$/gm, '"category": "$1$2"']
    ];
    
    for (const [pattern, replacement] of categoryFixes) {
      cleaned = cleaned.replace(pattern, replacement);
    }
    
    // General structural fixes
    cleaned = cleaned
      .replace(/\\"/g, '"')
      .replace(/\\n/g, ' ')
      .replace(/\n/g, ' ')
      .replace(/\r/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/,\s*}/g, '}')
      .replace(/,\s*]/g, ']')
      .replace(/"{2,}/g, '"')
      .replace(/:\s*,/g, ': "",')
      .replace(/\[\s*,/g, '[')
      .replace(/,\s*,/g, ',')
      .replace(/}\s*{/g, '},{'); // Fix missing commas between objects
    
    // Fix unbalanced braces and brackets
    const openBraces = (cleaned.match(/{/g) || []).length;
    const closeBraces = (cleaned.match(/}/g) || []).length;
    if (openBraces > closeBraces) {
      cleaned += '}'.repeat(openBraces - closeBraces);
    }
    
    const openBrackets = (cleaned.match(/\[/g) || []).length;
    const closeBrackets = (cleaned.match(/\]/g) || []).length;
    if (openBrackets > closeBrackets) {
      cleaned += ']'.repeat(openBrackets - closeBrackets);
    }
    
    return cleaned;
    
  } catch (error) {
    console.error('JSON cleaning error:', error.message);
    return '{"categorizedComments": [], "extractedTopics": []}';
  }
}

/**
 * Pattern-based reconstruction as last resort
 */
function reconstructFromPatterns(responseContent, batchIndex) {
  console.log(`Batch ${batchIndex + 1}: Attempting pattern-based reconstruction...`);
  
  const patterns = [
    // Enhanced patterns for various malformed structures
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"[^}]*?"topics":\s*\[([^\]]*)\]/g,
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*([^,}]+)[^}]*?"topics":\s*\[([^\]]*)\]/g,
    /"id":\s*(\d+)[^}]*?"comment":\s*"([^"]+)"[^}]*?"category":\s*"([^"]+)"/g,
    /(\d+)\.\s*([^"]*?)(?="category"|$)[^}]*?"category":\s*"?([^",}]+)"?/g
  ];
  
  let bestResults = [];
  
  for (const pattern of patterns) {
    const results = [];
    let match;
    pattern.lastIndex = 0;
    
    while ((match = pattern.exec(responseContent)) !== null) {
      try {
        const [, id, comment, category, topicsStr] = match;
        
        let topics = [];
        if (topicsStr && topicsStr.trim()) {
          topics = topicsStr.split(',')
            .map(topic => topic.trim().replace(/^["']|["']$/g, ''))
            .filter(topic => topic.length > 0);
        }
        
        const cleanCategory = category.replace(/^["']|["']$/g, '').trim();
        
        if (id && comment && cleanCategory) {
          results.push({
            id: parseInt(id),
            comment: comment.trim(),
            category: cleanCategory,
            topics: topics
          });
        }
      } catch (e) {
        continue;
      }
    }
    
    if (results.length > bestResults.length) {
      bestResults = results;
    }
  }
  
  console.log(`Batch ${batchIndex + 1}: Pattern reconstruction found ${bestResults.length} comments`);
  
  return JSON.stringify({
    categorizedComments: bestResults,
    extractedTopics: []
  });
}

/**
 * Fix Arabic category names specifically
 */
function fixArabicCategoryJSON(jsonString) {
  console.log('Applying Arabic category JSON fixes...');
  
  let fixed = jsonString;
  
  // Pattern 1: "مالية": التسعير -> "مالية: التسعير"
  fixed = fixed.replace(/"مالية":\s*التسعير/g, '"مالية: التسعير"');
  
  // Pattern 2: "مشكلات "تقنية": -> "مشكلات تقنية:"
  fixed = fixed.replace(/"مشكلات\s+"تقنية":\s*([^,}"]+)/g, '"مشكلات تقنية: $1"');
  
  // Pattern 3: "ملاحظات "العملاء": -> "ملاحظات العملاء:"
  fixed = fixed.replace(/"ملاحظات\s+"العملاء":\s*([^,}"]+)/g, '"ملاحظات العملاء: $1"');
  
  // Pattern 4: Fix incomplete category names that end with comma instead of quote
  fixed = fixed.replace(/"category":\s*([^",}]+),/g, '"category": "$1",');
  
  // Pattern 5: Fix the specific patterns seen in logs
  fixed = fixed.replace(/"category":\s*"مالية":\s*([^",}]+),/g, '"category": "مالية: $1",');
  fixed = fixed.replace(/"category":\s*"مشكلات\s+"تقنية":\s*([^",}]+),/g, '"category": "مشكلات تقنية: $1",');
  
  // Pattern 6: Fix any remaining malformed category patterns
  fixed = fixed.replace(/"category":\s*"([^"]*)"([^"]*)":\s*([^",}]+),/g, '"category": "$1$2: $3",');
  
  // Pattern 7: Ensure all category values are properly quoted
  fixed = fixed.replace(/"category":\s*([^",{}]+)([,}])/g, '"category": "$1"$2');
  
  // General cleanup
  fixed = fixed
    .replace(/\\"/g, '"')           // Fix escaped quotes
    .replace(/\\n/g, ' ')           // Replace newlines with spaces
    .replace(/,\s*}/g, '}')         // Remove trailing commas
    .replace(/,\s*]/g, ']')         // Remove trailing commas in arrays
    .replace(/"{2,}/g, '"')         // Fix multiple consecutive quotes
    .replace(/:\s*,/g, ': "",')     // Fix empty values
    .replace(/\[\s*,/g, '[')        // Fix arrays starting with comma
    .replace(/,\s*,/g, ',');        // Fix double commas
  
  return fixed;
}

/**
 * Extract categorized comments from severely malformed JSON
 */
function extractCategorizedComments(jsonString) {
  console.log('Attempting to extract categorized comments from malformed JSON...');
  
  const result = { categorizedComments: [], extractedTopics: [] };
  
  // Try to find individual comment objects using regex
  const commentPattern = /"id":\s*(\d+),\s*"comment":\s*"([^"]+)",\s*"category":\s*"([^"]+)",\s*"topics":\s*\[([^\]]*)\]/g;
  
  let match;
  while ((match = commentPattern.exec(jsonString)) !== null) {
    try {
      const [, id, comment, category, topicsStr] = match;
      
      // Parse topics array
      let topics = [];
      if (topicsStr.trim()) {
        topics = topicsStr.split(',').map(topic => 
          topic.trim().replace(/^["']|["']$/g, '')
        ).filter(topic => topic.length > 0);
      }
      
      result.categorizedComments.push({
        id: parseInt(id),
        comment: comment,
        category: category,
        topics: topics
      });
    } catch (e) {
      console.log('Failed to parse individual comment, skipping...');
    }
  }
  
  return result;
}

module.exports = {
  parseClaudeResponse,
  cleanJsonRobust,
  reconstructFromPatterns,
  fixArabicCategoryJSON,
  extractCategorizedComments,
  generateJobId
};