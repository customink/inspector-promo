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
    groupPillNav.className = 'nav nav-pills';
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
