require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const config = require('./config');

const app = express();
const port = process.env.PORT || 3000;

// Redshift connection pool
const pool = new Pool({
  host: process.env.REDSHIFT_HOST,
  port: parseInt(process.env.REDSHIFT_PORT || '5439', 10),
  database: process.env.REDSHIFT_DATABASE,
  user: process.env.REDSHIFT_USER,
  password: process.env.REDSHIFT_PASSWORD,
  ssl: { rejectUnauthorized: false },
});

// Serve static frontend
app.use(express.static('public'));

// Lookup route — resolve product/style ID, check for ambiguity
app.get('/api/lookup/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(config.lookupSql, [id]);
    if (result.rows.length === 0) {
      return res.json({ found: false, matches: [] });
    }
    if (result.rows.length === 1) {
      return res.json({ found: true, ambiguous: false, match: result.rows[0] });
    }
    return res.json({ found: true, ambiguous: true, matches: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Only start listening if this file is run directly (not required by tests)
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Inspector Promo running at http://localhost:${port}`);
    // Open browser automatically
    const { exec } = require('child_process');
    exec(`open http://localhost:${port}`);
  });
}

module.exports = app;
