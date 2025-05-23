const express = require('express');
const router = express.Router();
const { getServerStatus, getSystemHealth } = require('../utils/monitoring');

// Simple ping endpoint
router.get('/ping', (req, res) => {
  console.log(`Received ping request from ${req.ip}`);
  
  if (req.query.wakeup === 'true') {
    console.log('Processing wake-up ping request...');
    
    setTimeout(() => {
      console.log('Server is now awake and ready to process requests');
      res.status(200).send('OK - Server Awake');
    }, 500);
  } else {
    res.status(200).send('OK');
  }
});

// Basic health check
router.get('/health', (req, res) => {
  const serverStatus = getServerStatus();
  const uptime = Math.floor((new Date() - serverStatus.startTime) / 1000);
  
  res.json({
    status: 'up',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    stats: {
      totalRequests: serverStatus.totalRequests,
      activeRequests: serverStatus.activeRequests,
      lastError: serverStatus.lastError
    },
    serverInfo: {
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage()
    }
  });
});

// Detailed system health check
router.get('/system/health', (req, res) => {
  const health = getSystemHealth();
  res.json(health);
});

module.exports = router;