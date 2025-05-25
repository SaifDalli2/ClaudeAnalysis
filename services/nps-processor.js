// services/nps-processor.js
const { query } = require('../utils/database');

/**
 * Validate NPS data format and structure
 */
function validateNPSData(csvData, columnMapping) {
  const errors = [];
  const warnings = [];

  if (!csvData || csvData.length === 0) {
    errors.push('CSV file is empty');
    return { isValid: false, errors, warnings };
  }

  // Check required columns are mapped
  const requiredFields = ['customer_id', 'nps_score', 'survey_date'];
  for (const field of requiredFields) {
    if (!columnMapping[field] && columnMapping[field] !== 0) {
      errors.push(`Required field '${field}' is not mapped`);
    }
  }

  // Validate data rows
  let validRows = 0;
  let invalidNPSScores = 0;
  let invalidDates = 0;
  let missingCustomerIds = 0;

  csvData.forEach((row, index) => {
    const rowNumber = index + 1;
    let rowValid = true;

    // Check customer ID
    const customerId = getFieldValue(row, columnMapping.customer_id);
    if (!customerId || customerId.trim() === '') {
      missingCustomerIds++;
      rowValid = false;
    }

    // Check NPS score
    const npsScore = getFieldValue(row, columnMapping.nps_score);
    const npsNum = parseInt(npsScore);
    if (isNaN(npsNum) || npsNum < 0 || npsNum > 10) {
      invalidNPSScores++;
      rowValid = false;
    }

    // Check date
    const surveyDate = getFieldValue(row, columnMapping.survey_date);
    if (!isValidDate(surveyDate)) {
      invalidDates++;
      rowValid = false;
    }

    if (rowValid) validRows++;
  });

  // Add warnings for data quality issues
  if (invalidNPSScores > 0) {
    warnings.push(`${invalidNPSScores} rows have invalid NPS scores (must be 0-10)`);
  }
  if (invalidDates > 0) {
    warnings.push(`${invalidDates} rows have invalid date formats`);
  }
  if (missingCustomerIds > 0) {
    warnings.push(`${missingCustomerIds} rows have missing customer IDs`);
  }

  // Fail if too many invalid rows
  const invalidRowsPercent = ((csvData.length - validRows) / csvData.length) * 100;
  if (invalidRowsPercent > 50) {
    errors.push(`Too many invalid rows (${invalidRowsPercent.toFixed(1)}%). Please check your data format.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    totalRows: csvData.length,
    validRows,
    invalidRows: csvData.length - validRows
  };
}

/**
 * Process a batch of NPS data
 */
async function processNPSBatch(batch, columnMapping, userId, uploadId) {
  let processed = 0;
  let failed = 0;

  for (const row of batch) {
    try {
      // Extract and validate row data
      const customerId = getFieldValue(row, columnMapping.customer_id);
      const npsScore = parseInt(getFieldValue(row, columnMapping.nps_score));
      const surveyDate = parseDate(getFieldValue(row, columnMapping.survey_date));
      const comments = getFieldValue(row, columnMapping.comments) || null;

      // Skip invalid rows
      if (!customerId || isNaN(npsScore) || !surveyDate) {
        failed++;
        continue;
      }

      // Insert NPS response
      const responseResult = await query(`
        INSERT INTO nps_responses 
        (upload_id, user_id, customer_external_id, nps_score, survey_date, comments, sentiment_score, sentiment_label)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (user_id, customer_external_id, survey_date) 
        DO UPDATE SET nps_score = $4, comments = $6, updated_at = NOW()
        RETURNING id
      `, [
        uploadId, 
        userId, 
        customerId, 
        npsScore, 
        surveyDate, 
        comments,
        calculateSentiment(npsScore),
        getSentimentLabel(npsScore)
      ]);

      const responseId = responseResult.rows[0].id;

      // Process factor ratings
      await processFactorRatings(row, columnMapping, responseId);

      // Update customer journey
      await updateCustomerJourney(userId, customerId, npsScore, surveyDate);

      processed++;

    } catch (error) {
      console.error('Error processing row:', error);
      failed++;
    }
  }

  return { processed, failed };
}

/**
 * Process factor ratings for a response
 */
async function processFactorRatings(row, columnMapping, responseId) {
  const factorColumns = Object.keys(columnMapping).filter(key => 
    !['customer_id', 'nps_score', 'survey_date', 'comments'].includes(key)
  );

  for (const factorKey of factorColumns) {
    const factorValue = getFieldValue(row, columnMapping[factorKey]);
    const factorRating = parseInt(factorValue);

    if (!isNaN(factorRating) && factorRating >= 0 && factorRating <= 10) {
      await query(`
        INSERT INTO nps_factor_ratings (nps_response_id, factor_name, rating)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `, [responseId, factorKey, factorRating]);
    }
  }
}

/**
 * Update customer journey tracking
 */
async function updateCustomerJourney(userId, customerId, npsScore, surveyDate) {
  // Check if customer exists
  const existingResult = await query(
    'SELECT * FROM customer_journey WHERE user_id = $1 AND customer_external_id = $2',
    [userId, customerId]
  );

  if (existingResult.rows.length === 0) {
    // New customer
    await query(`
      INSERT INTO customer_journey 
      (user_id, customer_external_id, first_survey_date, latest_survey_date, 
       first_nps_score, latest_nps_score, total_surveys, average_nps, segment)
      VALUES ($1, $2, $3, $3, $4, $4, 1, $4, $5)
    `, [userId, customerId, surveyDate, npsScore, getNPSSegment(npsScore)]);
  } else {
    // Existing customer - update journey
    const customer = existingResult.rows[0];
    const newTotalSurveys = customer.total_surveys + 1;
    const newAverageNPS = ((customer.average_nps * customer.total_surveys) + npsScore) / newTotalSurveys;
    const trend = calculateTrend(customer.latest_nps_score, npsScore);

    await query(`
      UPDATE customer_journey SET
        latest_survey_date = $3,
        latest_nps_score = $4,
        total_surveys = $5,
        average_nps = $6,
        trend = $7,
        segment = $8,
        updated_at = NOW()
      WHERE user_id = $1 AND customer_external_id = $2
    `, [
      userId, 
      customerId, 
      surveyDate, 
      npsScore, 
      newTotalSurveys, 
      newAverageNPS, 
      trend,
      getNPSSegment(npsScore)
    ]);
  }
}

/**
 * Calculate comprehensive NPS metrics for dashboard
 */
async function calculateNPSMetrics(userId, options = {}) {
  const { startDate, endDate, industry } = options;

  // Base query conditions
  let whereConditions = 'WHERE user_id = $1';
  let queryParams = [userId];
  let paramIndex = 2;

  if (startDate) {
    whereConditions += ` AND survey_date >= $${paramIndex}`;
    queryParams.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    whereConditions += ` AND survey_date <= $${paramIndex}`;
    queryParams.push(endDate);
    paramIndex++;
  }

  // Overall NPS metrics
  const overallResult = await query(`
    SELECT 
      COUNT(*) as total_responses,
      AVG(nps_score) as avg_score,
      COUNT(CASE WHEN nps_score >= 9 THEN 1 END) as promoters,
      COUNT(CASE WHEN nps_score >= 7 AND nps_score <= 8 THEN 1 END) as passives,
      COUNT(CASE WHEN nps_score <= 6 THEN 1 END) as detractors,
      (COUNT(CASE WHEN nps_score >= 9 THEN 1 END) * 100.0 / COUNT(*)) - 
      (COUNT(CASE WHEN nps_score <= 6 THEN 1 END) * 100.0 / COUNT(*)) as nps_score
    FROM nps_responses ${whereConditions}
  `, queryParams);

  const overall = overallResult.rows[0];

  // Category analysis (simulated based on comments sentiment)
  const categoryResult = await query(`
    SELECT 
      sentiment_label,
      COUNT(*) as count,
      AVG(nps_score) as avg_score
    FROM nps_responses ${whereConditions}
    GROUP BY sentiment_label
    ORDER BY count DESC
  `, queryParams);

  // Factor analysis
  const factorResult = await query(`
    SELECT 
      f.factor_name,
      COUNT(*) as response_count,
      AVG(f.rating) as avg_rating,
      AVG(r.nps_score) as avg_nps_for_factor
    FROM nps_factor_ratings f
    JOIN nps_responses r ON f.nps_response_id = r.id
    ${whereConditions.replace('user_id', 'r.user_id')}
    GROUP BY f.factor_name
    ORDER BY avg_rating DESC
  `, queryParams);

  // Recent trends (last 6 months)
  const trendsResult = await query(`
    SELECT 
      TO_CHAR(survey_date, 'YYYY-MM') as month,
      COUNT(*) as responses,
      AVG(nps_score) as avg_score,
      (COUNT(CASE WHEN nps_score >= 9 THEN 1 END) * 100.0 / COUNT(*)) - 
      (COUNT(CASE WHEN nps_score <= 6 THEN 1 END) * 100.0 / COUNT(*)) as nps_score
    FROM nps_responses 
    ${whereConditions} AND survey_date >= NOW() - INTERVAL '6 months'
    GROUP BY TO_CHAR(survey_date, 'YYYY-MM')
    ORDER BY month
  `, queryParams);

  return {
    overall: {
      npsScore: Math.round(parseFloat(overall.nps_score) || 0),
      totalResponses: parseInt(overall.total_responses),
      promoters: parseInt(overall.promoters),
      passives: parseInt(overall.passives),
      detractors: parseInt(overall.detractors),
      avgScore: parseFloat(overall.avg_score || 0).toFixed(1)
    },
    categories: categoryResult.rows.map(row => ({
      name: row.sentiment_label || 'Unknown',
      count: parseInt(row.count),
      avgScore: parseFloat(row.avg_score).toFixed(1),
      sentiment: getSentimentScore(row.sentiment_label)
    })),
    factors: factorResult.rows.map(row => ({
      name: formatFactorName(row.factor_name),
      responseCount: parseInt(row.response_count),
      avgRating: parseFloat(row.avg_rating).toFixed(1),
      avgNPS: parseFloat(row.avg_nps_for_factor).toFixed(1),
      score: calculateFactorScore(row.avg_rating, row.avg_nps_for_factor)
    })),
    trends: trendsResult.rows.map(row => ({
      period: row.month,
      responses: parseInt(row.responses),
      avgScore: parseFloat(row.avg_score).toFixed(1),
      npsScore: Math.round(parseFloat(row.nps_score))
    })),
    lastUpdated: new Date().toISOString()
  };
}

// Helper functions
function getFieldValue(row, columnIndex) {
  if (columnIndex === undefined || columnIndex === null) return null;
  const keys = Object.keys(row);
  return row[keys[columnIndex]] || null;
}

function isValidDate(dateString) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

function parseDate(dateString) {
  if (!dateString) return null;
  
  // Try different date formats
  const formats = [
    /^\d{4}-\d{2}-\d{2}$/,     // YYYY-MM-DD
    /^\d{2}\/\d{2}\/\d{4}$/,   // MM/DD/YYYY
    /^\d{2}-\d{2}-\d{4}$/,     // MM-DD-YYYY
  ];
  
  let parsedDate;
  
  if (formats[0].test(dateString)) {
    parsedDate = new Date(dateString);
  } else if (formats[1].test(dateString)) {
    const [month, day, year] = dateString.split('/');
    parsedDate = new Date(year, month - 1, day);
  } else if (formats[2].test(dateString)) {
    const [month, day, year] = dateString.split('-');
    parsedDate = new Date(year, month - 1, day);
  } else {
    parsedDate = new Date(dateString);
  }
  
  return isNaN(parsedDate) ? null : parsedDate.toISOString().split('T')[0];
}

function calculateSentiment(npsScore) {
  // Convert NPS score to sentiment score (-1 to 1)
  return ((npsScore - 5) / 5).toFixed(2);
}

function getSentimentLabel(npsScore) {
  if (npsScore >= 9) return 'positive';
  if (npsScore >= 7) return 'neutral';
  return 'negative';
}

function getNPSSegment(npsScore) {
  if (npsScore >= 9) return 'promoter';
  if (npsScore >= 7) return 'passive';
  return 'detractor';
}

function calculateTrend(previousScore, currentScore) {
  const diff = currentScore - previousScore;
  if (diff > 1) return 'improving';
  if (diff < -1) return 'declining';
  return 'stable';
}

function getSentimentScore(sentimentLabel) {
  switch (sentimentLabel) {
    case 'positive': return 0.7;
    case 'neutral': return 0.0;
    case 'negative': return -0.7;
    default: return 0.0;
  }
}

function formatFactorName(factorName) {
  return factorName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function calculateFactorScore(avgRating, avgNPS) {
  // Convert factor rating and NPS correlation to a score
  const ratingScore = (avgRating / 10) * 100;
  const npsBonus = avgNPS > 0 ? 10 : 0;
  return Math.round(ratingScore + npsBonus);
}

module.exports = {
  validateNPSData,
  processNPSBatch,
  calculateNPSMetrics
};