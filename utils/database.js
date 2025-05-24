const { Client, Pool } = require('pg');

// Create a connection pool for better performance
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * Execute a query using the connection pool
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Object} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Object} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;
  
  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    console.error('A client has been checked out for more than 5 seconds!');
    console.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);
  
  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };
  
  client.release = () => {
    // Clear the timeout
    clearTimeout(timeout);
    // Set the methods back to their original forms before replaying
    client.query = query;
    client.release = release;
    return release.apply(client);
  };
  
  return client;
}

/**
 * Close all database connections
 */
async function end() {
  await pool.end();
}

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const client = await getClient();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// User-related database functions

/**
 * Create a new user
 * @param {Object} userData - User data
 * @returns {Object} Created user
 */
async function createUser({ email, passwordHash, firstName, lastName, company, industry }) {
  const result = await query(
    `INSERT INTO users (email, password_hash, first_name, last_name, company, industry)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, email, first_name, last_name, company, industry, created_at`,
    [email, passwordHash, firstName, lastName, company, industry]
  );
  return result.rows[0];
}

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Object|null} User object or null
 */
async function findUserByEmail(email) {
  const result = await query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email]
  );
  return result.rows[0] || null;
}

/**
 * Find user by ID
 * @param {number} userId - User ID
 * @returns {Object|null} User object or null
 */
async function findUserById(userId) {
  const result = await query(
    'SELECT id, email, first_name, last_name, company, industry, created_at FROM users WHERE id = $1 AND is_active = true',
    [userId]
  );
  return result.rows[0] || null;
}

/**
 * Update user profile
 * @param {number} userId - User ID
 * @param {Object} updateData - Data to update
 * @returns {Object} Updated user
 */
async function updateUser(userId, updateData) {
  const { firstName, lastName, company, industry } = updateData;
  const result = await query(
    `UPDATE users 
     SET first_name = $1, last_name = $2, company = $3, industry = $4, updated_at = NOW()
     WHERE id = $5
     RETURNING id, email, first_name, last_name, company, industry, updated_at`,
    [firstName, lastName, company, industry, userId]
  );
  return result.rows[0];
}

/**
 * Create user session
 * @param {number} userId - User ID
 * @param {string} sessionToken - Session token
 * @param {Date} expiresAt - Expiration date
 * @returns {Object} Session object
 */
async function createSession(userId, sessionToken, expiresAt) {
  const result = await query(
    'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES ($1, $2, $3) RETURNING *',
    [userId, sessionToken, expiresAt]
  );
  return result.rows[0];
}

/**
 * Find session by token
 * @param {string} sessionToken - Session token
 * @returns {Object|null} Session object or null
 */
async function findSessionByToken(sessionToken) {
  const result = await query(
    `SELECT s.*, u.id as user_id, u.email, u.first_name, u.last_name, u.company, u.industry
     FROM user_sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.session_token = $1 AND s.expires_at > NOW() AND u.is_active = true`,
    [sessionToken]
  );
  return result.rows[0] || null;
}

/**
 * Delete session
 * @param {string} sessionToken - Session token
 */
async function deleteSession(sessionToken) {
  await query('DELETE FROM user_sessions WHERE session_token = $1', [sessionToken]);
}

/**
 * Delete expired sessions
 */
async function cleanupExpiredSessions() {
  const result = await query('DELETE FROM user_sessions WHERE expires_at < NOW()');
  console.log(`Cleaned up ${result.rowCount} expired sessions`);
}

/**
 * Get industry configuration
 * @param {string} industryName - Industry name
 * @returns {Object|null} Industry config or null
 */
async function getIndustryConfig(industryName) {
  const result = await query(
    'SELECT * FROM industry_configs WHERE industry_name = $1',
    [industryName]
  );
  return result.rows[0] || null;
}

/**
 * Get all industry configurations
 * @returns {Array} Array of industry configs
 */
async function getAllIndustryConfigs() {
  const result = await query('SELECT * FROM industry_configs ORDER BY industry_name');
  return result.rows;
}

module.exports = {
  query,
  getClient,
  end,
  testConnection,
  createUser,
  findUserByEmail,
  findUserById,
  updateUser,
  createSession,
  findSessionByToken,
  deleteSession,
  cleanupExpiredSessions,
  getIndustryConfig,
  getAllIndustryConfigs
};