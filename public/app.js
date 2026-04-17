const form = document.getElementById('lookup-form');
const input = document.getElementById('product-id');
const resultsEl = document.getElementById('results');
const identityContent = document.getElementById('identity-content');
const disambiguationEl = document.getElementById('disambiguation');
const linksContent = document.getElementById('links-content');

// Tab ordering config
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
const MMS_TAB_ORDER = ['Style', 'Colors', 'SKUs'];
const S3_TAB_ORDER = ['Product', 'Inventory', 'Media Images', 'Media Documents', 'Config'];

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
  ['fpdb', 'fps', 'mms', 's3'].forEach((key) => {
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

  const productId = match.product_id;
  const styleId = match.style_id;
  const provider = match.supplier_name;

  fetchLinks(productId, styleId, provider);
  fetchGroupedTabbedData('fpdb', productId, 'FPDB', renderTable, FPDB_GROUPS);
  fetchTabbedData('fps', `${productId}?provider=${encodeURIComponent(provider)}`, 'FPS', renderJson, FPS_TAB_ORDER);
  fetchTabbedData('s3', `${provider}/${productId}`, 'S3', renderJson, S3_TAB_ORDER);
  if (styleId) {
    fetchTabbedData('mms', styleId, 'MMS', renderTable, MMS_TAB_ORDER);
  } else {
    document.getElementById('mms-tab-content').innerHTML =
      '<span class="text-muted fst-italic">No style ID available — MMS data requires a style ID</span>';
  }
}

// --- Links ---

async function fetchLinks(productId, styleId, provider) {
  try {
    const qs = new URLSearchParams();
    if (styleId) qs.set('style_id', styleId);
    if (provider) qs.set('provider', provider);
    const params = qs.toString() ? `?${qs.toString()}` : '';
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

// --- Tabbed data fetcher (shared by FPS, MMS, S3) ---

function fetchTabbedData(key, idAndParams, label, renderFn, tabOrder) {
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

      // Order entries: tabOrder first (in order), then any extras
      let entries;
      if (tabOrder) {
        const ordered = tabOrder.filter((name) => name in data).map((name) => [name, data[name]]);
        const extras = Object.entries(data).filter(([name]) => !tabOrder.includes(name));
        entries = [...ordered, ...extras];
      } else {
        entries = Object.entries(data);
      }

      if (entries.length === 0) {
        tabContentEl.innerHTML = `<span class="text-muted fst-italic">No ${label} data</span>`;
        return;
      }

      const panes = {};

      entries.forEach(([name, responseData], idx) => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const btn = document.createElement('button');
        btn.className = `nav-link${idx === 0 ? ' active' : ''}`;
        btn.textContent = name;
        btn.addEventListener('click', () => activateTab(name));
        li.appendChild(btn);
        tabNavEl.appendChild(li);

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

// --- Grouped tabbed data fetcher (for FPDB) ---

function fetchGroupedTabbedData(key, idAndParams, label, renderFn, groups) {
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

      if (Object.keys(data).length === 0) {
        tabContentEl.innerHTML = `<span class="text-muted fst-italic">No ${label} data</span>`;
        return;
      }

      // Build group nav (top row) and sub-tab nav (bottom row)
      const groupNav = document.createElement('ul');
      groupNav.className = 'nav nav-pills justify-content-center';
      tabNavEl.appendChild(groupNav);

      const subTabNav = document.createElement('ul');
      subTabNav.className = 'nav nav-tabs';
      tabNavEl.appendChild(subTabNav);

      const panes = {};
      let activeTab = null;

      // Collect any data keys not in any group
      const allGroupedTabs = groups.flatMap((g) => g.tabs);
      const ungrouped = Object.keys(data).filter((k) => !allGroupedTabs.includes(k));
      const effectiveGroups = [...groups];
      if (ungrouped.length > 0) {
        effectiveGroups.push({ group: 'Other', tabs: ungrouped });
      }

      // Pre-render all panes
      for (const [name, responseData] of Object.entries(data)) {
        const pane = document.createElement('div');
        pane.className = 'tab-pane';
        renderFn(pane, responseData);
        pane.style.display = 'none';
        tabContentEl.appendChild(pane);
        panes[name] = pane;
      }

      function activateGroup(groupDef) {
        // Update group nav
        for (const li of groupNav.children) {
          const btn = li.querySelector('.nav-link');
          btn.classList.toggle('active', btn.textContent === groupDef.group);
        }

        // Rebuild sub-tab nav for this group
        subTabNav.innerHTML = '';
        const availableTabs = groupDef.tabs.filter((t) => t in data);
        let firstActivated = false;

        availableTabs.forEach((name) => {
          const li = document.createElement('li');
          li.className = 'nav-item';
          const btn = document.createElement('button');
          btn.className = 'nav-link';
          btn.textContent = name;
          btn.addEventListener('click', () => activateTab(name));
          li.appendChild(btn);
          subTabNav.appendChild(li);

          if (!firstActivated) {
            btn.classList.add('active');
            activateTab(name);
            firstActivated = true;
          }
        });

        if (!firstActivated) {
          // No tabs with data in this group
          Object.values(panes).forEach((p) => (p.style.display = 'none'));
          tabContentEl.querySelector('.tab-pane-empty')?.remove();
          const empty = document.createElement('div');
          empty.className = 'tab-pane-empty text-muted fst-italic';
          empty.textContent = 'No data in this group';
          tabContentEl.appendChild(empty);
        }
      }

      function activateTab(name) {
        activeTab = name;
        // Update sub-tab buttons
        for (const li of subTabNav.children) {
          const btn = li.querySelector('.nav-link');
          btn.classList.toggle('active', btn.textContent === name);
        }
        // Show/hide panes
        tabContentEl.querySelector('.tab-pane-empty')?.remove();
        Object.entries(panes).forEach(([n, p]) => {
          p.style.display = n === name ? '' : 'none';
          p.classList.toggle('active', n === name);
        });
      }

      // Render group buttons
      effectiveGroups.forEach((groupDef, idx) => {
        const li = document.createElement('li');
        li.className = 'nav-item';
        const btn = document.createElement('button');
        btn.className = `nav-link btn btn-secondary${idx === 0 ? ' active' : ''}`;
        btn.textContent = groupDef.group;
        btn.addEventListener('click', () => activateGroup(groupDef));
        li.appendChild(btn);
        groupNav.appendChild(li);
      });

      // Activate first group
      if (effectiveGroups.length > 0) {
        activateGroup(effectiveGroups[0]);
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
    const val = String(row[col] ?? '');
    td.textContent = val;
    td.title = val;
    tr.appendChild(td);
  });
  return tr;
}

// --- JSON renderer (for FPS) ---

function renderJson(pane, data) {
  pane.className += ' json-tree';

  // Special case: server wraps FPS responses as { url, data }. Show URL on top.
  if (data && typeof data === 'object' && 'url' in data && 'data' in data && Object.keys(data).length === 2) {
    if (data.url) {
      const urlBar = document.createElement('div');
      urlBar.className = 'mb-2 small text-break';
      const label = document.createElement('span');
      label.className = 'text-muted me-2';
      label.textContent = 'GET';
      const link = document.createElement('a');
      link.href = data.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = data.url;
      urlBar.appendChild(label);
      urlBar.appendChild(link);
      pane.appendChild(urlBar);
    }
    pane.appendChild(renderJsonNode(data.data));
    return;
  }

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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
renderRecents();
const mostRecent = loadRecents()[0];
if (mostRecent) {
  input.value = mostRecent.product_id;
  resultsEl.classList.remove('d-none');
  doLookup(mostRecent.product_id);
}
