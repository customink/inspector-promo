const { describe, it } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const config = require('../config');

// Helper to make requests against the app
function request(app, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const { port } = server.address();
      http.get(`http://localhost:${port}${path}`, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          server.close();
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      }).on('error', (err) => { server.close(); reject(err); });
    });
  });
}

describe('server', () => {
  it('exports an Express app', () => {
    // Clear the require cache to ensure fresh import
    delete require.cache[require.resolve('../server')];

    // Import the server module
    const app = require('../server');

    // Check that it's an Express app
    assert.ok(app);
    assert.strictEqual(typeof app.listen, 'function');
  });
});

describe('GET /api/fpdb/:id', () => {
  it('returns query results keyed by query name', async () => {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              return { rows: [{ product_id: 'ABC123', name: 'Test Product' }] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/fpdb/ABC123');

    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    const queryNames = config.fpdbQueries.map((q) => q.name);
    for (const name of queryNames) {
      assert.ok(Array.isArray(res.body[name]), `Expected array for "${name}"`);
    }
  });
});

describe('GET /api/mms/:product_id', () => {
  it('returns Style, Colors, SKUs & SUIDs and _meta when a style is selected', async () => {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              return { rows: [{ id: 1, name: 'Test Style', mill_no: 'ABC123', status: 'active' }] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/mms/ABC123');

    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.Style), 'Style should be an array');
    assert.strictEqual(res.body.Style.length, 1, 'Style should have the selected row');
    assert.ok(Array.isArray(res.body.Colors), 'Colors should be an array');
    assert.ok(Array.isArray(res.body['SKUs & SUIDs']), 'SKUs & SUIDs should be an array');
    assert.ok(res.body._meta, '_meta should be present');
    assert.strictEqual(res.body._meta.millNo, 'ABC123');
    assert.ok(Array.isArray(res.body._meta.otherMatches));
    assert.ok(Array.isArray(res.body._meta.ineligibleMatches));
  });

  it('returns empty tab arrays when no style is selected', async () => {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    // Track call order; first 3 calls are selected/other/ineligible in parallel.
    let callIndex = 0;
    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              callIndex += 1;
              // First call is selected style — return empty to simulate no match.
              if (callIndex === 1) return { rows: [] };
              // Subsequent calls (other/ineligible) return empty too.
              return { rows: [] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/mms/NOPE');

    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.body.Style, []);
    assert.deepStrictEqual(res.body.Colors, []);
    assert.deepStrictEqual(res.body['SKUs & SUIDs'], []);
    assert.strictEqual(res.body._meta.millNo, 'NOPE');
    assert.deepStrictEqual(res.body._meta.otherMatches, []);
    assert.deepStrictEqual(res.body._meta.ineligibleMatches, []);
  });
});

describe('GET /api/fps/:id', () => {
  it('returns proxied API responses keyed by endpoint name', async () => {
    // Mock global fetch to return fake API data
    const originalFetch = global.fetch;
    global.fetch = async (url) => ({
      ok: true,
      json: async () => ({ id: 'ABC123', source: url }),
    });

    // Mock pg and reload server
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              return { rows: [] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/fps/ABC123');

    // Restore original require
    Module.prototype.require = originalRequire;
    global.fetch = originalFetch;

    assert.strictEqual(res.status, 200);
    const endpointNames = config.fpsEndpoints.map((e) => e.name);
    for (const name of endpointNames) {
      assert.ok(res.body[name] !== undefined, `Expected key "${name}"`);
    }
  });
});

describe('GET /api/s3/:provider/:id', () => {
  it('returns S3 file contents keyed by file type', async () => {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() { return { rows: [] }; }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    // Mock execFile to return fake JSON
    const childProcess = require('child_process');
    const originalExecFile = childProcess.execFile;
    childProcess.execFile = (cmd, args, opts, cb) => {
      if (typeof opts === 'function') { cb = opts; }
      cb(null, { stdout: '{"test": true}' });
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/s3/hitpromo/0PATCH4');

    Module.prototype.require = originalRequire;
    childProcess.execFile = originalExecFile;

    assert.strictEqual(res.status, 200);
    const fileNames = config.s3Files.map((f) => f.name);
    for (const name of fileNames) {
      assert.ok(res.body[name] !== undefined, `Expected key "${name}"`);
    }
  });
});

describe('GET /api/links/:id', () => {
  it('returns constructed URLs for external systems', async () => {
    // Mock pg and reload server
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              return { rows: [] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/links/ABC123');

    // Restore original require
    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.links));
    for (const link of res.body.links) {
      assert.ok(link.name, 'Each link should have a name');
      assert.ok(link.url, 'Each link should have a url');
      assert.ok(link.url.includes('ABC123'), 'URL should contain the product ID');
    }
  });
});
