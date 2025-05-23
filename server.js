const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import middleware
const { corsMiddleware, requestLogger, errorHandler } = require('./middleware');

// Import routes
const apiRoutes = require('./routes/api');
const healthRoutes = require('./routes/health');
const claudeRoutes = require('./routes/claude');

const app = express();
const PORT = process.env.PORT || 3000;

// Apply middleware
corsMiddleware(app);
requestLogger(app);

// Body parsing middleware with large limits for batch processing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api', apiRoutes);
app.use('/api', healthRoutes);
app.use('/api', claudeRoutes);

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Catch-all route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
errorHandler(app);

// Server monitoring
const { setupServerMonitoring } = require('./utils/monitoring');
setupServerMonitoring();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Server accessible at: http://localhost:${PORT}`);
});

module.exports = app;