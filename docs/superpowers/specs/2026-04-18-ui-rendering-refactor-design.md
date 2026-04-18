# UI Rendering Refactor — Design

## Goal

Replace today's five section-specific rendering paths in `public/app.js` (`fetchTabbedData`, `fetchGroupedTabbedData`, `fetchMmsData`, `fetchLinks`, plus the MMS-only pill/tab wiring) with a single uniform structure and a single renderer driven by per-section fetchers.

## Motivation

Today each left-nav section has its own rendering code:

- **Links** — ad-hoc list
- **FPDB** — `fetchGroupedTabbedData` with group pills + sub-tabs
- **FPS / S3** — `fetchTabbedData` with flat tabs + JSON trees
- **MMS** — custom `fetchMmsData` with dynamic pills + sub-tabs

These all express the same underlying idea: optional grouping, a set of tabs, renderable content in a few known shapes. The variance is presentational, not structural. A single renderer driven by a uniform data shape removes the per-section boilerplate and makes the Links section (and any future section) easier to extend.

## Terminology

- **Section** — an item in the left nav (`Links`, `FPDB`, `FPS`, `MMS`, `S3`). One section is visible at a time; clicking a left-nav entry swaps which section is shown.
- **Group** — an optional higher-level grouping of tabs within a section. Rendered as a row of nav-pills above the tab row when present.
- **Tab** — a nav-tabs entry within the active group. Each tab has one content payload.
- **Content** — a renderable payload with a type (`table`, `json`, `list`, `error`).

## Uniform structure

Every section fetcher resolves to:

```js
{
  groups: [
    {
      name: string,              // label for the group pill; ignored when only one group is present
      tabs: [
        {
          name: string,           // label for the tab
          content:
            | { type: 'table', rows: Array<Object> }
            | { type: 'json',  url?: string, data: any }
            | { type: 'list',  items: Array<{ name: string, url: string }> }
            | { type: 'error', message: string }
        },
        ...
      ]
    },
    ...
  ]
}
```

Rules:

- **At least one group** is always present. A section with no grouping returns a single group — the renderer sees `groups.length === 1` and omits the group-pill row.
- **At least one tab per group**. Single-tab groups render a one-tab row (no special collapsing).
- **Group name** is used as the group-pill label. When only one group is present the name is ignored (group-pill row is not rendered); sections with a single group may still set any name (empty string is fine).
- **Tab name** is always rendered.

## Section fetcher contract

```js
fetchLinks(match) // → Promise<Structure>
fetchFpdb(match)  // → Promise<Structure>
fetchFps(match)   // → Promise<Structure>
fetchMms(match)   // → Promise<Structure>
fetchS3(match)    // → Promise<Structure>
```

- `match` is the lookup result object (`{ product_id, supplier_name, product_name, style_id }`). Each fetcher picks the fields it needs.
- Fetchers **always resolve** (never reject). On HTTP / network errors, the fetcher resolves with an error structure (see below) and the renderer displays it in the normal content area. Rejections are treated as bugs.
- The fetcher's job is two steps: (1) call the existing `/api/<section>/...` endpoint, (2) transform the server's current response shape into the uniform structure above. **Server routes and response shapes are unchanged.**

### Error resolution

On error, a fetcher resolves with:

```js
{
  groups: [
    {
      name: '',
      tabs: [
        { name: 'Error', content: { type: 'error', message: err.message } }
      ]
    }
  ]
}
```

Same structure — the renderer has no special error branch.

## Renderer

One entry point:

```js
renderSection(sectionKey, promise)
```

- `sectionKey` is one of `'links' | 'fpdb' | 'fps' | 'mms' | 's3'` (maps to the existing DOM ids: `#<key>-loading`, `#<key>-tab-nav`, `#<key>-tab-content`).
- `promise` is the Promise returned by the section's fetcher.

Behavior:

1. Clear `#<key>-tab-nav` and `#<key>-tab-content`; show `#<key>-loading`.
2. Await `promise`.
3. Hide `#<key>-loading`.
4. Build the DOM:
   - If `groups.length > 1`, render a `<ul class="nav nav-pills mb-2">` of group pills (one `<button class="nav-link btn btn-secondary">` per group) at the top of `#<key>-tab-nav`. The first group is active.
   - Render the sub-tabs (`<ul class="nav nav-tabs">`) below it, built from the **active group's** tabs. The first tab is active.
   - Render each tab's content into its `<div class="tab-pane">` inside `#<key>-tab-content`, dispatching on `content.type`:
     - `table` → `renderTable(pane, content.rows)`
     - `json`  → `renderJson(pane, content)`  (uses `content.url` if present, then `content.data`)
     - `list`  → `renderList(pane, content.items)`
     - `error` → `renderError(pane, content.message)`
   - Only the active pane is displayed; others have `style.display = 'none'` (same as today).
5. Clicking a group pill swaps the sub-tab nav and panes to that group's tabs and re-activates its first tab.
6. Clicking a tab within the active group swaps the visible pane.

The renderer never branches on `sectionKey` for behavior — the key is used only to locate DOM targets.

## Content renderers

Kept as small, focused functions. `renderTable` and `renderJson` already exist and are preserved with minor signature tweaks.

```js
renderTable(pane, rows)              // existing; unchanged
renderJson(pane, { url, data })      // existing; now takes the content object so it can read url directly
renderList(pane, items)              // new; builds <ul class="list-group list-group-flush"> from [{ name, url }]
renderError(pane, message)           // new; <div class="alert alert-danger">message</div>
```

`renderList` is the Links list extracted out of today's inlined `fetchLinks` body.

## Client-side transforms — per section

Each fetcher performs a minimal transform from the current server response shape to the uniform structure. Current responses are preserved on the wire.

### Links
Server: `{ links: [{ name, url }] }` or `{ links: [] }`.
Transform:
```js
{
  groups: [
    {
      name: '',
      tabs: [
        {
          name: 'Links',
          content: links.length === 0
            ? { type: 'list', items: [] }
            : { type: 'list', items: links }
        }
      ]
    }
  ]
}
```
(Empty list still goes through `renderList`, which shows a muted "No links configured" placeholder.)

### FPDB
Server: `{ 'Products': rows, 'Parts': rows, ..., 'FOBs': rows }` — flat object keyed by tab name.
Transform uses the existing `FPDB_GROUPS` config to bucket tab names into groups:

```js
{
  groups: FPDB_GROUPS
    .map(({ group, tabs }) => ({
      name: group,
      tabs: tabs
        .filter((tabName) => tabName in data)
        .map((tabName) => ({
          name: tabName,
          content: { type: 'table', rows: data[tabName] },
        })),
    }))
    .filter((g) => g.tabs.length > 0)
}
```
Any data keys not in any `FPDB_GROUPS.tabs` list go into a trailing `{ name: 'Other', tabs: [...] }` group (mirrors current `fetchGroupedTabbedData` behavior).

### FPS
Server: `{ 'Product': { url, data }, 'Inventory': { url, data }, ..., 'Decorations': { url, data } }`.
Transform:
```js
{
  groups: [
    {
      name: '',
      tabs: FPS_TAB_ORDER
        .filter((name) => name in data)
        .concat(Object.keys(data).filter((k) => !FPS_TAB_ORDER.includes(k)))
        .map((name) => ({
          name,
          content: { type: 'json', url: data[name].url, data: data[name].data },
        })),
    },
  ],
}
```

### MMS
Server: `{ millNo, styles: [{ id, status, deployed_at, name, tabs: { Style, Colors, 'SKUs & SUIDs' } }] }`.
Transform:
```js
{
  groups: styles.map((s) => ({
    name: `${s.id} — ${s.status}`,
    tabs: MMS_TAB_ORDER.map((tabName) => ({
      name: tabName,
      content: { type: 'table', rows: s.tabs[tabName] || [] },
    })),
  })),
}
```
If `styles` is empty: returns a single group with the three tabs (Style, Colors, SKUs & SUIDs) each containing `{ type: 'table', rows: [] }`. `renderTable` shows its "No data found" placeholder in each — matches today's behavior and avoids a special empty path.

### S3
Server: `{ 'Product': data, 'Inventory': data, ..., 'Config': data }` — flat object of objects.
Transform:
```js
{
  groups: [
    {
      name: '',
      tabs: S3_TAB_ORDER
        .filter((name) => name in data)
        .concat(Object.keys(data).filter((k) => !S3_TAB_ORDER.includes(k)))
        .map((name) => ({
          name,
          content: { type: 'json', data: data[name] },
        })),
    },
  ],
}
```

## File organization

`public/app.js` is over 700 lines today and will only grow. The refactor splits it into three:

- `public/app.js` — input/form/submit wiring; `resetResults`; recents dropdown; calls the five section fetchers from `showProduct` and hands each promise to `renderSection`.
- `public/sections.js` — the five section fetchers plus the FPDB / FPS / MMS / S3 tab-order constants and the FPDB groups config. Each fetcher does: `fetch(...)` → parse → transform → return the uniform structure. Errors are caught and returned as error structures.
- `public/render.js` — `renderSection`, `renderTable`, `renderJson`, `renderList`, `renderError`, and the JSON-tree recursion. Pure DOM code; no fetching.

Loaded by `public/index.html` in order: `render.js`, `sections.js`, `app.js` (later files can reference earlier ones). No build step introduced.

## Removed from `app.js`

- `fetchTabbedData`
- `fetchGroupedTabbedData`
- `fetchMmsData`
- `renderMmsStyleTabs`
- `formatStylePillLabel`, `formatStylePillTooltip`
- `MMS_INACTIVE_STATUSES`
- Inline FPDB / FPS / MMS / S3 wiring inside `showProduct`

After the refactor, `showProduct` becomes roughly:

```js
function showProduct(match) {
  saveRecent(match);
  renderRecents();

  identityContent.textContent = [match.supplier_name, match.product_name, match.style_id && `Style: ${match.style_id}`]
    .filter(Boolean)
    .join(' · ');

  renderSection('links', fetchLinks(match));
  renderSection('fpdb',  fetchFpdb(match));
  renderSection('fps',   fetchFps(match));
  renderSection('mms',   fetchMms(match));
  renderSection('s3',    fetchS3(match));
}
```

## HTML changes

None. `#<key>-tab-nav` and `#<key>-tab-content` already exist per section. The section-panel structure (`#<key>-loading`, `#<key>-tab-nav`, `#<key>-tab-content`) is uniform today.

## CSS changes

Possible minor additions for the empty-list styling used by `renderList`. The existing `.mms-style-muted` CSS rule can be deleted (muted-pill feature is deferred and removed from MMS in this refactor).

## Testing

- `test/server.test.js` is unchanged — server contracts are preserved.
- Client-side refactor has no automated test harness in this repo (same as prior sessions). Verification is manual in the browser:
  - Links / FPDB / FPS / MMS / S3 all render indistinguishably from pre-refactor.
  - FPDB group pills still work.
  - MMS pills still render one-per-style and swap tabs on click.
  - FPS still shows the GET url above each JSON tree.
  - Error state: kill the server mid-lookup or rename a table to force a 500; confirm the alert appears inside `#<key>-tab-content` via the uniform renderer.

## Out of scope

- Moving the transform to the server (explicit risk review declined this)
- Keyboard / URL-hash / persistence of selected group or tab
- Muted (retired/offsite) styling on MMS pills — the current italic + opacity treatment is deleted as part of this refactor and can be reintroduced later as a group-level attribute
- Expanding Links into multi-tab / multi-group content — iterated on separately
- Tests for the client-side transforms (no JS test harness today)

## Risks

- Regression surface is the entire client rendering layer. Mitigation: move incrementally by section — land `render.js` and `sections.js` with one section cut over, verify, then cut the rest.
- File split via `<script>` tags relies on global function names. Conflicts are unlikely (small codebase) but a grep across files will catch them before landing.
- Any consumer of deleted globals (`fetchTabbedData`, etc.) will silently break. Mitigation: the only caller is `showProduct`; post-refactor grep confirms no stragglers.
