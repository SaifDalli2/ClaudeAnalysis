# Comment Categorization System

A robust, scalable comment categorization system powered by Claude AI with real-time processing, comprehensive error handling, and monitoring capabilities.

## 🏗️ Architecture

The application has been restructured into a clean, modular architecture:

```
├── server.js                 # Main entry point
├── middleware/
│   └── index.js              # CORS, logging, error handling
├── routes/
│   ├── api.js                # Main API endpoints
│   ├── health.js             # Health check endpoints
│   └── claude.js             # Legacy Claude endpoint
├── services/
│   ├── categorization.js     # Core categorization logic
│   ├── summary.js            # Summarization services
│   └── claude-legacy.js      # Legacy processing
├── utils/
│   ├── helpers.js            # General utilities
│   ├── processing.js         # Response parsing utilities
│   ├── validation.js         # Input validation
│   └── monitoring.js         # Server monitoring
├── config/
│   └── constants.js          # Application constants
└── public/                   # Frontend files
```

## 🚀 Features

### Core Functionality
- **Async Processing**: Large comment batches processed asynchronously with job tracking
- **Real-time Updates**: Live progress updates and partial results display
- **Multi-language Support**: Arabic and English comment categorization
- **Batch Processing**: Intelligent batching with failure recovery
- **Categorization**: 14 predefined categories for systematic organization
- **Summarization**: AI-powered summaries with actionable insights

### Technical Features
- **Error Recovery**: Robust error handling with retry mechanisms
- **Rate Limiting**: Built-in protection against API abuse
- **Monitoring**: Comprehensive health monitoring and performance tracking
- **Validation**: Input sanitization and validation
- **Memory Management**: Memory usage monitoring with alerts
- **Scalable Architecture**: Modular design for easy maintenance

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd comment-categorization-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file:
   ```env
   PORT=3000
   NODE_ENV=production
   CLAUDE_API_KEY=your_claude_api_key_here
   ```

4. **Start the server**
   ```bash
   # Production
   npm start
   
   # Development with auto-reload
   npm run dev
   ```

## 🔧 API Endpoints

### Core Endpoints

#### Start Categorization Job
```http
POST /api/categorize
Content-Type: application/json

{
  "comments": ["comment1", "comment2", ...],
  "apiKey": "your_claude_api_key"
}
```

**Response:**
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "started",
  "totalComments": 100,
  "estimatedBatches": 4,
  "estimatedTimeMinutes": 6,
  "statusEndpoint": "/api/categorize/job_1234567890_abc123/status",
  "resultsEndpoint": "/api/categorize/job_1234567890_abc123/results"
}
```

#### Check Job Status
```http
GET /api/categorize/{jobId}/status
```

**Response:**
```json
{
  "jobId": "job_1234567890_abc123",
  "status": "processing",
  "progress": 75,
  "batchesCompleted": 3,
  "totalBatches": 4,
  "processedComments": 75,
  "totalComments": 100,
  "elapsedMinutes": 4.5,
  "categorizedComments": [...],
  "extractedTopics": [...]
}
```

#### Get Job Results
```http
GET /api/categorize/{jobId}/results
```

#### Cancel Job
```http
POST /api/categorize/{jobId}/cancel
```

#### Summarize Results
```http
POST /api/summarize
Content-Type: application/json

{
  "categorizedComments": [...],
  "extractedTopics": [...],
  "apiKey": "your_claude_api_key"
}
```

### Health Endpoints

#### Server Ping
```http
GET /api/ping
```

#### Health Check
```http
GET /api/health
```

#### System Health
```http
GET /api/system/health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "requests": {
    "total": 150,
    "active": 2,
    "successful": 145,
    "errors": 5,
    "successRate": 97
  },
  "memory": {
    "heapUsed": 85,
    "heapTotal": 128,
    "usagePercent": 66
  },
  "issues": []
}
```

### Test Endpoint

#### Test Categorization
```http
POST /api/test-categorize
Content-Type: application/json

{
  "apiKey": "your_claude_api_key"
}
```

## 🎯 Categories

The system categorizes comments into 14 predefined categories:

### Technical Issues
- App update
- App Freeze/Slow
- App issues
- Doesn't work
- Login and Access
- Security

### Customer Feedback
- Complicated
- Customer Service
- Design
- Offensive
- Thank you

### Monetary
- Fraud
- Pricing
- Refund Request

## 🌍 Language Support

- **Arabic**: Full support with proper category names in Arabic
- **English**: Complete English categorization
- **Auto-detection**: Automatic language detection based on comment content

## 📊 Monitoring

### Performance Metrics
- Request response times
- Memory usage tracking
- Error rate monitoring
- Slow request detection

### Health Monitoring
- Server uptime tracking
- Active request monitoring
- Memory usage alerts
- System status reporting

### Logging
- Request/response logging
- Error tracking with context
- Performance logging
- Health status logging

## 🔒 Security Features

- **Input Validation**: Comprehensive input sanitization
- **Rate Limiting**: Protection against API abuse
- **Error Handling**: Secure error responses
- **CORS Configuration**: Proper cross-origin setup
- **Request Size Limits**: Protection against large payloads

## 🛠️ Configuration

### Environment Variables
```env
PORT=3000                    # Server port
NODE_ENV=production         # Environment mode
CLAUDE_API_KEY=sk-...       # Claude API key (optional, can be provided per request)
```

### Application Constants
All configuration options are centralized in `config/constants.js`:

- API timeouts and retry settings
- Processing batch sizes
- Rate limiting configuration
- Memory monitoring thresholds
- Error message templates

## 🚀 Deployment

### Heroku Deployment
```bash
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Set environment variables
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Health check
npm run health-check
```

## 📈 Performance

### Optimizations
- Asynchronous processing for large datasets
- Intelligent batching with failure recovery
- Memory usage monitoring and cleanup
- Response caching for health endpoints
- Efficient JSON parsing with fallbacks

### Scalability
- Modular architecture for easy horizontal scaling
- Stateless design (jobs stored in memory, can be moved to Redis)
- Configurable batch sizes and timeouts
- Built-in monitoring for capacity planning

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the [API documentation](#-api-endpoints)
- Review [monitoring endpoints](#health-endpoints)
- Use the test endpoint to validate setup
- Check server logs for detailed error information

## 🔄 Migration from Original

The restructured version maintains full API compatibility while providing:
- Better code organization
- Enhanced error handling
- Comprehensive monitoring
- Improved scalability
- Better maintainability

All existing endpoints continue to work as expected.