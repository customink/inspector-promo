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
  const parts = [`<b>${match.product_id}</b>`];
  if (match.supplier_name) parts.push(match.supplier_name);
  if (match.product_name) parts.push(match.product_name);
  if (match.style_id) parts.push(`Style: ${match.style_id}`);
  identityContent.innerHTML = parts.join(' &middot; ');

  const productId = match.product_id;
  const styleId = match.style_id;
  const provider = match.supplier_name;

  fetchLinks(productId, styleId, provider);
  fetchTabbedData('fpdb', productId, 'FPDB', renderTable);
  fetchTabbedData('fps', `${productId}?provider=${encodeURIComponent(provider)}`, 'FPS', renderJson);
  fetchTabbedData('s3', `${provider}/${productId}`, 'S3', renderJson);
  if (styleId) {
    fetchTabbedData('mms', styleId, 'MMS', renderTable);
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

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
