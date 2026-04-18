# UI Rendering Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace five section-specific rendering paths (`fetchTabbedData`, `fetchGroupedTabbedData`, `fetchMmsData`, inline Links list, and related renderers) with a single uniform structure (`groups → tabs → content`) and a single `renderSection(key, promise)` driven by per-section fetchers.

**Architecture:** Split `public/app.js` into three files. `public/render.js` owns `renderSection` and the content renderers (`renderTable` / `renderJson` / `renderList` / `renderError`). `public/sections.js` owns five section fetchers (`fetchLinks`, `fetchFpdb`, `fetchFps`, `fetchMms`, `fetchS3`) that call the existing `/api/<section>/...` routes and transform each response into the uniform structure. `public/app.js` keeps input / form / recents / `showProduct` only, and `showProduct` hands each fetcher's Promise to `renderSection`.

**Tech Stack:** Vanilla JS, Bootstrap 5 classes, three `<script>` tags loaded in order. No build step.

**Spec:** `docs/superpowers/specs/2026-04-18-ui-rendering-refactor-design.md`

**Testing note:** There is no JS test harness for the frontend. Server routes are unchanged so `test/server.test.js` remains green; verification of client behavior is manual in the browser, captured in the final task.

---

## File Structure

- Create: `public/render.js` — `renderSection`, `renderStructure`, `renderGroupTabs`, `renderContent`, `renderTable`, `buildTable`, `buildRow`, `renderJson`, `renderJsonNode`, `renderList`, `renderError`, `escapeHtml`.
- Create: `public/sections.js` — `FPDB_GROUPS`, `FPS_TAB_ORDER`, `MMS_TAB_ORDER`, `S3_TAB_ORDER`, `fetchLinks`, `fetchFpdb`, `fetchFps`, `fetchMms`, `fetchS3`.
- Modify: `public/index.html` — load `render.js` and `sections.js` before `app.js`.
- Modify: `public/app.js` — delete old renderers / fetchers / tab-order constants; rewrite `showProduct`.
- Modify: `public/style.css` — remove the `.nav-pills .nav-link.mms-style-muted` block (muted treatment is deferred).

No server changes. `server.js`, `config.js`, and `test/server.test.js` are untouched.

---

## Task 1: Create `public/render.js`

**Files:**
- Create: `public/render.js`

- [ ] **Step 1: Write the new file**

Create `public/render.js` with this exact content:

```js
// Uniform section renderer plus content-type renderers.
// Loaded before sections.js and app.js.

function renderSection(sectionKey, promise) {
  const loadingEl = document.getElementById(`${sectionKey}-loading`);
  const tabNavEl = document.getElementById(`${sectionKey}-tab-nav`);
  const tabContentEl = document.getElementById(`${sectionKey}-tab-content`);

  loadingEl.classList.remove('d-none');
  tabNavEl.innerHTML = '';
  tabContentEl.innerHTML = '';

  promise
    .then((structure) => {
      loadingEl.classList.add('d-none');
      renderStructure(tabNavEl, tabContentEl, structure);
    })
    .catch((err) => {
      loadingEl.classList.add('d-none');
      renderStructure(tabNavEl, tabContentEl, {
        groups: [{
          name: '',
          tabs: [{ name: 'Error', content: { type: 'error', message: err.message } }],
        }],
      });
    });
}

function renderStructure(tabNavEl, tabContentEl, structure) {
  tabNavEl.innerHTML = '';
  tabContentEl.innerHTML = '';
  const groups = Array.isArray(structure && structure.groups) ? structure.groups : [];
  if (groups.length === 0) {
    tabContentEl.innerHTML = '<span class="text-muted fst-italic">No data</span>';
    return;
  }

  let groupPillNav = null;
  if (groups.length > 1) {
    groupPillNav = document.createElement('ul');
    groupPillNav.className = 'nav nav-pills mb-2';
    tabNavEl.appendChild(groupPillNav);
  }

  const subTabNav = document.createElement('ul');
  subTabNav.className = 'nav nav-tabs';
  tabNavEl.appendChild(subTabNav);

  function activateGroup(idx) {
    if (groupPillNav) {
      Array.from(groupPillNav.children).forEach((li, i) => {
        li.querySelector('.nav-link').classList.toggle('active', i === idx);
      });
    }
    renderGroupTabs(subTabNav, tabContentEl, groups[idx]);
  }

  if (groupPillNav) {
    groups.forEach((g, idx) => {
      const li = document.createElement('li');
      li.className = 'nav-item';
      const btn = document.createElement('button');
      btn.className = `nav-link btn btn-secondary${idx === 0 ? ' active' : ''}`;
      btn.textContent = g.name || '';
      btn.addEventListener('click', () => activateGroup(idx));
      li.appendChild(btn);
      groupPillNav.appendChild(li);
    });
  }

  activateGroup(0);
}

function renderGroupTabs(subTabNav, tabContentEl, group) {
  subTabNav.innerHTML = '';
  tabContentEl.innerHTML = '';
  const tabs = Array.isArray(group && group.tabs) ? group.tabs : [];
  if (tabs.length === 0) {
    tabContentEl.innerHTML = '<span class="text-muted fst-italic">No data in this group</span>';
    return;
  }

  const panes = {};
  tabs.forEach((tab, idx) => {
    const li = document.createElement('li');
    li.className = 'nav-item';
    const btn = document.createElement('button');
    btn.className = `nav-link${idx === 0 ? ' active' : ''}`;
    btn.textContent = tab.name || '';
    btn.addEventListener('click', () => activateTab(tab.name));
    li.appendChild(btn);
    subTabNav.appendChild(li);

    const pane = document.createElement('div');
    pane.className = `tab-pane${idx === 0 ? ' active' : ''}`;
    renderContent(pane, tab.content);
    if (idx !== 0) pane.style.display = 'none';
    tabContentEl.appendChild(pane);
    panes[tab.name] = pane;
  });

  function activateTab(name) {
    Array.from(subTabNav.children).forEach((li) => {
      const b = li.querySelector('.nav-link');
      b.classList.toggle('active', b.textContent === name);
    });
    Object.entries(panes).forEach(([n, p]) => {
      p.style.display = n === name ? '' : 'none';
      p.classList.toggle('active', n === name);
    });
  }
}

function renderContent(pane, content) {
  if (!content || typeof content !== 'object') {
    pane.innerHTML = '<span class="text-muted fst-italic">No content</span>';
    return;
  }
  switch (content.type) {
    case 'table': return renderTable(pane, content.rows);
    case 'json':  return renderJson(pane, content);
    case 'list':  return renderList(pane, content.items);
    case 'error': return renderError(pane, content.message);
    default:
      pane.innerHTML = `<span class="text-muted fst-italic">Unknown content type: ${content.type}</span>`;
  }
}

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
    const val = String(row[col] ?? '');
    td.textContent = val;
    td.title = val;
    tr.appendChild(td);
  });
  return tr;
}

function renderJson(pane, content) {
  pane.className += ' json-tree';
  if (content.url) {
    const urlBar = document.createElement('div');
    urlBar.className = 'mb-2 small text-break';
    const label = document.createElement('span');
    label.className = 'text-muted me-2';
    label.textContent = 'GET';
    const link = document.createElement('a');
    link.href = content.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = content.url;
    urlBar.appendChild(label);
    urlBar.appendChild(link);
    pane.appendChild(urlBar);
  }
  pane.appendChild(renderJsonNode(content.data));
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

function renderList(pane, items) {
  if (!Array.isArray(items) || items.length === 0) {
    pane.innerHTML = '<span class="text-muted fst-italic">No items</span>';
    return;
  }
  const ul = document.createElement('ul');
  ul.className = 'list-group list-group-flush';
  items.forEach(({ name, url }) => {
    const li = document.createElement('li');
    li.className = 'list-group-item px-0';
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = name;
      li.appendChild(a);
    } else {
      li.textContent = name;
    }
    ul.appendChild(li);
  });
  pane.appendChild(ul);
}

function renderError(pane, message) {
  pane.innerHTML = `<div class="alert alert-danger"></div>`;
  pane.querySelector('.alert').textContent = message || 'Error';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

- [ ] **Step 2: Syntax-check the file**

Run:
```bash
node -c public/render.js && echo "render.js syntax OK"
```
Expected output: `render.js syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add public/render.js
git commit -m "feat(ui): add render.js with renderSection and content renderers"
```

---

## Task 2: Create `public/sections.js`

**Files:**
- Create: `public/sections.js`

- [ ] **Step 1: Write the new file**

Create `public/sections.js` with this exact content:

```js
// Section fetchers — each returns Promise<{groups: [{name, tabs: [{name, content}]}]}>.
// Loaded after render.js and before app.js. Calls the existing /api/<section>/...
// routes and transforms each response into the uniform structure.

const FPDB_GROUPS = [
  { group: 'Product', tabs: ['Products', 'Aux Details', 'Categories', 'Related Products'] },
  { group: 'Parts & Colors', tabs: ['Parts', 'Part Colors', 'Parts Locations'] },
  { group: 'Pricing', tabs: ['Prices'] },
  { group: 'Inventory', tabs: ['Inventory', 'Inventory Locations', 'Future Inventory'] },
  { group: 'Packaging', tabs: ['Part Packages', 'Shipping Packages'] },
  { group: 'Configuration', tabs: ['Configurations', 'Config Parts', 'Config Charges'] },
  { group: 'Media', tabs: ['Media', 'Media Class Types'] },
  { group: 'Fulfillment', tabs: ['Promo SKUs', 'Promo Views', 'FOBs'] },
];
const FPS_TAB_ORDER = ['Product', 'Inventory', 'SKU Details', 'Configurations', 'Charges', 'Decorations', 'Templates', 'Quantities', 'Parts', 'Packages'];
const MMS_TAB_ORDER = ['Style', 'Colors', 'SKUs & SUIDs'];
const S3_TAB_ORDER = ['Product', 'Inventory', 'Media Images', 'Media Documents', 'Config'];

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

function errorStructure(message) {
  return {
    groups: [{ name: '', tabs: [{ name: 'Error', content: { type: 'error', message } }] }],
  };
}

async function fetchLinks(match) {
  try {
    const qs = new URLSearchParams();
    if (match.style_id) qs.set('style_id', match.style_id);
    if (match.supplier_name) qs.set('provider', match.supplier_name);
    const params = qs.toString() ? `?${qs.toString()}` : '';
    const data = await fetchJson(`/api/links/${encodeURIComponent(match.product_id)}${params}`);
    const items = Array.isArray(data.links) ? data.links : [];
    return {
      groups: [{
        name: '',
        tabs: [{ name: 'Links', content: { type: 'list', items } }],
      }],
    };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchFpdb(match) {
  try {
    const data = await fetchJson(`/api/fpdb/${encodeURIComponent(match.product_id)}`);
    const allGroupedTabNames = FPDB_GROUPS.flatMap((g) => g.tabs);
    const extras = Object.keys(data).filter((name) => !allGroupedTabNames.includes(name));

    const groupDefs = FPDB_GROUPS.slice();
    if (extras.length > 0) {
      groupDefs.push({ group: 'Other', tabs: extras });
    }

    const groups = groupDefs
      .map(({ group, tabs }) => ({
        name: group,
        tabs: tabs
          .filter((tabName) => tabName in data)
          .map((tabName) => ({
            name: tabName,
            content: { type: 'table', rows: data[tabName] || [] },
          })),
      }))
      .filter((g) => g.tabs.length > 0);

    if (groups.length === 0) {
      return { groups: [{ name: '', tabs: [{ name: 'FPDB', content: { type: 'table', rows: [] } }] }] };
    }
    return { groups };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchFps(match) {
  try {
    const provider = match.supplier_name || '';
    const url = `/api/fps/${encodeURIComponent(match.product_id)}?provider=${encodeURIComponent(provider)}`;
    const data = await fetchJson(url);

    const ordered = FPS_TAB_ORDER.filter((name) => name in data);
    const extras = Object.keys(data).filter((name) => !FPS_TAB_ORDER.includes(name));
    const tabNames = [...ordered, ...extras];

    const tabs = tabNames.map((name) => {
      const entry = data[name] || {};
      return {
        name,
        content: { type: 'json', url: entry.url, data: entry.data },
      };
    });

    return { groups: [{ name: '', tabs }] };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchMms(match) {
  try {
    const data = await fetchJson(`/api/mms/${encodeURIComponent(match.product_id)}`);
    const styles = Array.isArray(data.styles) ? data.styles : [];

    if (styles.length === 0) {
      const emptyTabs = MMS_TAB_ORDER.map((tabName) => ({
        name: tabName,
        content: { type: 'table', rows: [] },
      }));
      return { groups: [{ name: '', tabs: emptyTabs }] };
    }

    const groups = styles.map((s) => ({
      name: `${s.id} — ${s.status}`,
      tabs: MMS_TAB_ORDER.map((tabName) => ({
        name: tabName,
        content: { type: 'table', rows: (s.tabs && s.tabs[tabName]) || [] },
      })),
    }));

    return { groups };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchS3(match) {
  try {
    const provider = match.supplier_name || '';
    const url = `/api/s3/${encodeURIComponent(provider)}/${encodeURIComponent(match.product_id)}`;
    const data = await fetchJson(url);

    const ordered = S3_TAB_ORDER.filter((name) => name in data);
    const extras = Object.keys(data).filter((name) => !S3_TAB_ORDER.includes(name));
    const tabNames = [...ordered, ...extras];

    const tabs = tabNames.map((name) => ({
      name,
      content: { type: 'json', data: data[name] },
    }));

    return { groups: [{ name: '', tabs }] };
  } catch (err) {
    return errorStructure(err.message);
  }
}
```

- [ ] **Step 2: Syntax-check the file**

Run:
```bash
node -c public/sections.js && echo "sections.js syntax OK"
```
Expected output: `sections.js syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add public/sections.js
git commit -m "feat(ui): add sections.js with per-section fetcher + transforms"
```

---

## Task 3: Wire new files, rewrite `showProduct`, delete old code

**Files:**
- Modify: `public/index.html` — add two `<script>` tags.
- Modify: `public/app.js` — delete old fetchers / renderers / constants; rewrite `showProduct`.
- Modify: `public/style.css` — remove the `.nav-pills .nav-link.mms-style-muted` block.

This is the atomic cutover. After this commit, the old functions are gone and the new renderer drives every section.

- [ ] **Step 1: Add `<script>` tags to `public/index.html`**

Find the existing script-tag block near the end of `public/index.html`:
```html
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="app.js"></script>
```

Replace with:
```html
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
  <script src="render.js"></script>
  <script src="sections.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: Normalize the Links section HTML to match the others**

The Links section currently has `#links-content` only. The uniform renderer expects `#links-loading`, `#links-tab-nav`, `#links-tab-content` like every other section.

In `public/index.html`, find:
```html
      <section id="links-section" class="content-section">
        <div id="links-content"></div>
      </section>
```
Replace with:
```html
      <section id="links-section" class="content-section">
        <div id="links-loading" class="d-none">
          <span class="spinner-border spinner-border-sm me-2"></span>Loading links...
        </div>
        <ul id="links-tab-nav" class="nav nav-tabs"></ul>
        <div id="links-tab-content" class="tab-content"></div>
      </section>
```

- [ ] **Step 3: Remove the unused MMS-muted CSS**

In `public/style.css`, find and delete the block:
```css
/* === MMS style pills — muted look for retired/offsite === */
.nav-pills .nav-link.mms-style-muted {
  opacity: 0.55;
  font-style: italic;
}
.nav-pills .nav-link.mms-style-muted.active {
  opacity: 0.85;
}
```

- [ ] **Step 4: Rewrite `public/app.js`**

Replace the entire contents of `public/app.js` with this new, trimmed version. Recents behavior and the lookup flow are preserved; only the rendering/fetcher plumbing is removed.

```js
const form = document.getElementById('lookup-form');
const input = document.getElementById('product-id');
input.addEventListener('focus', () => input.select());
const resultsEl = document.getElementById('results');
const identityContent = document.getElementById('identity-content');
const disambiguationEl = document.getElementById('disambiguation');

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
  // Reset all sections' loading spinner and content areas
  ['fpdb', 'fps', 'mms', 's3', 'links'].forEach((key) => {
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
  saveRecent(match);
  renderRecents();

  const descParts = [];
  if (match.supplier_name) descParts.push(match.supplier_name);
  if (match.product_name) descParts.push(match.product_name);
  if (match.style_id) descParts.push(`Style: ${match.style_id}`);
  identityContent.textContent = descParts.join(' · ');

  renderSection('links', fetchLinks(match));
  renderSection('fpdb',  fetchFpdb(match));
  renderSection('fps',   fetchFps(match));
  renderSection('mms',   fetchMms(match));
  renderSection('s3',    fetchS3(match));
}

// --- Recents (localStorage-backed) ---

const RECENTS_KEY = 'inspector-promo.recent';
const RECENTS_MAX = 10;

function loadRecents() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(match) {
  const entry = {
    product_id: match.product_id,
    supplier_name: match.supplier_name,
    product_name: match.product_name,
    style_id: match.style_id,
  };
  const existing = loadRecents().filter((e) => e.product_id !== entry.product_id);
  const next = [entry, ...existing].slice(0, RECENTS_MAX);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  return next;
}

function renderRecents() {
  const menu = document.getElementById('recents-menu');
  const entries = loadRecents();
  menu.innerHTML = '';
  if (entries.length === 0) {
    const li = document.createElement('li');
    li.innerHTML = '<span class="dropdown-item disabled">No recent lookups</span>';
    menu.appendChild(li);
    return;
  }
  entries.forEach((e) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dropdown-item';
    const parts = [e.product_id];
    if (e.supplier_name) parts.push(e.supplier_name);
    if (e.product_name) parts.push(e.product_name);
    btn.textContent = parts.join(' — ');
    btn.title = btn.textContent;
    btn.addEventListener('click', () => {
      input.value = e.product_id;
      resetResults();
      resultsEl.classList.remove('d-none');
      doLookup(e.product_id);
    });
    li.appendChild(btn);
    menu.appendChild(li);
  });
}

renderRecents();
const mostRecent = loadRecents()[0];
if (mostRecent) {
  input.value = mostRecent.product_id;
  resultsEl.classList.remove('d-none');
  doLookup(mostRecent.product_id);
}
```

Notes on the rewrite:

- `linksContent` is no longer needed as a module-level ref (the Links section now renders into `#links-tab-content` via the renderer). The HTML still contains `#links-content` (inside `#links-section`) but nothing writes to it after the refactor — leaving the element in the HTML is harmless.
- The old `fetchLinks` (list-rendering ad-hoc), `fetchTabbedData`, `fetchGroupedTabbedData`, `fetchMmsData`, `renderMmsStyleTabs`, `MMS_INACTIVE_STATUSES`, `formatStylePillLabel`, `formatStylePillTooltip`, the `MMS_TAB_ORDER` / `FPS_TAB_ORDER` / `S3_TAB_ORDER` / `FPDB_GROUPS` constants (moved to `sections.js`), and `renderTable` / `buildTable` / `buildRow` / `renderJson` / `renderJsonNode` / `escapeHtml` (moved to `render.js`) are all absent from the new `app.js`. The full replace above reflects that.

- [ ] **Step 5: Static grep for leftover references**

Run:
```bash
for f in public/app.js public/sections.js public/render.js; do
  echo "=== $f ==="
  grep -n "fetchTabbedData\|fetchGroupedTabbedData\|fetchMmsData\|renderMmsStyleTabs\|MMS_INACTIVE_STATUSES\|mms-style-muted" "$f" || echo "  (no matches)"
done
```
Expected: every file prints `(no matches)`.

- [ ] **Step 6: Run the test suite**

Run:
```bash
npm test
```
Expected: all tests pass (server tests unchanged).

- [ ] **Step 7: Commit**

```bash
git add public/app.js public/sections.js public/render.js public/index.html public/style.css
git commit -m "refactor(ui): cut over showProduct to renderSection and fetchers"
```

---

## Task 4: Manual end-to-end verification

- [ ] **Step 1: Restart the server**

Run:
```bash
bin/server
```
Expected: `Inspector Promo running at http://localhost:3000`.

- [ ] **Step 2: Look up a known product (e.g. SM-6667)**

In the browser at `http://localhost:3000`:

- Enter `SM-6667`, press Enter.
- Open each left-nav section and verify it renders:
  - **Links** — list of links, same as before.
  - **FPDB** — group pills (Product, Parts & Colors, Pricing, …), each with its sub-tabs and table content; sort-by-column on headers still works.
  - **FPS** — flat tab row (no group pills), JSON tree per tab, and each tab shows the `GET …` URL above the tree (click opens in a new window).
  - **MMS** — one pill per matching style (e.g. 3 pills for SM-6667), tabs `Style / Colors / SKUs & SUIDs` below; clicking a different style pill swaps the sub-tabs and data.
  - **S3** — flat tab row, JSON tree per tab, no URL header.
- Expected: no console errors, no "Unknown content type" messages, no "No data in this group" unless a group really has no data.

- [ ] **Step 3: Error path**

- In another terminal, stop the server (`tmux send-keys -t 2 C-c` or however the server is run).
- In the browser, enter a new product id and press Enter.
- Expected: each section shows an alert-danger box inside its content area with the network error message. Lookup itself (top navbar) shows "Lookup failed: …".
- Restart the server and reload.

- [ ] **Step 4: Recents regression**

- Reload the page. The Recents dropdown pre-fills the input with the most recent entry and auto-runs the lookup.
- Open the Recents dropdown; click an older entry.
- Expected: input updates, lookup runs, all five sections render again.

- [ ] **Step 5: Ambiguous lookup regression**

- Enter an id that has multiple matches (if the dataset has one).
- Expected: navbar shows "Multiple matches — select one:" with buttons. Clicking a button renders that product normally.

- [ ] **Step 6: No commit**

This task is verification only.
