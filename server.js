require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const config = require('./config');

const app = express();
const port = process.env.PORT || 3000;

// Redshift connection pool
const pool = new Pool({
  host: process.env.REDSHIFT_HOST || 'redshift-production.db.customink.com',
  port: parseInt(process.env.REDSHIFT_PORT || '5439', 10),
  database: process.env.REDSHIFT_DATABASE || 'cink',
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

// FPDB data route — raw supplier data from fulfillment_products_service tables
// :id is the product_id (supplier's product ID)
app.get('/api/fpdb/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const results = {};
    const queries = config.fpdbQueries.map(async ({ name, sql }) => {
      const result = await pool.query(sql, [id]);
      results[name] = result.rows;
    });
    await Promise.all(queries);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MMS data route — raw MMS tables from rawdata
// :id is the style_id (mms_styles.id)
app.get('/api/mms/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const results = {};
    const queries = config.mmsQueries.map(async ({ name, sql }) => {
      const result = await pool.query(sql, [id]);
      results[name] = result.rows;
    });
    await Promise.all(queries);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// S3 raw data route — fetch pre-processing JSON from S3
// :provider is the provider_name, :id is the product_id
app.get('/api/s3/:provider/:id', async (req, res) => {
  const { provider, id } = req.params;
  const bucket = config.s3Bucket;
  try {
    const results = {};
    const fetches = config.s3Files.map(async ({ name, path }) => {
      const s3Key = `${provider}/${path.replace('{id}', id)}`;
      const s3Uri = `s3://${bucket}/${s3Key}`;
      try {
        const { stdout } = await execFileAsync('aws', ['s3', 'cp', s3Uri, '-'], {
          maxBuffer: 10 * 1024 * 1024,
        });
        results[name] = JSON.parse(stdout);
      } catch (err) {
        results[name] = { error: err.stderr || err.message };
      }
    });
    await Promise.all(fetches);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// FPS API proxy route — call all configured FPS endpoints for a product
// Accepts ?provider= query param for endpoints that need provider_name
app.get('/api/fps/:id', async (req, res) => {
  const { id } = req.params;
  const provider = req.query.provider || '';
  const baseUrl = process.env.FPS_BASE_URL || '';

  async function fetchJson(url) {
    try {
      const response = await fetch(url);
      const data = response.ok ? await response.json() : { error: `HTTP ${response.status}` };
      return { url, data };
    } catch (err) {
      return { url, data: { error: err.message } };
    }
  }

  try {
    const results = {};

    // Standard product/provider endpoints
    const calls = config.fpsEndpoints.map(async ({ name, path }) => {
      const url = `${baseUrl}${path.replace('{id}', encodeURIComponent(id)).replace('{provider}', encodeURIComponent(provider))}`;
      results[name] = await fetchJson(url);
    });

    // Decorations: chained call — first look up mms_skus from FPDB, then call decorations
    const decorationsCall = (async () => {
      try {
        const skuResult = await pool.query(
          `SELECT DISTINCT mms_sku
             FROM rawdata.fulfillment_products_service_fulfillment_promo_product_skus
             WHERE product_id = $1 AND mms_sku IS NOT NULL`,
          [id]
        );
        const mmsSkus = skuResult.rows.map((r) => r.mms_sku).filter(Boolean);
        if (mmsSkus.length === 0) {
          results['Decorations'] = { url: null, data: { error: 'No mms_skus found for product' } };
          return;
        }
        const url = `${baseUrl}/api/v1/products/decorations?mms_skus=${encodeURIComponent(mmsSkus.join(','))}`;
        results['Decorations'] = await fetchJson(url);
      } catch (err) {
        results['Decorations'] = { url: null, data: { error: err.message } };
      }
    })();

    await Promise.all([...calls, decorationsCall]);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Links route — construct URLs for external systems
app.get('/api/links/:id', (req, res) => {
  const { id } = req.params;
  const styleId = req.query.style_id || id;
  const provider = req.query.provider;

  const links = config.externalLinks.map(({ name, urlPattern }) => ({
    name,
    url: urlPattern.replace('{id}', id).replace('{style_id}', styleId),
  }));

  const supplierPattern = provider && config.supplierLinks[provider];
  if (supplierPattern) {
    links.unshift({
      name: `${provider} (supplier site)`,
      url: supplierPattern.replace('{id}', id),
    });
  }

  res.json({ links });
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
