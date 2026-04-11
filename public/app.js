const form = document.getElementById('lookup-form');
const input = document.getElementById('product-id');
const resultsEl = document.getElementById('results');
const identityContent = document.getElementById('identity-content');
const disambiguationEl = document.getElementById('disambiguation');
const linksContent = document.getElementById('links-content');

// Left nav
const navButtons = document.querySelectorAll('.nav-btn');
const sections = document.querySelectorAll('.content-section');

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    navButtons.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    sections.forEach((s) => s.classList.add('hidden'));
    document.getElementById(`${btn.dataset.section}-section`).classList.remove('hidden');
  });
});

// Form submit
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = input.value.trim();
  if (!id) return;
  resetResults();
  resultsEl.classList.remove('hidden');
  await doLookup(id);
});

function resetResults() {
  identityContent.innerHTML = '';
  disambiguationEl.innerHTML = '';
  disambiguationEl.classList.add('hidden');
  linksContent.innerHTML = '';
  // Reset all tabbed sections
  ['fpdb', 'fps', 'mms'].forEach((key) => {
    document.getElementById(`${key}-loading`).classList.add('hidden');
    document.getElementById(`${key}-tab-nav`).innerHTML = '';
    document.getElementById(`${key}-tab-content`).innerHTML = '';
  });
  // Reset nav to Links
  navButtons.forEach((b) => b.classList.remove('active'));
  navButtons[0].classList.add('active');
  sections.forEach((s) => s.classList.add('hidden'));
  sections[0].classList.remove('hidden');
}

async function doLookup(id) {
  identityContent.innerHTML = '<span class="loading">Looking up...</span>';
  try {
    const res = await fetch(`/api/lookup/${encodeURIComponent(id)}`);
    const data = await res.json();

    if (!data.found) {
      identityContent.innerHTML = '<span class="error-message">No product found for this ID.</span>';
      return;
    }

    if (data.ambiguous) {
      identityContent.innerHTML = '<span>Multiple matches — select one:</span>';
      disambiguationEl.classList.remove('hidden');
      disambiguationEl.innerHTML = '';
      data.matches.forEach((match) => {
        const btn = document.createElement('button');
        btn.textContent = `${match.product_id} — ${match.supplier_name}`;
        btn.addEventListener('click', () => {
          disambiguationEl.classList.add('hidden');
          showProduct(match);
        });
        disambiguationEl.appendChild(btn);
      });
      return;
    }

    showProduct(data.match);
  } catch (err) {
    identityContent.innerHTML = `<span class="error-message">Lookup failed: ${err.message}</span>`;
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
      '<span class="no-data">No style ID available — MMS data requires a style ID</span>';
  }
}

// --- Links ---

async function fetchLinks(productId, styleId) {
  try {
    const params = styleId ? `?style_id=${encodeURIComponent(styleId)}` : '';
    const res = await fetch(`/api/links/${encodeURIComponent(productId)}${params}`);
    const data = await res.json();
    if (!data.links || data.links.length === 0) {
      linksContent.innerHTML = '<span class="no-data">No links configured</span>';
      return;
    }
    const ul = document.createElement('ul');
    data.links.forEach(({ name, url }) => {
      const li = document.createElement('li');
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
    linksContent.innerHTML = `<span class="error-message">Failed to load links: ${err.message}</span>`;
  }
}

// --- Tabbed data fetcher (shared by FPDB, FPS, MMS) ---

function fetchTabbedData(key, idAndParams, label, renderFn) {
  const loadingEl = document.getElementById(`${key}-loading`);
  const tabNavEl = document.getElementById(`${key}-tab-nav`);
  const tabContentEl = document.getElementById(`${key}-tab-content`);

  loadingEl.classList.remove('hidden');
  tabNavEl.innerHTML = '';
  tabContentEl.innerHTML = '';

  // idAndParams may contain query string already (e.g. "ABC123?provider=foo")
  const url = `/api/${key}/${idAndParams}`;

  fetch(url)
    .then((res) => res.json())
    .then((data) => {
      loadingEl.classList.add('hidden');

      if (data.error) {
        tabContentEl.innerHTML = `<span class="error-message">${label} error: ${data.error}</span>`;
        return;
      }

      const entries = Object.entries(data);
      if (entries.length === 0) {
        tabContentEl.innerHTML = `<span class="no-data">No ${label} data</span>`;
        return;
      }

      const panes = {};

      entries.forEach(([name, responseData], idx) => {
        // Tab button
        const btn = document.createElement('button');
        btn.textContent = name;
        btn.addEventListener('click', () => activateTab(name));
        if (idx === 0) btn.classList.add('active');
        tabNavEl.appendChild(btn);

        // Pane
        const pane = document.createElement('div');
        renderFn(pane, responseData);
        if (idx !== 0) pane.style.display = 'none';
        tabContentEl.appendChild(pane);
        panes[name] = pane;
      });

      function activateTab(name) {
        for (const b of tabNavEl.children) {
          b.classList.toggle('active', b.textContent === name);
        }
        Object.entries(panes).forEach(([n, p]) => {
          p.style.display = n === name ? '' : 'none';
        });
      }
    })
    .catch((err) => {
      loadingEl.classList.add('hidden');
      tabContentEl.innerHTML = `<span class="error-message">Failed to load ${label} data: ${err.message}</span>`;
    });
}

// --- Table renderer (for FPDB and MMS) ---

function renderTable(pane, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    pane.innerHTML = '<span class="no-data">No data found</span>';
    return;
  }
  pane.appendChild(buildTable(rows));
}

function buildTable(rows) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';

  const table = document.createElement('table');
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
  pane.className = 'json-tree';
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
