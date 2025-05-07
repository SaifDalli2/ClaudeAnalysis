// Improved parseClaudeResponse function to handle JSON parsing issues
function parseClaudeResponse(response) {
  try {
    // First try to get the content from the response
    const responseContent = response.data.content[0].text;
    
    // Try to extract JSON from the response
    let jsonString = responseContent;
    
    // Try to find JSON code blocks first
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/);
    if (jsonMatch && jsonMatch[1]) {
      jsonString = jsonMatch[1].trim();
    } else {
      // Look for JSON-like content with curly braces
      const jsonObjectMatch = responseContent.match(/({[\s\S]*})/);
      if (jsonObjectMatch && jsonObjectMatch[1]) {
        jsonString = jsonObjectMatch[1].trim();
      }
    }
    
    // Attempt to clean the JSON string before parsing
    // Remove comment lines and other non-JSON content
    jsonString = jsonString.replace(/\/\/.*$/gm, ''); // Remove single-line comments
    jsonString = jsonString.replace(/\/\*[\s\S]*?\*\//g, ''); // Remove multi-line comments
    
    // Log for debugging
    console.log('Clean JSON string (first 100 chars):', jsonString.substring(0, 100));
    
    try {
      // Try to parse the JSON
      const jsonData = JSON.parse(jsonString);
      return jsonData;
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('JSON string (first 1000 chars):', jsonString.substring(0, 1000));
      
      // If parsing fails, try to manually fix common JSON issues
      jsonString = jsonString
        .replace(/\\"/g, '"')      // Fix escaped quotes
        .replace(/\\n/g, ' ')      // Replace newlines with spaces
        .replace(/\\/g, '\\\\')    // Escape backslashes
        .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
        .replace(/,\s*}/g, '}')    // Remove trailing commas
        .replace(/,\s*]/g, ']');   // Remove trailing commas in arrays
      
      // Try parsing again after fixes
      try {
        const fixedJsonData = JSON.parse(jsonString);
        console.log('Successfully parsed JSON after fixing common issues');
        return fixedJsonData;
      } catch (secondError) {
        // If still failing, try to reconstruct a minimal valid response
        console.error('Second JSON parse error:', secondError.message);
        
        // For categorization endpoint, return a minimal valid response
        if (jsonString.includes('categorizedComments')) {
          return { categorizedComments: [] };
        }
        
        // For summarization endpoint
        if (jsonString.includes('summaries')) {
          return { summaries: [] };
        }
        
        // For the original endpoint
        return { categories: [] };
      }
    }
  } catch (error) {
    console.error('Error in parseClaudeResponse:', error);
    
    // Return a valid but empty response based on context clues in the error
    const errorMsg = error.message.toLowerCase();
    if (errorMsg.includes('categorized')) {
      return { categorizedComments: [] };
    } else if (errorMsg.includes('summar')) {
      return { summaries: [] };
    } else {
      return { categories: [] };
    }
  }
}

// After this point, keep all your existing code but replace the old parseClaudeResponse function with this one
