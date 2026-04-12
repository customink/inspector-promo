# Bootstrap 5 Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Inspector Promo's custom CSS with Bootstrap 5 via CDN for faster AI-assisted UI development.

**Architecture:** Three frontend files change (`index.html`, `style.css`, `app.js`). Bootstrap CSS and JS are loaded from CDN — no build step, no npm dependencies. Custom CSS is reduced to ~50 lines covering the dark header, accent color, viewport layout, sticky table headers, and JSON tree syntax highlighting.

**Tech Stack:** Bootstrap 5.3 (CDN), vanilla HTML/CSS/JS, Express (unchanged)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `public/index.html` | Modify | Add CDN links, restructure markup to use Bootstrap classes |
| `public/style.css` | Rewrite | Strip to ~50 lines of Bootstrap overrides + JSON tree styles |
| `public/app.js` | Modify | Update CSS class names on dynamically-created elements |

No new files. No backend changes.

---

### Task 1: Add Bootstrap CDN and Restructure HTML

**Files:**
- Modify: `public/index.html`

- [ ] **Step 1: Replace the full contents of `public/index.html`**

The new markup adds Bootstrap CDN links, converts the header to a Bootstrap navbar, converts the left nav to `nav-pills`, converts tab navs to Bootstrap tab markup, and replaces all `hidden` classes with `d-none`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inspector Promo</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <nav class="navbar navbar-dark px-3 gap-3">
    <span class="navbar-brand mb-0 h1">Inspector Promo</span>
    <form id="lookup-form" class="d-flex gap-2">
      <input type="text" id="product-id" class="form-control form-control-sm" placeholder="Enter product ID or style ID" autofocus>
      <button type="submit" class="btn btn-primary btn-sm">Look Up</button>
    </form>
    <span id="identity-content" class="navbar-text"></span>
    <span id="disambiguation" class="d-none"></span>
  </nav>

  <main id="results" class="d-none">
    <div id="left-nav" class="nav nav-pills flex-column">
      <button class="nav-link active" data-section="links">Links</button>
      <button class="nav-link" data-section="fpdb">FPDB</button>
      <button class="nav-link" data-section="fps">FPS</button>
      <button class="nav-link" data-section="mms">MMS</button>
    </div>

    <div id="content-area">
      <!-- Links -->
      <section id="links-section" class="content-section">
        <div id="links-content"></div>
      </section>

      <!-- FPDB Data -->
      <section id="fpdb-section" class="content-section d-none">
        <div id="fpdb-loading" class="d-none">
          <span class="spinner-border spinner-border-sm me-2"></span>Loading FPDB data...
        </div>
        <ul id="fpdb-tab-nav" class="nav nav-tabs"></ul>
        <div id="fpdb-tab-content" class="tab-content"></div>
      </section>

      <!-- FPS API Data -->
      <section id="fps-section" class="content-section d-none">
        <div id="fps-loading" class="d-none">
          <span class="spinner-border spinner-border-sm me-2"></span>Loading FPS data...
        </div>
        <ul id="fps-tab-nav" class="nav nav-tabs"></ul>
        <div id="fps-tab-content" class="tab-content"></div>
      </section>

      <!-- MMS Data -->
      <section id="mms-section" class="content-section d-none">
        <div id="mms-loading" class="d-none">
          <span class="spinner-border spinner-border-sm me-2"></span>Loading MMS data...
        </div>
        <ul id="mms-tab-nav" class="nav nav-tabs"></ul>
        <div id="mms-tab-content" class="tab-content"></div>
      </section>
    </div>
  </main>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

Key changes from the original:
- `<header>` → `<nav class="navbar navbar-dark">`
- `#lookup-form` uses `form-control form-control-sm` on input, `btn btn-primary btn-sm` on button
- `#identity-content` and `#disambiguation` become `<span>` elements (was `<div>`) for navbar inline flow
- `#left-nav` uses `nav nav-pills flex-column` with `nav-link` buttons instead of `nav-btn`
- All `hidden` → `d-none`
- Tab navs change from `<div class="tab-nav">` to `<ul class="nav nav-tabs">`
- Tab content containers get `tab-content` class
- Loading indicators use Bootstrap spinner markup
- Bootstrap CSS loaded before `style.css` (so overrides win)
- Bootstrap JS bundle loaded before `app.js`

- [ ] **Step 2: Verify the page loads without errors**

Run: `npm start`

Open `http://localhost:3000` in a browser. The page should load and display the navbar with the search form. It will look unstyled/broken because `style.css` and `app.js` still reference old classes — that's expected. Check the browser console for no 404s on the CDN resources.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add Bootstrap 5 CDN and restructure HTML markup

Convert header to navbar, left nav to nav-pills, tabs to nav-tabs,
and replace hidden class with Bootstrap's d-none utility."
```

---

### Task 2: Rewrite CSS to Bootstrap Overrides

**Files:**
- Rewrite: `public/style.css`

- [ ] **Step 1: Replace the full contents of `public/style.css`**

This strips the file from ~344 lines down to overrides only. Bootstrap handles all component styling. We keep: custom header color, accent color on interactive components, full-viewport flex layout, sticky table headers, and the JSON tree renderer.

```css
/* === Layout === */
body {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* === Navbar === */
.navbar {
  background: #1a1a2e;
  flex-shrink: 0;
}

/* === Accent color overrides === */
.btn-primary {
  background-color: #e94560;
  border-color: #e94560;
}

.btn-primary:hover,
.btn-primary:active {
  background-color: #c73e54;
  border-color: #c73e54;
}

.nav-pills .nav-link.active {
  background-color: #e94560;
}

.nav-tabs .nav-link.active {
  color: #e94560;
  border-bottom-color: #e94560;
}

/* === Left nav === */
#left-nav {
  width: 120px;
  flex-shrink: 0;
  background: #fff;
  border-right: 1px solid var(--bs-border-color);
  padding: 0.5rem 0;
}

#left-nav .nav-link {
  border-radius: 0;
  color: #666;
  padding: 0.6rem 1rem;
  font-size: 0.9rem;
}

#left-nav .nav-link:hover {
  background: #f5f5f5;
  color: #333;
}

#left-nav .nav-link.active {
  color: #fff;
}

/* === Content area === */
#content-area {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.content-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0.75rem 1rem;
}

.tab-content {
  flex: 1;
  overflow: auto;
  padding: 0.5rem 0;
}

/* === Sticky table headers === */
.table th {
  position: sticky;
  top: 0;
  background: var(--bs-table-bg, #fff);
  z-index: 1;
  cursor: pointer;
}

/* === JSON Tree === */
.json-tree {
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.8rem;
  line-height: 1.6;
}

.json-tree .key { color: #881391; }
.json-tree .string { color: #c41a16; }
.json-tree .number { color: #1c00cf; }
.json-tree .boolean { color: #0d22aa; }
.json-tree .null { color: #808080; }

.json-tree .toggle {
  cursor: pointer;
  user-select: none;
}

.json-tree .toggle::before {
  content: '\25BC ';
  font-size: 0.65rem;
  display: inline-block;
}

.json-tree .toggle.collapsed::before {
  content: '\25B6 ';
}

.json-tree .collapsible.collapsed > .json-children {
  display: none;
}

.json-tree .collapsible.collapsed > .collapse-preview {
  display: inline;
}

.json-tree .collapse-preview {
  display: none;
  color: #888;
}
```

- [ ] **Step 2: Verify the page renders correctly**

Run: `npm start` (or refresh if already running)

Open `http://localhost:3000`. The navbar should show with the dark navy background and the red "Look Up" button. The left nav pills should be visible. The page won't be fully functional yet because `app.js` still creates elements with old class names — that's expected at this step.

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat: rewrite CSS to Bootstrap overrides only

Strip from ~344 lines to ~100 lines. Bootstrap handles component
styling. Custom CSS covers: dark header, accent color, viewport
layout, sticky table headers, and JSON tree syntax highlighting."
```

---

### Task 3: Update JavaScript Class Names

**Files:**
- Modify: `public/app.js`

- [ ] **Step 1: Replace the full contents of `public/app.js`**

This updates all CSS class names applied to dynamically-created elements. The rendering logic, event handling, and data flow are identical — only class names change. Key changes:
- `hidden` → `d-none` everywhere
- `nav-btn` → `nav-link` for left nav
- Tab creation uses `<li class="nav-item">` > `<button class="nav-link">` instead of bare `<button>`
- Tab panes use `tab-pane` class
- Tables use `table table-sm table-hover table-striped`
- Errors use `alert alert-danger`
- Loading uses `d-none` instead of `hidden`
- No-data uses `text-muted fst-italic`
- Links list uses `list-group list-group-flush` with `list-group-item` items
- Disambiguation buttons use `btn btn-outline-light btn-sm`

```javascript
const form = document.getElementById('lookup-form');
const input = document.getElementById('product-id');
const resultsEl = document.getElementById('results');
const identityContent = document.getElementById('identity-content');
const disambiguationEl = document.getElementById('disambiguation');
const linksContent = document.getElementById('links-content');

// Left nav
const navButtons = document.querySelectorAll('#left-nav .nav-link');
const sections = document.querySelectorAll('.content-section');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    sections.forEach((s) => s.classList.add('d-none'));
    document.getElementById(`${btn.dataset.section}-section`).classList.remove('d-none');
  });
});

// Form submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = input.value.trim();
  if (!id) return;
  resetResults();
  resultsEl.classList.remove('d-none');
  await doLookup(id);
});

function resetResults() {
  identityContent.innerHTML = '';
  disambiguationEl.innerHTML = '';
  disambiguationEl.classList.add('d-none');
  linksContent.innerHTML = '';
  // Reset all tabbed sections
  ['fpdb', 'fps', 'mms'].forEach((key) => {
    document.getElementById(`${key}-loading`).classList.add('d-none');
    document.getElementById(`${key}-tab-nav`).innerHTML = '';
    document.getElementById(`${key}-tab-content`).innerHTML = '';
  });
  // Reset nav to Links
  navButtons.forEach((b) => b.classList.remove('active'));
  navButtons[0].classList.add('active');
  sections.forEach((s) => s.classList.add('d-none'));
  sections[0].classList.remove('d-none');
}

async function doLookup(id) {
  identityContent.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Looking up...';
  try {
    const res = await fetch(`/api/lookup/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!data.found) {
      identityContent.innerHTML = '<span class="text-danger">No product found for this ID.</span>';
      return;
    }

    if (data.ambiguous) {
      identityContent.innerHTML = '<span>Multiple matches — select one:</span>';
      disambiguationEl.classList.remove('d-none');
      disambiguationEl.innerHTML = '';
      data.matches.forEach((match) => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-light btn-sm me-2';
        btn.textContent = `${match.product_id} — ${match.supplier_name}`;
        btn.addEventListener('click', () => {
          disambiguationEl.classList.add('d-none');
          showProduct(match);
        });
        disambiguationEl.appendChild(btn);
      });
      return;
    }

    showProduct(data.match);
  } catch (err) {
    identityContent.innerHTML = `<span class="text-danger">Lookup failed: ${err.message}</span>`;
  }
}

function showProduct(match) {
  const parts = [`<b>${match.product_id}</b>`];
  if (match.supplier_name) parts.push(match.supplier_name);
  if (match.product_name) parts.push(match.product_name);
  if (match.style_id) parts.push(`Style: ${match.style_id}`);
  identityContent.innerHTML = parts.join(' &middot; ');

  const productId = match.product_id;
  const styleId = match.style_id;
  const provider = match.supplier_name;

  fetchLinks(productId, styleId);
  fetchTabbedData('fpdb', productId, 'FPDB', renderTable);
  fetchTabbedData('fps', `${productId}?provider=${encodeURIComponent(provider)}`, 'FPS', renderJson);
  if (styleId) {
    fetchTabbedData('mms', styleId, 'MMS', renderTable);
  } else {
    document.getElementById('mms-tab-content').innerHTML =
      '<span class="text-muted fst-italic">No style ID available — MMS data requires a style ID</span>';
  }
}

// --- Links ---

async function fetchLinks(productId, styleId) {
  try {
    const params = styleId ? `?style_id=${encodeURIComponent(styleId)}` : '';
    const res = await fetch(`/api/links/${encodeURIComponent(productId)}${params}`);
    const data = await res.json();
    if (!data.links || data.links.length === 0) {
      linksContent.innerHTML = '<span class="text-muted fst-italic">No links configured</span>';
      return;
    }
    const ul = document.createElement('ul');
    ul.className = 'list-group list-group-flush';
    data.links.forEach(({ name, url }) => {
      const li = document.createElement('li');
      li.className = 'list-group-item px-0';
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = name;
      li.appendChild(a);
      ul.appendChild(li);
    });
    linksContent.innerHTML = '';
    linksContent.appendChild(ul);
  } catch (err) {
    linksContent.innerHTML = `<div class="alert alert-danger">Failed to load links: ${err.message}</div>`;
  }
}

// --- Tabbed data fetcher (shared by FPDB, FPS, MMS) ---

function fetchTabbedData(key, idAndParams, label, renderFn) {
  const loadingEl = document.getElementById(`${key}-loading`);
  const tabNavEl = document.getElementById(`${key}-tab-nav`);
  const tabContentEl = document.getElementById(`${key}-tab-content`);

  loadingEl.classList.remove('d-none');
  tabNavEl.innerHTML = '';
  tabContentEl.innerHTML = '';

  const url = `/api/${key}/${idAndParams}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      loadingEl.classList.add('d-none');

      if (data.error) {
        tabContentEl.innerHTML = `<div class="alert alert-danger">${label} error: ${data.error}</div>`;
        return;
      }

      const entries = Object.entries(data);
      if (entries.length === 0) {
        tabContentEl.innerHTML = `<span class="text-muted fst-italic">No ${label} data</span>`;
        return;
      }

      const panes = {};

      entries.forEach(([name, responseData], idx) => {
        // Tab button inside nav-item
        const li = document.createElement('li');
        li.className = 'nav-item';
        const btn = document.createElement('button');
        btn.className = `nav-link${idx === 0 ? ' active' : ''}`;
        btn.textContent = name;
        btn.addEventListener('click', () => activateTab(name));
        li.appendChild(btn);
        tabNavEl.appendChild(li);

        // Pane
        const pane = document.createElement('div');
        pane.className = `tab-pane${idx === 0 ? ' active' : ''}`;
        renderFn(pane, responseData);
        if (idx !== 0) pane.style.display = 'none';
        tabContentEl.appendChild(pane);
        panes[name] = pane;
      });

      function activateTab(name) {
        for (const li of tabNavEl.children) {
          const btn = li.querySelector('.nav-link');
          btn.classList.toggle('active', btn.textContent === name);
        }
        Object.entries(panes).forEach(([n, p]) => {
          p.style.display = n === name ? '' : 'none';
          p.classList.toggle('active', n === name);
        });
      }
    })
    .catch((err) => {
      loadingEl.classList.add('d-none');
      tabContentEl.innerHTML = `<div class="alert alert-danger">Failed to load ${label} data: ${err.message}</div>`;
    });
}

// --- Table renderer (for FPDB and MMS) ---

function renderTable(pane, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    pane.innerHTML = '<span class="text-muted fst-italic">No data found</span>';
    return;
  }
  pane.appendChild(buildTable(rows));
}

function buildTable(rows) {
  const wrap = document.createElement('div');
  wrap.className = 'table-responsive';

  const table = document.createElement('table');
  table.className = 'table table-sm table-hover table-striped';
  const columns = Object.keys(rows[0]);

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  let sortCol = null;
  let sortAsc = true;

  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col;
    th.addEventListener('click', () => {
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = true;
      }
      const sorted = [...rows].sort((a, b) => {
        const av = a[col], bv = b[col];
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return sortAsc ? -1 : 1;
        if (av > bv) return sortAsc ? 1 : -1;
        return 0;
      });
      tbody.innerHTML = '';
      sorted.forEach((row) => tbody.appendChild(buildRow(row, columns)));
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  rows.forEach((row) => tbody.appendChild(buildRow(row, columns)));
  table.appendChild(tbody);

  wrap.appendChild(table);
  return wrap;
}

function buildRow(row, columns) {
  const tr = document.createElement('tr');
  columns.forEach((col) => {
    const td = document.createElement('td');
    td.textContent = row[col] ?? '';
    tr.appendChild(td);
  });
  return tr;
}

// --- JSON renderer (for FPS) ---

function renderJson(pane, data) {
  pane.className += ' json-tree';
  pane.appendChild(renderJsonNode(data));
}

function renderJsonNode(data) {
  const container = document.createElement('span');

  if (data === null) {
    container.innerHTML = '<span class="null">null</span>';
    return container;
  }

  if (typeof data === 'string') {
    container.innerHTML = `<span class="string">"${escapeHtml(data)}"</span>`;
    return container;
  }

  if (typeof data === 'number') {
    container.innerHTML = `<span class="number">${data}</span>`;
    return container;
  }

  if (typeof data === 'boolean') {
    container.innerHTML = `<span class="boolean">${data}</span>`;
    return container;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      container.textContent = '[]';
      return container;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'collapsible';

    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    toggle.textContent = '';
    toggle.addEventListener('click', () => wrapper.classList.toggle('collapsed'));
    wrapper.appendChild(toggle);

    wrapper.appendChild(document.createTextNode('['));

    const preview = document.createElement('span');
    preview.className = 'collapse-preview';
    preview.textContent = `${data.length} items...`;
    wrapper.appendChild(preview);

    const children = document.createElement('div');
    children.className = 'json-children';
    children.style.paddingLeft = '1.25rem';

    data.forEach((item, idx) => {
      const line = document.createElement('div');
      line.appendChild(renderJsonNode(item));
      if (idx < data.length - 1) line.appendChild(document.createTextNode(','));
      children.appendChild(line);
    });

    wrapper.appendChild(children);
    wrapper.appendChild(document.createTextNode(']'));
    container.appendChild(wrapper);
    return container;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      container.textContent = '{}';
      return container;
    }

    const wrapper = document.createElement('span');
    wrapper.className = 'collapsible';

    const toggle = document.createElement('span');
    toggle.className = 'toggle';
    toggle.textContent = '';
    toggle.addEventListener('click', () => wrapper.classList.toggle('collapsed'));
    wrapper.appendChild(toggle);

    wrapper.appendChild(document.createTextNode('{'));

    const preview = document.createElement('span');
    preview.className = 'collapse-preview';
    preview.textContent = `${keys.length} keys...`;
    wrapper.appendChild(preview);

    const children = document.createElement('div');
    children.className = 'json-children';
    children.style.paddingLeft = '1.25rem';

    keys.forEach((key, idx) => {
      const line = document.createElement('div');
      const keySpan = document.createElement('span');
      keySpan.className = 'key';
      keySpan.textContent = `"${key}"`;
      line.appendChild(keySpan);
      line.appendChild(document.createTextNode(': '));
      line.appendChild(renderJsonNode(data[key]));
      if (idx < keys.length - 1) line.appendChild(document.createTextNode(','));
      children.appendChild(line);
    });

    wrapper.appendChild(children);
    wrapper.appendChild(document.createTextNode('}'));
    container.appendChild(wrapper);
    return container;
  }

  container.textContent = String(data);
  return container;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Verify the app works end-to-end**

Run: `npm start` (or refresh if already running)

Open `http://localhost:3000` and verify:
1. The navbar renders with dark navy background, search input, and red "Look Up" button
2. Enter a product ID and submit
3. Identity info displays in the navbar
4. Left nav pills highlight correctly when clicked, switching between Links/FPDB/FPS/MMS sections
5. Links section shows a clean list
6. FPDB section shows Bootstrap-styled tabs with sortable tables
7. FPS section shows JSON tree with syntax highlighting and collapsible nodes
8. MMS section shows Bootstrap-styled tabs with sortable tables
9. Error states display as Bootstrap alerts
10. Loading states show Bootstrap spinners

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: update JS to use Bootstrap class names

Replace hidden/nav-btn/tab-nav/table-wrap/error-message/loading/no-data
classes with Bootstrap equivalents: d-none, nav-link, nav-tabs,
table-responsive, alert, spinner-border, text-muted."
```

---

### Task 4: Run Existing Tests

**Files:** None modified — verification only.

- [ ] **Step 1: Run the backend test suite**

Run: `npm test`

Expected: All 5 tests pass. The backend is unchanged, so these should be green. This confirms the migration didn't accidentally break any server-side require paths or module loading.

- [ ] **Step 2: Verify no console errors in browser**

Open `http://localhost:3000`, open browser DevTools (Console tab), and perform a lookup. Verify:
- No JavaScript errors in the console
- No 404s in the Network tab (CDN resources load successfully)
- No CSS warnings

---

### Task 5: Add `.superpowers/` to `.gitignore`

**Files:**
- Modify or create: `.gitignore`

- [ ] **Step 1: Add `.superpowers/` to `.gitignore`**

Check if `.gitignore` exists. If so, append `.superpowers/` to it. If not, create it with standard Node entries plus `.superpowers/`.

The `.superpowers/` directory was created by the brainstorming visual companion and should not be committed.

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .superpowers/ to .gitignore"
```
