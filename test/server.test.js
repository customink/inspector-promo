const { describe, it } = require('node:test');
const assert = require('node:assert');

// We'll test the route handlers by extracting them into testable functions.
// But first, let's test the server module loads and exports an app.

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
