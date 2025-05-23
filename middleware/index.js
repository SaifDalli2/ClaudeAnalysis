const cors = require('cors');

// CORS configuration
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
  credentials: true,
  maxAge: 86400,
  optionsSuccessStatus: 200
};

function corsMiddleware(app) {
  app.use(cors(corsOptions));
  app.options('*', cors());
  
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-api-key');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    next();
  });
}

function requestLogger(app) {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} (From: ${req.ip})`);
    next();
  });
}

function errorHandler(app) {
  app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    
    // Handle specific error types
    if (err.name === 'TimeoutError') {
      return res.status(408).json({
        error: 'Request Timeout',
        details: 'The request took too long to process. Please try again with fewer comments.',
        suggestion: 'Try with smaller batch sizes or check your API key.'
      });
    }
    
    if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED') {
      return res.status(503).json({
        error: 'Connection Error',
        details: 'The connection to the server was interrupted. Please try again later.',
        suggestion: 'Check your internet connection and try again in a few minutes.'
      });
    }
    
    // Rate limiting errors
    if (err.response && err.response.status === 429) {
      const retryAfter = err.response.headers['retry-after'] || 60;
      return res.status(429).json({
        error: 'Rate Limited',
        details: `API rate limit exceeded. Please wait ${retryAfter} seconds before retrying.`,
        retryAfter: retryAfter
      });
    }
    
    // API key errors
    if (err.response && err.response.status === 401) {
      return res.status(401).json({
        error: 'Authentication Error',
        details: 'Invalid or missing API key. Please check your Claude API key.',
        suggestion: 'Verify your API key is correct and has sufficient credits.'
      });
    }
    
    // Connection errors
    if (err.code === 'ECONNRESET' || err.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: 'Connection Error',
        details: 'Unable to connect to the Claude API. Please try again later.',
        suggestion: 'Check your internet connection and try again in a few minutes.'
      });
    }
    
    // Default error response
    res.status(500).json({
      error: 'Internal Server Error',
      details: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message,
      suggestion: 'Please try again or contact support if the issue persists.'
    });
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    
    if (err.message.includes('FATAL') || err.code === 'EADDRINUSE') {
      console.error('Fatal error, shutting down server.');
      process.exit(1);
    }
  });
}

module.exports = {
  corsMiddleware,
  requestLogger,
  errorHandler
};