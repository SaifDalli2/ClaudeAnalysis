const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API proxy endpoint
app.post('/api/claude', async (req, res) => {
  try {
    // Get comments from request
    const { comments, apiKey } = req.body;
    
    // Call Claude API
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-3-sonnet-20240229',
      max_tokens: 4000,
      messages: [
        {
          role: 'user',
          content: `Please categorize each of the following comments into exactly one category based on its primary topic or sentiment. Each comment must be assigned to exactly one category.

Comments:
${comments.map((comment, index) => `${index+1}. ${comment}`).join('\n')}

For each category:
1. Provide a descriptive category name
2. List the comment numbers that belong to this category
3. Write a concise summary that captures the key points from all comments in this category
4. Analyze the sentiment of the comments in this category on a scale from -1 (very negative) to 1 (very positive)

Return the results in JSON format like this:
{
  "categories": [
    {
      "name": "Category Name",
      "comments": [1, 5, 9], 
      "summary": "Summary of comments in this category",
      "sentiment": 0.7
    },
    {
      "name": "Another Category",
      "comments": [2, 3, 6],
      "summary": "Summary of comments in this category",
      "sentiment": -0.4
    }
  ]
}

Each comment must appear in exactly one category. The comment numbers should correspond to the numbers I assigned above. The sentiment score should be a number between -1 and 1.`
        }
      ]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey || process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    });

    // Extract the response content
    const responseContent = response.data.content[0].text;
    
    // Try to extract JSON from the response
    const jsonMatch = responseContent.match(/```json([\s\S]*?)```/) || 
                      responseContent.match(/({[\s\S]*})/);
    
    let jsonData;
    if (jsonMatch && jsonMatch[1]) {
      jsonData = JSON.parse(jsonMatch[1].trim());
    } else {
      jsonData = JSON.parse(responseContent);
    }
    
    res.json(jsonData);
  } catch (error) {
    console.error('Error proxying to Claude API:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to process with Claude API',
      details: error.response?.data?.error || error.message
    });
  }
});

// Catch-all route - serve the main HTML file for any unknown routes
// This ensures that client-side routing works
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
