# Recent Product IDs — Design

## Goal

Remember the last 10 successfully-resolved product lookups and surface them as a dropdown in the navbar so the user can re-open any recent product with one click.

## UI

### Navbar changes (`public/index.html`)

- Remove the `Look Up` submit button. `Enter` already submits the form.
- Remove the `#identity-brand` anchor. The input retains the user's typed value, so the brand duplicates it.
- Add a `Recents` dropdown button to the navbar, immediately after the `#lookup-form` element (sibling, not a child — so it is not treated as form content):

```html
<div class="dropdown">
  <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button"
    id="recents-toggle" data-bs-toggle="dropdown" aria-expanded="false">
    Recents
  </button>
  <ul class="dropdown-menu dropdown-menu-end" id="recents-menu"
    aria-labelledby="recents-toggle"></ul>
</div>
```


### Dropdown items

- Each item: a `<button class="dropdown-item">` whose text is `product_id — supplier_name — product_name`.
- Long product names truncate via CSS (`text-overflow: ellipsis`, max-width ~420px). Title attribute shows the full string on hover.
- Empty state: a single `<li><span class="dropdown-item disabled">No recent lookups</span></li>`.

### Click behavior

Clicking a recent item:

1. Sets `#product-id` input value to the entry's `product_id`.
2. Calls `doLookup(product_id)` directly (matches the full-lookup path — resets results, shows spinner, renders tabs).

## Storage

- **Key:** `inspector-promo.recent`
- **Value:** JSON-encoded array of entries, newest first.
- **Entry shape:**
  ```js
  { product_id, supplier_name, product_name, style_id }
  ```
  `style_id` is stored so a re-lookup has the same data we'd get from a direct resolution (useful if later we want to pre-fill or skip disambiguation — for now only `product_id` is read back).
- **Max length:** 10. Overflow is trimmed from the tail.
- **Dedupe:** by `product_id`. If the resolved product_id already exists in the list, the existing entry is removed before unshifting the new one — effectively "move to top with fresh data".

## Implementation (`public/app.js`)

Three small helpers:

```js
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
      doLookup(e.product_id);
    });
    li.appendChild(btn);
    menu.appendChild(li);
  });
}
```

### Wiring

- Call `renderRecents()` once at the bottom of `app.js` during page load.
- Inside `showProduct(match)`: after the existing identity/content rendering, call `saveRecent(match)` then `renderRecents()`.
- `doLookup()` currently pulls the id from the input; refactor it to accept an `id` argument (callable from both form submit and recents click). Form submit passes `input.value.trim()`.

### CSS (`public/style.css`)

```css
#recents-menu .dropdown-item {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## Out of scope

- Clear-all / remove-one controls
- Search within recents
- Grouping by provider
- Export/import
- Syncing across browsers/devices (no auth in app; localStorage is per-origin)

## Risks and notes

- **Private/incognito windows:** localStorage is cleared on window close. Acceptable for a dev tool.
- **Failed / ambiguous lookups:** not saved. Ambiguous disambiguation that leads to a picked match *does* save (because the user-picked branch still calls `showProduct`).
- **Origin scoping:** `localhost:3000` storage is distinct from any other port. If the port ever changes, recents reset.
