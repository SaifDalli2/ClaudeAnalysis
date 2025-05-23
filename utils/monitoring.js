// Server status tracking
let serverStatus = {
  startTime: new Date(),
  totalRequests: 0,
  activeRequests: 0,
  lastError: null,
  errorCount: 0,
  successfulRequests: 0
};

/**
 * Setup server monitoring middleware and handlers
 */
function setupServerMonitoring() {
  // Track request statistics middleware
  function requestTracker(req, res, next) {
    serverStatus.totalRequests++;
    serverStatus.activeRequests++;
    
    const startTime = Date.now();
    
    // Track when the request finishes
    res.on('finish', () => {
      serverStatus.activeRequests--;
      const duration = Date.now() - startTime;
      
      if (res.statusCode >= 200 && res.statusCode < 400) {
        serverStatus.successfulRequests++;
      } else {
        serverStatus.errorCount++;
      }
      
      // Log slow requests
      if (duration > 30000) { // 30 seconds
        console.warn(`Slow request detected: ${req.method} ${req.url} took ${duration}ms`);
      }
    });
    
    next();
  }

  // Error tracking
  function trackError(error, context = 'unknown') {
    serverStatus.lastError = {
      time: new Date().toISOString(),
      message: error.message,
      context: context,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
    serverStatus.errorCount++;
    
    console.error(`[${context}] Error tracked:`, error.message);
  }

  // Periodic health logging
  function logHealthStatus() {
    const uptime = Math.floor((Date.now() - serverStatus.startTime) / 1000);
    const memory = process.memoryUsage();
    
    console.log(`Health Status - Uptime: ${uptime}s, Requests: ${serverStatus.totalRequests}, Active: ${serverStatus.activeRequests}, Memory: ${Math.round(memory.heapUsed / 1024 / 1024)}MB`);
  }

  // Log health status every 30 minutes
  setInterval(logHealthStatus, 1800000);

  return {
    requestTracker,
    trackError,
    logHealthStatus
  };
}

/**
 * Get current server status
 * @returns {Object} Server status object
 */
function getServerStatus() {
  return {
    ...serverStatus,
    uptime: Math.floor((Date.now() - serverStatus.startTime) / 1000),
    successRate: serverStatus.totalRequests > 0 
      ? Math.round((serverStatus.successfulRequests / serverStatus.totalRequests) * 100) 
      : 0
  };
}

/**
 * Get detailed system health information
 * @returns {Object} System health data
 */
function getSystemHealth() {
  const status = getServerStatus();
  const memory = process.memoryUsage();
  const cpu = process.cpuUsage();
  
  // Calculate memory usage percentages
  const memoryUsagePercent = {
    heapUsed: Math.round((memory.heapUsed / memory.heapTotal) * 100),
    external: Math.round((memory.external / 1024 / 1024) * 100) / 100 // MB
  };
  
  // Determine health status
  let healthStatus = 'healthy';
  const issues = [];
  
  if (status.activeRequests > 50) {
    issues.push('High active request count');
    healthStatus = 'warning';
  }
  
  if (memoryUsagePercent.heapUsed > 90) {
    issues.push('High memory usage');
    healthStatus = 'warning';
  }
  
  if (status.errorCount > status.successfulRequests * 0.1) {
    issues.push('High error rate');
    healthStatus = 'critical';
  }
  
  if (status.uptime < 60) {
    healthStatus = 'starting';
  }

  return {
    status: healthStatus,
    timestamp: new Date().toISOString(),
    uptime: status.uptime,
    issues: issues,
    requests: {
      total: status.totalRequests,
      active: status.activeRequests,
      successful: status.successfulRequests,
      errors: status.errorCount,
      successRate: status.successRate
    },
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
      external: Math.round(memory.external / 1024 / 1024), // MB
      rss: Math.round(memory.rss / 1024 / 1024), // MB
      usagePercent: memoryUsagePercent.heapUsed
    },
    cpu: {
      user: cpu.user,
      system: cpu.system
    },
    nodejs: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    lastError: status.lastError
  };
}

/**
 * Reset server statistics (useful for testing)
 */
function resetServerStatus() {
  serverStatus = {
    startTime: new Date(),
    totalRequests: 0,
    activeRequests: 0,
    lastError: null,
    errorCount: 0,
    successfulRequests: 0
  };
  
  console.log('Server status statistics reset');
}

/**
 * Log system metrics for debugging
 */
function logSystemMetrics() {
  const health = getSystemHealth();
  
  console.log('=== System Metrics ===');
  console.log(`Status: ${health.status}`);
  console.log(`Uptime: ${health.uptime} seconds`);
  console.log(`Requests: ${health.requests.total} (${health.requests.successRate}% success rate)`);
  console.log(`Memory: ${health.memory.heapUsed}MB / ${health.memory.heapTotal}MB (${health.memory.usagePercent}%)`);
  console.log(`Active Requests: ${health.requests.active}`);
  
  if (health.issues.length > 0) {
    console.log(`Issues: ${health.issues.join(', ')}`);
  }
  
  if (health.lastError) {
    console.log(`Last Error: ${health.lastError.message} (${health.lastError.time})`);
  }
  
  console.log('=====================');
}

/**
 * Create a performance monitoring middleware
 */
function createPerformanceMonitor() {
  const performanceData = {
    slowRequests: [],
    requestTimes: [],
    maxSlowRequests: 100
  };

  return function performanceMiddleware(req, res, next) {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const endMemory = process.memoryUsage().heapUsed;
      const memoryDelta = endMemory - startMemory;

      // Track request timing
      performanceData.requestTimes.push(duration);
      if (performanceData.requestTimes.length > 1000) {
        performanceData.requestTimes = performanceData.requestTimes.slice(-500);
      }

      // Track slow requests (>5 seconds)
      if (duration > 5000) {
        const slowRequest = {
          timestamp: new Date().toISOString(),
          method: req.method,
          url: req.url,
          duration: duration,
          statusCode: res.statusCode,
          memoryDelta: Math.round(memoryDelta / 1024 / 1024), // MB
          userAgent: req.get('User-Agent') || 'Unknown'
        };

        performanceData.slowRequests.push(slowRequest);
        
        // Keep only the most recent slow requests
        if (performanceData.slowRequests.length > performanceData.maxSlowRequests) {
          performanceData.slowRequests = performanceData.slowRequests.slice(-performanceData.maxSlowRequests);
        }

        console.warn(`Slow request detected: ${req.method} ${req.url} - ${duration}ms`);
      }
    });

    next();
  };
}

/**
 * Get performance statistics
 */
function getPerformanceStats() {
  return {
    slowRequestCount: performanceData.slowRequests.length,
    recentSlowRequests: performanceData.slowRequests.slice(-10),
    averageResponseTime: performanceData.requestTimes.length > 0
      ? Math.round(performanceData.requestTimes.reduce((a, b) => a + b, 0) / performanceData.requestTimes.length)
      : 0,
    maxResponseTime: performanceData.requestTimes.length > 0
      ? Math.max(...performanceData.requestTimes)
      : 0,
    minResponseTime: performanceData.requestTimes.length > 0
      ? Math.min(...performanceData.requestTimes)
      : 0
  };
}

/**
 * Memory usage alert system
 */
function setupMemoryMonitoring() {
  const memoryThresholds = {
    warning: 80, // 80% heap usage
    critical: 95 // 95% heap usage
  };

  let lastAlert = 0;
  const alertCooldown = 300000; // 5 minutes

  function checkMemoryUsage() {
    const memory = process.memoryUsage();
    const heapUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    const now = Date.now();

    if (heapUsagePercent > memoryThresholds.critical && now - lastAlert > alertCooldown) {
      console.error(`CRITICAL: Memory usage at ${heapUsagePercent.toFixed(1)}% (${Math.round(memory.heapUsed / 1024 / 1024)}MB)`);
      lastAlert = now;
      
      // Force garbage collection if available
      if (global.gc) {
        console.log('Forcing garbage collection...');
        global.gc();
      }
    } else if (heapUsagePercent > memoryThresholds.warning && now - lastAlert > alertCooldown) {
      console.warn(`WARNING: Memory usage at ${heapUsagePercent.toFixed(1)}% (${Math.round(memory.heapUsed / 1024 / 1024)}MB)`);
      lastAlert = now;
    }
  }

  // Check memory every 30 seconds
  setInterval(checkMemoryUsage, 30000);

  return {
    checkMemoryUsage,
    setThresholds: (warning, critical) => {
      memoryThresholds.warning = warning;
      memoryThresholds.critical = critical;
    }
  };
}

/**
 * Create health check middleware
 */
function createHealthMiddleware() {
  return function healthMiddleware(req, res, next) {
    // Add health indicators to response headers
    const health = getSystemHealth();
    
    res.set({
      'X-Server-Status': health.status,
      'X-Server-Uptime': health.uptime.toString(),
      'X-Active-Requests': health.requests.active.toString(),
      'X-Memory-Usage': `${health.memory.usagePercent}%`
    });

    next();
  };
}

/**
 * Export monitoring data for external systems
 */
function exportMetrics() {
  const health = getSystemHealth();
  const performance = getPerformanceStats();
  
  return {
    timestamp: new Date().toISOString(),
    server: {
      status: health.status,
      uptime: health.uptime,
      version: process.version,
      platform: process.platform
    },
    requests: health.requests,
    memory: health.memory,
    cpu: health.cpu,
    performance: performance,
    issues: health.issues
  };
}

module.exports = {
  setupServerMonitoring,
  getServerStatus,
  getSystemHealth,
  resetServerStatus,
  logSystemMetrics,
  createPerformanceMonitor,
  getPerformanceStats,
  setupMemoryMonitoring,
  createHealthMiddleware,
  exportMetrics
};