# Recent Product IDs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remember the last 10 successfully-resolved product lookups in localStorage and surface them as a navbar `Recents` dropdown so the user can re-open any recent product with one click.

**Architecture:** Pure-frontend feature. Storage is browser `localStorage` under key `inspector-promo.recent`. The navbar's `Look Up` submit button is replaced by a Bootstrap 5 dropdown; submission still happens on `Enter`. The `#identity-brand` anchor is removed (the input already shows the typed value). `doLookup()` is refactored to accept an `id` argument so both the form submit and dropdown click go through the same path. A `saveRecent()` call is added in `showProduct()` after successful resolution; the dropdown re-renders at page load and after each save.

**Tech Stack:** Vanilla JS, Bootstrap 5 (already loaded via CDN), browser `localStorage`. No new dependencies. No build step.

**Testing note:** `public/app.js` is loaded as a browser script — there is no existing frontend test harness in this repo. This plan verifies each task manually in the browser with explicit acceptance checks. No automated tests are added.

**Spec:** `docs/superpowers/specs/2026-04-17-recent-product-ids-design.md`

---

## File Structure

- Modify: `public/index.html` (navbar block, lines ~11-21)
- Modify: `public/app.js` (identity/brand references, `resetResults`, `doLookup`, `showProduct`; add new helpers)
- Modify: `public/style.css` (add one rule for dropdown item truncation)

No new files. No server-side changes.

---

## Task 1: Navbar HTML — remove brand and submit button, add Recents dropdown

**Files:**
- Modify: `public/index.html` (navbar block)

- [ ] **Step 1: Update the navbar markup**

Replace the current `<nav>…</nav>` block in `public/index.html` with:

```html
<nav class="navbar navbar-expand navbar-dark">
  <div class="container-fluid gap-3">
    <span id="identity-content" class="navbar-text me-auto"></span>
    <span id="disambiguation" class="navbar-text d-none me-3"></span>
    <form id="lookup-form" class="d-flex gap-2" role="search">
      <input type="text" id="product-id" class="form-control form-control-sm" placeholder="Enter product ID or style ID" autofocus>
    </form>
    <div class="dropdown">
      <button class="btn btn-outline-light btn-sm dropdown-toggle" type="button"
        id="recents-toggle" data-bs-toggle="dropdown" aria-expanded="false">
        Recents
      </button>
      <ul class="dropdown-menu dropdown-menu-end" id="recents-menu"
        aria-labelledby="recents-toggle"></ul>
    </div>
  </div>
</nav>
```

Notes:
- `#identity-brand` anchor is removed.
- `Look Up` submit button is removed (Enter still submits the form).
- `#recents-menu` is an empty `<ul>`; `app.js` fills it on load.
- The dropdown is a sibling of the form (not inside it) so the toggle click does not submit the form.

- [ ] **Step 2: Manual verification**

Start the server: `bin/server`. In the browser at `http://localhost:3000`:
- Expected: navbar shows (empty, centered-left) space, input, then a `Recents` button with a caret.
- Expected: clicking `Recents` opens an empty dropdown menu (it will show nothing — items are added in later tasks).
- Expected: typing an ID and pressing Enter still performs a lookup (existing flow).
- Expected: no console errors.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat(ui): replace submit button with Recents dropdown shell"
```

---

## Task 2: CSS — truncate long dropdown items

**Files:**
- Modify: `public/style.css`

- [ ] **Step 1: Append the truncation rule**

Add at the end of `public/style.css`:

```css
/* === Recents dropdown === */
#recents-menu .dropdown-item {
  max-width: 420px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 2: Manual verification**

Reload the page. No visible change yet (menu is empty). Expected: no console errors, no CSS parse warnings in devtools.

- [ ] **Step 3: Commit**

```bash
git add public/style.css
git commit -m "feat(ui): truncate long Recents dropdown items"
```

---

## Task 3: Remove dead `identityBrand` references from app.js

**Files:**
- Modify: `public/app.js` (top-of-file constants and `resetResults`, `showProduct`)

Context: the `#identity-brand` element no longer exists after Task 1. Leaving the `getElementById` call returns `null`, and the subsequent `.textContent = ''` assignment throws. We must remove all references before reloading the page.

- [ ] **Step 1: Remove the `identityBrand` constant**

In `public/app.js`, delete this line (near the top of the file):

```js
const identityBrand = document.getElementById('identity-brand');
```

- [ ] **Step 2: Remove the `identityBrand.textContent = ''` line from `resetResults`**

Inside `resetResults()`, delete the line:

```js
identityBrand.textContent = '';
```

Keep the rest of `resetResults` unchanged.

- [ ] **Step 3: Remove the brand assignment from `showProduct`**

Inside `showProduct(match)`, delete the line:

```js
identityBrand.textContent = match.product_id;
```

Keep the `descParts` / `identityContent.textContent` block and everything after it.

- [ ] **Step 4: Manual verification**

Reload the page and do a lookup (e.g., a known product ID).
- Expected: no `TypeError: Cannot read properties of null …` in the console.
- Expected: `identityContent` in the navbar shows `supplier_name · product_name · Style: …` as before.
- Expected: the input still contains whatever the user typed.

- [ ] **Step 5: Commit**

```bash
git add public/app.js
git commit -m "refactor: drop identity-brand references after navbar cleanup"
```

---

## Task 4: Add localStorage helpers

**Files:**
- Modify: `public/app.js` (append helpers near the bottom, before `escapeHtml`)

- [ ] **Step 1: Add the constants and helper functions**

Insert this block in `public/app.js` just above the `function escapeHtml(str) { … }` definition:

```js
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
```

Note: the click handler mirrors the form submit handler (`resetResults()` + reveal results + `doLookup`). This keeps behavior identical whether a user types or clicks.

- [ ] **Step 2: Manual verification (seed via devtools, no wiring yet)**

Reload the page. Open devtools console and run:

```js
localStorage.setItem('inspector-promo.recent', JSON.stringify([
  { product_id: 'TEST-1', supplier_name: 'sanmar', product_name: 'Test Shirt', style_id: 'S1' },
  { product_id: 'TEST-2', supplier_name: 'alphabroder', product_name: 'Other Item', style_id: null },
]));
renderRecents();
```

- Expected: clicking `Recents` shows two items: `TEST-1 — sanmar — Test Shirt` and `TEST-2 — alphabroder — Other Item`.
- Expected: clicking `TEST-1` puts `TEST-1` in the input and triggers a lookup against the real backend (will likely 404 — that's fine, we're verifying the click path, not the backend).
- Clean up: `localStorage.removeItem('inspector-promo.recent'); renderRecents();` — dropdown should now show `No recent lookups`.

- [ ] **Step 3: Commit**

```bash
git add public/app.js
git commit -m "feat: add Recents localStorage helpers and render function"
```

---

## Task 5: Wire save + render into the lookup flow

**Files:**
- Modify: `public/app.js` (`showProduct`, plus a final page-load call)

- [ ] **Step 1: Call `saveRecent` + `renderRecents` inside `showProduct`**

In `public/app.js`, inside `showProduct(match)`, add two lines at the top of the function body (before the existing `descParts` code):

```js
function showProduct(match) {
  saveRecent(match);
  renderRecents();
  // existing code below:
  const descParts = [];
  if (match.supplier_name) descParts.push(match.supplier_name);
  // …
}
```

- [ ] **Step 2: Render the dropdown once on page load**

At the very bottom of `public/app.js`, add:

```js
renderRecents();
```

- [ ] **Step 3: Manual verification — fresh flow end-to-end**

Clean up any seed data from Task 5: `localStorage.removeItem('inspector-promo.recent')` in devtools, then reload.

- Open `Recents`. Expected: `No recent lookups`.
- Look up a real product (e.g., a known sanmar ID).
- Open `Recents`. Expected: one item — `<product_id> — <supplier> — <product_name>`.
- Look up a second distinct product.
- Open `Recents`. Expected: two items; the most-recent one is on top.
- Re-look-up the first product (same ID).
- Open `Recents`. Expected: that ID moves to the top; total count stays at 2 (dedupe by product_id).
- Click the second entry. Expected: input becomes that product_id, lookup runs, tabs render as normal.
- In devtools, look at `localStorage.getItem('inspector-promo.recent')`. Expected: valid JSON with two entries in order (most recent first), each having `product_id`, `supplier_name`, `product_name`, `style_id`.

- [ ] **Step 4: Manual verification — cap at 10**

In devtools, seed 11 entries:

```js
const seed = Array.from({ length: 11 }, (_, i) => ({
  product_id: `CAP-${i}`, supplier_name: 'x', product_name: `P${i}`, style_id: null,
}));
localStorage.setItem('inspector-promo.recent', JSON.stringify(seed));
renderRecents();
```

- Expected: dropdown shows 10 items.
- Now look up a real product (adds 1 → total 11 → trimmed to 10).
- Expected: still 10 items; `CAP-10` (the last of the seed) is gone; new entry is on top.

- [ ] **Step 5: Manual verification — failed lookup does NOT save**

`localStorage.removeItem('inspector-promo.recent'); renderRecents();`

Submit an obviously-invalid ID (e.g., `ZZZZZZZZZ`). Expected: navbar shows "No product found for this ID." Open `Recents`. Expected: still `No recent lookups` (the failed branch never calls `showProduct`).

- [ ] **Step 6: Commit**

```bash
git add public/app.js
git commit -m "feat: save lookups to Recents dropdown on success"
```

---

## Task 6: Final end-to-end walkthrough

- [ ] **Step 1: Close and reopen the browser tab**

Ensure `bin/server` is still running. Open `http://localhost:3000` in a fresh tab.

- Expected: `Recents` dropdown opens to show the entries that were there before the tab was closed (localStorage survives).

- [ ] **Step 2: Private / incognito window check**

Open `http://localhost:3000` in a private window.

- Expected: `Recents` shows `No recent lookups` (private localStorage is isolated). Do a lookup — it adds an entry in the private window's storage but does not affect the main window.

- [ ] **Step 3: Confirm no regressions**

In the main window:
- Looking up by style_id still works and populates Recents with the resolved product_id.
- Ambiguous lookups still show disambiguation buttons; clicking one still saves to Recents (it flows through `showProduct`).
- The left nav (Links / FPDB / FPS / MMS / S3) still switches sections.

- [ ] **Step 4: Nothing to commit**

This task is verification only; no code changes.
