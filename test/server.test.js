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
  it('returns a styles array with per-style tab data', async () => {
    const Module = require('module');
    const originalRequire = Module.prototype.require;

    // Call 1 = styles; Calls 2/3 = colors / suids for the style ids.
    let callIndex = 0;
    Module.prototype.require = function(id) {
      if (id === 'pg') {
        return {
          Pool: class {
            query() {
              callIndex += 1;
              if (callIndex === 1) {
                return {
                  rows: [
                    { id: 1, name: 'S1', mill_no: 'ABC', status: 'active', deployed_at: '2025-01-01' },
                    { id: 2, name: 'S2', mill_no: 'ABC', status: 'retired', deployed_at: '2020-01-01' },
                  ],
                };
              }
              if (callIndex === 2) {
                return { rows: [{ style_id: 1, id: 10, name: 'Red' }, { style_id: 2, id: 20, name: 'Blue' }] };
              }
              return { rows: [{ style_id: 1, color_name: 'Red', size_name: 'M', supplier_id: 99, uid: 'X' }] };
            }
            end() {}
          }
        };
      }
      return originalRequire.apply(this, arguments);
    };

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/mms/ABC');

    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.millNo, 'ABC');
    assert.ok(Array.isArray(res.body.styles));
    assert.strictEqual(res.body.styles.length, 2);
    const [s1, s2] = res.body.styles;
    assert.strictEqual(s1.id, 1);
    assert.strictEqual(s1.status, 'active');
    assert.strictEqual(s1.tabs.Style.length, 1);
    assert.strictEqual(s1.tabs.Colors.length, 1);
    assert.strictEqual(s1.tabs['SKUs & SUIDs'].length, 1);
    assert.strictEqual(s2.id, 2);
    assert.strictEqual(s2.status, 'retired');
    assert.strictEqual(s2.tabs.Colors.length, 1);
    assert.deepStrictEqual(s2.tabs['SKUs & SUIDs'], []);
  });

  it('returns an empty styles array when no styles match', async () => {
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

    delete require.cache[require.resolve('../server')];
    const app = require('../server');
    const res = await request(app, '/api/mms/NOPE');

    Module.prototype.require = originalRequire;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.millNo, 'NOPE');
    assert.deepStrictEqual(res.body.styles, []);
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
