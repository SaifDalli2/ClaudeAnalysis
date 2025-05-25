const { Client } = require('pg');
require('dotenv').config();

// Heroku provides DATABASE_URL, so we use that if available
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  } else {
    return {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }
};

async function setupDatabase() {
  const client = new Client(getDatabaseConfig());

  try {
    await client.connect();
    console.log('✅ Connected to Heroku Postgres database');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        company VARCHAR(255),
        industry VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        email_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);
    console.log('✅ Users table created');

    // Create user sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ User sessions table created');

    // Create industry configurations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS industry_configs (
        id SERIAL PRIMARY KEY,
        industry_name VARCHAR(100) UNIQUE NOT NULL,
        categories JSON NOT NULL,
        nps_factors JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Industry configs table created');

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_external_id VARCHAR(255) NOT NULL,
        first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        customer_segment VARCHAR(100),
        metadata JSON,
        UNIQUE(user_id, customer_external_id)
      );
    `);
    console.log('✅ Customers table created');

    // Create NPS surveys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nps_surveys (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
        customer_external_id VARCHAR(255) NOT NULL,
        nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
        survey_date TIMESTAMP NOT NULL,
        survey_source VARCHAR(100),
        factors JSON,
        comment TEXT,
        sentiment_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ NPS surveys table created');

    // Create comment categories table
    await client.query(`
      CREATE TABLE IF NOT EXISTS comment_categories (
        id SERIAL PRIMARY KEY,
        nps_survey_id INTEGER REFERENCES nps_surveys(id) ON DELETE CASCADE,
        category_name VARCHAR(255) NOT NULL,
        confidence_score DECIMAL(3,2),
        sentiment_score DECIMAL(3,2),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Comment categories table created');

    // Create action plans table (for future use)
    await client.query(`
      CREATE TABLE IF NOT EXISTS action_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        category_focus VARCHAR(255),
        target_metric VARCHAR(100),
        target_value DECIMAL(5,2),
        status VARCHAR(50) DEFAULT 'draft',
        start_date DATE,
        target_completion_date DATE,
        actual_completion_date DATE,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Action plans table created');

    // NPS Uploads table (track upload sessions)
    await client.query(`
      CREATE TABLE IF NOT EXISTS nps_uploads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        total_rows INTEGER DEFAULT 0,
        processed_rows INTEGER DEFAULT 0,
        failed_rows INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'processing',
        industry VARCHAR(100),
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ NPS uploads table created');

    // Enhanced NPS Surveys table (nps_responses)
    await client.query(`
      CREATE TABLE IF NOT EXISTS nps_responses (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER REFERENCES nps_uploads(id) ON DELETE SET NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_external_id VARCHAR(255) NOT NULL,
        nps_score INTEGER NOT NULL CHECK (nps_score >= 0 AND nps_score <= 10),
        survey_date DATE NOT NULL,
        comments TEXT,
        sentiment_score DECIMAL(3,2),
        sentiment_label VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, customer_external_id, survey_date)
      );
    `);
    console.log('✅ NPS responses table created');

    // NPS Factor Ratings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nps_factor_ratings (
        id SERIAL PRIMARY KEY,
        nps_response_id INTEGER REFERENCES nps_responses(id) ON DELETE CASCADE,
        factor_name VARCHAR(100) NOT NULL,
        rating INTEGER CHECK (rating >= 0 AND rating <= 10),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ NPS factor ratings table created');

    // NPS Analytics Cache table
    await client.query(`
      CREATE TABLE IF NOT EXISTS nps_analytics_cache (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        cache_key VARCHAR(255) NOT NULL,
        cache_data JSON NOT NULL,
        industry VARCHAR(100),
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, cache_key)
      );
    `);
    console.log('✅ NPS analytics cache table created');

    // Customer Journey table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_journey (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        customer_external_id VARCHAR(255) NOT NULL,
        first_survey_date DATE,
        latest_survey_date DATE,
        first_nps_score INTEGER,
        latest_nps_score INTEGER,
        total_surveys INTEGER DEFAULT 1,
        average_nps DECIMAL(4,2),
        trend VARCHAR(20),
        segment VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, customer_external_id)
      );
    `);
    console.log('✅ Customer journey table created');

    // Indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_nps_responses_user_date ON nps_responses(user_id, survey_date);
      CREATE INDEX IF NOT EXISTS idx_nps_responses_customer ON nps_responses(customer_external_id);
      CREATE INDEX IF NOT EXISTS idx_nps_responses_score ON nps_responses(nps_score);
      CREATE INDEX IF NOT EXISTS idx_nps_uploads_user ON nps_uploads(user_id);
      CREATE INDEX IF NOT EXISTS idx_factor_ratings_response ON nps_factor_ratings(nps_response_id);
      CREATE INDEX IF NOT EXISTS idx_customer_journey_user ON customer_journey(user_id);
    `);
    console.log('✅ NPS analytics/journey indexes created');

    // Insert sample industry configurations
    await client.query(`
      INSERT INTO industry_configs (industry_name, categories, nps_factors) VALUES
      ('SaaS/Technology', 
       $1,
       $2
      ),
      ('E-commerce/Retail',
       $3,
       $4
      ),
      ('Healthcare',
       $5,
       $6
      ),
      ('Financial Services',
       $7,
       $8
      )
      ON CONFLICT (industry_name) DO NOTHING;
    `, [
      // SaaS/Technology
      JSON.stringify([
        "Technical Issues: Bug Reports", "Technical Issues: Feature Requests", "Technical Issues: Performance",
        "Customer Success: Onboarding", "Customer Success: Training", "Customer Success: Support Quality",
        "Product Feedback: UI/UX", "Product Feedback: Functionality", "Product Feedback: Integration",
        "Billing: Pricing", "Billing: Invoicing", "Billing: Payment Issues"
      ]),
      JSON.stringify(["Product Quality", "Customer Support", "Ease of Use", "Value for Money", "Feature Completeness"]),
      
      // E-commerce/Retail
      JSON.stringify([
        "Product Quality: Defects", "Product Quality: Durability", "Product Quality: Satisfaction",
        "Shipping: Delivery Speed", "Shipping: Packaging", "Shipping: Tracking",
        "Customer Service: Response Time", "Customer Service: Resolution", "Customer Service: Helpfulness",
        "Website Experience: Navigation", "Website Experience: Checkout", "Website Experience: Search"
      ]),
      JSON.stringify(["Product Quality", "Shipping Experience", "Customer Service", "Website Usability", "Value for Money"]),
      
      // Healthcare
      JSON.stringify([
        "Clinical Care: Treatment Quality", "Clinical Care: Provider Communication",
        "Facility Experience: Wait Times", "Facility Experience: Cleanliness", "Facility Experience: Accessibility",
        "Administrative: Billing", "Administrative: Scheduling", "Administrative: Insurance",
        "Staff Interaction: Professionalism", "Staff Interaction: Empathy", "Staff Interaction: Responsiveness"
      ]),
      JSON.stringify(["Care Quality", "Staff Friendliness", "Wait Times", "Facility Cleanliness", "Billing Clarity"]),
      
      // Financial Services
      JSON.stringify([
        "Account Management: Access", "Account Management: Features", "Account Management: Statements",
        "Transaction Processing: Speed", "Transaction Processing: Accuracy", "Transaction Processing: Fees",
        "Customer Support: Knowledge", "Customer Support: Availability", "Customer Support: Resolution",
        "Digital Experience: Mobile App", "Digital Experience: Website", "Digital Experience: Security"
      ]),
      JSON.stringify(["Service Quality", "Digital Experience", "Fees and Pricing", "Security", "Customer Support"])
    ]);
    console.log('✅ Sample industry configurations added');

    console.log('\n🎉 Heroku Postgres database setup completed successfully!');
    console.log('📊 Sample industries available: SaaS/Technology, E-commerce/Retail, Healthcare, Financial Services');
    console.log('🚀 You can now start building the authentication system!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    if (error.message.includes('permission denied')) {
      console.error('💡 Make sure your Heroku Postgres add-on is properly configured');
    }
    if (error.message.includes('connection')) {
      console.error('💡 Check your DATABASE_URL environment variable');
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Check if this is being run directly
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase, getDatabaseConfig };