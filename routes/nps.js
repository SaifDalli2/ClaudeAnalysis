// routes/nps.js
const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');
const { 
  validateNPSData, 
  processNPSBatch,
  calculateNPSMetrics 
} = require('../services/nps-processor');
const { query } = require('../utils/database');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

/**
 * Upload and process NPS data
 */
router.post('/upload', authenticateToken, upload.single('npsFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a CSV file to upload'
      });
    }

    const { columnMapping, industry } = req.body;
    const userId = req.user.id;
    
    console.log(`📊 Processing NPS upload for user ${userId}`);

    // Create upload record
    const uploadResult = await query(
      `INSERT INTO nps_uploads (user_id, filename, industry, metadata, status) 
       VALUES ($1, $2, $3, $4, 'processing') 
       RETURNING id`,
      [userId, req.file.originalname, industry, JSON.stringify({ columnMapping })]
    );
    
    const uploadId = uploadResult.rows[0].id;

    // Parse CSV data
    const csvData = await parseCSVFile(req.file.buffer);
    
    // Validate data format
    const validation = validateNPSData(csvData, JSON.parse(columnMapping));
    
    if (!validation.isValid) {
      await query(
        'UPDATE nps_uploads SET status = $1, metadata = $2 WHERE id = $3',
        ['failed', JSON.stringify({ error: validation.errors }), uploadId]
      );
      
      return res.status(400).json({
        error: 'Data validation failed',
        details: validation.errors
      });
    }

    // Process data in background
    processNPSDataAsync(uploadId, csvData, JSON.parse(columnMapping), userId);

    res.json({
      uploadId: uploadId,
      status: 'processing',
      totalRows: csvData.length,
      message: 'Upload started successfully',
      statusEndpoint: `/api/nps/upload/${uploadId}/status`
    });

  } catch (error) {
    console.error('NPS upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

/**
 * Get upload status
 */
router.get('/upload/:uploadId/status', authenticateToken, async (req, res) => {
  try {
    const { uploadId } = req.params;
    const userId = req.user.id;

    const result = await query(
      'SELECT * FROM nps_uploads WHERE id = $1 AND user_id = $2',
      [uploadId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Upload not found'
      });
    }

    const upload = result.rows[0];
    
    res.json({
      uploadId: upload.id,
      status: upload.status,
      totalRows: upload.total_rows,
      processedRows: upload.processed_rows,
      failedRows: upload.failed_rows,
      progress: upload.total_rows > 0 ? Math.round((upload.processed_rows / upload.total_rows) * 100) : 0,
      createdAt: upload.created_at
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    });
  }
});

/**
 * Get NPS dashboard data
 */
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, industry } = req.query;

    // Check cache first
    const cacheKey = `dashboard_${startDate || 'all'}_${endDate || 'all'}_${industry || 'all'}`;
    const cachedResult = await query(
      'SELECT cache_data FROM nps_analytics_cache WHERE user_id = $1 AND cache_key = $2 AND expires_at > NOW()',
      [userId, cacheKey]
    );

    if (cachedResult.rows.length > 0) {
      return res.json(cachedResult.rows[0].cache_data);
    }

    // Calculate fresh metrics
    const metrics = await calculateNPSMetrics(userId, { startDate, endDate, industry });

    // Cache results for 1 hour
    await query(
      `INSERT INTO nps_analytics_cache (user_id, cache_key, cache_data, industry, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '1 hour')
       ON CONFLICT (user_id, cache_key) DO UPDATE SET
       cache_data = $3, expires_at = NOW() + INTERVAL '1 hour'`,
      [userId, cacheKey, JSON.stringify(metrics), industry]
    );

    res.json(metrics);

  } catch (error) {
    console.error('Dashboard data error:', error);
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error.message
    });
  }
});

/**
 * Get NPS trends over time
 */
router.get('/trends', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'monthly', startDate, endDate } = req.query;

    let dateFormat, dateInterval;
    switch (period) {
      case 'daily':
        dateFormat = 'YYYY-MM-DD';
        dateInterval = '1 day';
        break;
      case 'weekly':
        dateFormat = 'YYYY-"W"WW';
        dateInterval = '1 week';
        break;
      case 'monthly':
      default:
        dateFormat = 'YYYY-MM';
        dateInterval = '1 month';
    }

    const trendsQuery = `
      SELECT 
        TO_CHAR(survey_date, $3) as period,
        COUNT(*) as total_responses,
        AVG(nps_score) as avg_score,
        COUNT(CASE WHEN nps_score >= 9 THEN 1 END) as promoters,
        COUNT(CASE WHEN nps_score >= 7 AND nps_score <= 8 THEN 1 END) as passives,
        COUNT(CASE WHEN nps_score <= 6 THEN 1 END) as detractors,
        (COUNT(CASE WHEN nps_score >= 9 THEN 1 END) * 100.0 / COUNT(*)) - 
        (COUNT(CASE WHEN nps_score <= 6 THEN 1 END) * 100.0 / COUNT(*)) as nps_score
      FROM nps_responses 
      WHERE user_id = $1 
        AND ($4::date IS NULL OR survey_date >= $4::date)
        AND ($5::date IS NULL OR survey_date <= $5::date)
      GROUP BY TO_CHAR(survey_date, $3)
      ORDER BY period
    `;

    const result = await query(trendsQuery, [userId, userId, dateFormat, startDate, endDate]);

    res.json({
      period: period,
      trends: result.rows.map(row => ({
        period: row.period,
        totalResponses: parseInt(row.total_responses),
        avgScore: parseFloat(row.avg_score),
        promoters: parseInt(row.promoters),
        passives: parseInt(row.passives),
        detractors: parseInt(row.detractors),
        npsScore: Math.round(parseFloat(row.nps_score))
      }))
    });

  } catch (error) {
    console.error('Trends data error:', error);
    res.status(500).json({
      error: 'Failed to get trends data',
      message: error.message
    });
  }
});

/**
 * Get customer journey analysis
 */
router.get('/customer-journey', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const journeyResult = await query(`
      SELECT 
        segment,
        COUNT(*) as customer_count,
        AVG(average_nps) as avg_nps,
        COUNT(CASE WHEN trend = 'improving' THEN 1 END) as improving,
        COUNT(CASE WHEN trend = 'declining' THEN 1 END) as declining,
        COUNT(CASE WHEN trend = 'stable' THEN 1 END) as stable
      FROM customer_journey 
      WHERE user_id = $1
      GROUP BY segment
    `, [userId]);

    const newCustomersResult = await query(`
      SELECT COUNT(*) as new_customers
      FROM customer_journey 
      WHERE user_id = $1 AND total_surveys = 1
    `, [userId]);

    res.json({
      segmentDistribution: journeyResult.rows,
      newCustomers: parseInt(newCustomersResult.rows[0].new_customers),
      totalCustomers: journeyResult.rows.reduce((sum, row) => sum + parseInt(row.customer_count), 0)
    });

  } catch (error) {
    console.error('Customer journey error:', error);
    res.status(500).json({
      error: 'Failed to get customer journey data',
      message: error.message
    });
  }
});

// Helper function to parse CSV file
async function parseCSVFile(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const readable = Readable.from(buffer);
    
    readable
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

// Background processing function
async function processNPSDataAsync(uploadId, csvData, columnMapping, userId) {
  try {
    console.log(`📊 Starting background processing for upload ${uploadId}`);
    
    // Update total rows
    await query(
      'UPDATE nps_uploads SET total_rows = $1 WHERE id = $2',
      [csvData.length, uploadId]
    );

    let processedCount = 0;
    let failedCount = 0;

    // Process in batches
    const batchSize = 100;
    for (let i = 0; i < csvData.length; i += batchSize) {
      const batch = csvData.slice(i, i + batchSize);
      
      try {
        const result = await processNPSBatch(batch, columnMapping, userId, uploadId);
        processedCount += result.processed;
        failedCount += result.failed;

        // Update progress
        await query(
          'UPDATE nps_uploads SET processed_rows = $1, failed_rows = $2 WHERE id = $3',
          [processedCount, failedCount, uploadId]
        );

        console.log(`📊 Processed batch ${Math.floor(i/batchSize) + 1}, total: ${processedCount}/${csvData.length}`);
        
      } catch (batchError) {
        console.error(`Batch processing error:`, batchError);
        failedCount += batch.length;
      }
    }

    // Mark as completed
    await query(
      'UPDATE nps_uploads SET status = $1 WHERE id = $2',
      ['completed', uploadId]
    );

    // Invalidate analytics cache
    await query(
      'DELETE FROM nps_analytics_cache WHERE user_id = $1',
      [userId]
    );

    console.log(`✅ Upload ${uploadId} completed: ${processedCount} processed, ${failedCount} failed`);

  } catch (error) {
    console.error(`❌ Upload ${uploadId} failed:`, error);
    
    await query(
      'UPDATE nps_uploads SET status = $1, metadata = $2 WHERE id = $3',
      ['failed', JSON.stringify({ error: error.message }), uploadId]
    );
  }
}

module.exports = router;