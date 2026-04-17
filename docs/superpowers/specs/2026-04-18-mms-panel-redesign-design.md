# MMS Panel Redesign — Design

## Goal

Rework the MMS panel so it is keyed by `product_id` (via `mms_styles.mill_no` match) instead of by `style_id`, surfaces a single "best" matching style (most-recently deployed among `active`/`inactive`/`preview`), flags the existence of other matches with a warning emoji on the left-nav MMS button, and shows the engineer-relevant hierarchy: **Style**, **Colors**, **SKUs & SUIDs**.

## Motivation

The current MMS tab requires an FPDB-derived `style_id`, which is often absent. Engineers using the inspector to diagnose a product rarely have a style_id handy; they have the supplier's product_id. MMS styles are keyed on `mill_no`, which in practice equals the product_id for the products this tool covers. A product can have multiple MMS styles (variants by decoration method); in our working set, one is usually primary, so v1 picks one and flags any others.

## Data model (from `mms/db/schema.rb`)

```
mms_styles      (id, mill_no, name, status, deployed_at, product_id, ...)
  └─ mms_colors (id, style_id, name, status, pricing_group_id, ...)
       └─ mms_sizes (id, color_id, name, gtin, position, status,
                     in_stock, last_known_supplier_quantity, oos_threshold)
            └─ mms_supplier_unique_ids (size_id, supplier_id, uid, part_group)
  └─ mms_skus   (style_id, color_id, size_id AS NAME-STRING, status)
```

Important gotcha: `mms_skus.size_id` is a **string holding the size name**, not a FK. The link to `mms_sizes` is `(color_id, UPPER(size name))`. Each `(style_id, color_id, size_name)` is unique → a SKU is effectively 1:1 with a size; SKU contributes only its own `status` field. SUIDs are N-per-size (one per supplier).

## Style selection rule

```sql
SELECT ...
  FROM rawdata.mms_styles
 WHERE mill_no = $1
   AND status IN ('active','inactive','preview')
 ORDER BY deployed_at DESC NULLS LAST, id ASC
 LIMIT 1;
```

- "Active" = `status IN ('active','inactive','preview')`.
- Tiebreaker: most-recently deployed; `id ASC` is a deterministic fallback when `deployed_at` ties/null.
- Anything outside that status set is considered **ineligible** — surfaced in the warning summary but not selected and not drilled into.

## API

### Endpoint

`GET /api/mms/:product_id`

Replaces the existing `GET /api/mms/:id` (which took a style_id). No backward-compatibility shim — the single frontend caller is updated in the same change.

### Response shape

```json
{
  "Style":        [ { "id": 12345, "name": "...", "mill_no": "SS4500", "status": "active", "deployed_at": "...", ... } ],
  "Colors":       [ { "id": 1, "style_id": 12345, "name": "Red", "status": "active", ... }, ... ],
  "SKUs & SUIDs": [ { "color_name": "Red", "color_id": 1, "size_id": 100, "size_name": "M", "position": 3,
                      "sku_status": "active", "size_status": "active",
                      "gtin": "0001234567890", "in_stock": true,
                      "last_known_supplier_quantity": 42, "oos_threshold": 10,
                      "supplier_id": 99, "uid": "SM-RED-M", "part_group": null }, ... ],
  "_meta": {
    "millNo": "SS4500",
    "otherMatches":      [ { "id": 12346, "name": "...", "status": "preview", "deployed_at": "2026-02-01" }, ... ],
    "ineligibleMatches": [ { "id": 12000, "name": "...", "status": "retired",  "deployed_at": "2024-07-01" }, ... ]
  }
}
```

- `Style`, `Colors`, `SKUs & SUIDs` are all arrays shaped for the existing `renderTable`. `Style` has 0 or 1 rows.
- When no style qualifies: `Style = []`, `Colors = []`, `SKUs & SUIDs = []`, `_meta.otherMatches = []`; `_meta.ineligibleMatches` may still be populated.
- `_meta.otherMatches` contains eligible matches **other than the selected one** (same status filter, same mill_no).
- `_meta.ineligibleMatches` lists retired/offsite/anything-else matches on the same mill_no.

### SQL

Four queries, run in parallel per request (all scoped by the server to one product_id).

```sql
-- 1. selected_style (0..1 row)
SELECT id, name, manufacturer, mill_no, status,
       decoration_method, brand, brand_type, style_type,
       price_level, min_qty, color_limit,
       material, features, sizing, sizes,
       allow_blank, fitted, specialty, sponsorship,
       has_lineup, has_singles_enabled_colors, ihp_bulk_enabled,
       individual_ship_eligible, international_ship_eligible,
       deploy_type, role, unit_of_measure, quantity_per_unit,
       standard_decoration_days, rush_decoration_days,
       created_at, updated_at, deployed_at, retired_at
  FROM rawdata.mms_styles
 WHERE mill_no = $1
   AND status IN ('active','inactive','preview')
 ORDER BY deployed_at DESC NULLS LAST, id ASC
 LIMIT 1;

-- 2. other_matches_summary — eligible but not selected
SELECT id, name, status, deployed_at
  FROM rawdata.mms_styles
 WHERE mill_no = $1
   AND status IN ('active','inactive','preview')
 ORDER BY deployed_at DESC NULLS LAST, id ASC
 OFFSET 1 LIMIT 20;

-- 3. ineligible_matches — everything else on same mill_no
SELECT id, name, status, deployed_at
  FROM rawdata.mms_styles
 WHERE mill_no = $1
   AND status NOT IN ('active','inactive','preview')
 ORDER BY deployed_at DESC NULLS LAST, id ASC
 LIMIT 20;

-- 4. colors_and_skus_suids — everything below the selected style
-- (run after #1 resolves; needs selected.id)
SELECT c.id AS color_id, c.name AS color_name, c.status AS color_status,
       sz.id AS size_id, sz.name AS size_name, sz.position,
       sz.status AS size_status, sz.gtin, sz.in_stock,
       sz.last_known_supplier_quantity, sz.oos_threshold,
       sk.status AS sku_status,
       u.supplier_id, u.uid, u.part_group
  FROM rawdata.mms_colors c
  JOIN rawdata.mms_sizes  sz ON sz.color_id = c.id
  LEFT JOIN rawdata.mms_skus sk
    ON sk.style_id = c.style_id
   AND sk.color_id = c.id
   AND UPPER(sk.size_id) = UPPER(sz.name)
  LEFT JOIN rawdata.mms_supplier_unique_ids u
    ON u.size_id = sz.id
 WHERE c.style_id = $2
 ORDER BY c.name, sz.position, u.supplier_id
 LIMIT 500;

-- 5. colors — flat color list for the Colors tab
SELECT id, style_id, name, status, pricing_group_id, mill_no,
       branding_method, realb, singles_price, singles_enabled,
       abo_enabled, dtg_enabled, inventory_enabled,
       deploy_type, suppliers, deployed_at, retired_at,
       created_at, updated_at
  FROM rawdata.mms_colors
 WHERE style_id = $2
 ORDER BY name
 LIMIT 500;
```

The server issues #1, #2, #3 in parallel. Once #1 resolves, if it returned a row the server issues #4 and #5 in parallel using `selected.id` as `$2`. If #1 returned no row, #4 and #5 are skipped and their response values are `[]`.

The `Colors` tab and the `SKUs & SUIDs` tab come from different queries (#5 and #4 respectively) — each optimized for its own shape.

## UI

### Left nav warning emoji

The static left nav button markup in `public/index.html`:

```html
<button class="nav-link btn active" data-section="mms">MMS</button>
```

After an MMS fetch resolves:

- If `_meta.otherMatches.length + _meta.ineligibleMatches.length > 0`:
  - Set button text to `MMS ⚠️`
  - Set `title="..."` to a concise summary, for example:
    `"1 other eligible match — 12346: Heavyweight Tee (preview, 2026-02-01). 2 ineligible — 12000: Legacy (retired, 2024-07-01); 11999: Old (offsite, 2023-05-14)."`
- Else:
  - Text back to `MMS`, remove `title`.

Summary format rules:

- Up to 5 entries from each list are rendered; a `+N more` suffix is appended if truncated.
- Each entry: `id: name (status, YYYY-MM-DD)`. Deployed_at is rendered as a date only (no time).
- The title string is plain text. No HTML — this is a native browser tooltip.

### Three tabs (existing `nav-tabs` pattern)

Populated from the response:

- **Style** — `renderTable` on a 0..1-row array; each response field becomes a column.
- **Colors** — `renderTable` on the color rows.
- **SKUs & SUIDs** — `renderTable` on the joined rows. Because a size may have multiple SUIDs, size columns repeat across SUID rows for that size; engineers can sort by any column (supplier_id, uid, size, color, in_stock, etc.).

No banner inside the panel. The only cross-cutting signal is the nav emoji + tooltip.

### Client wiring

New `fetchMmsData(productId)` function in `public/app.js` replaces the current `fetchTabbedData('mms', styleId, 'MMS', renderTable, MMS_TAB_ORDER)` call. Behavior:

1. Show the existing `#mms-loading` spinner; clear `#mms-tab-nav` and `#mms-tab-content`.
2. `fetch('/api/mms/' + encodeURIComponent(productId))`.
3. On success:
   - Extract `_meta`; update the left-nav MMS button (text + title).
   - Delete `_meta` from the response.
   - For each of `['Style', 'Colors', 'SKUs & SUIDs']`, build a nav tab button + pane and render with `renderTable`.
   - Activate the first tab.
4. On HTTP/network error or `{ error: '...' }` response: show `<div class="alert alert-danger">…</div>` in `#mms-tab-content`; clear any warning on the MMS nav button.

`MMS_TAB_ORDER` constant updates from `['Style', 'Colors', 'SKUs']` to `['Style', 'Colors', 'SKUs & SUIDs']` (only used by `fetchMmsData` now; no other caller).

`showProduct(match)`: the `if (styleId) { fetchTabbedData('mms', ...) } else { "No style ID available" }` branch is removed; replaced with an unconditional `fetchMmsData(match.product_id)`.

### Reset

`resetResults()` gains one extra line: reset the MMS nav button text to `MMS` and clear its `title` attribute. This prevents a stale warning from persisting across lookups.

## Files

- `config.js` — drop `mmsQueries`; add `mmsSelectedStyleSql`, `mmsOtherMatchesSql`, `mmsIneligibleMatchesSql`, `mmsColorsSql`, `mmsSkusSuidsSql` (and update `mmsTabOrder`).
- `server.js` — rewrite `app.get('/api/mms/:id', ...)` into `app.get('/api/mms/:product_id', ...)`, running the 5 queries as above and building the response shape.
- `public/app.js` — add `fetchMmsData`; remove the old MMS call path from `showProduct`; reset nav button in `resetResults`.
- `public/index.html` — no change.
- `public/style.css` — no change (native title tooltip; emoji inline in button text).

## Error handling

- If the Redshift pool throws on any query, return HTTP 500 with `{ error: err.message }`.
- If the query pattern returns no rows for `selected_style`, that's not an error — the response contains empty arrays and (possibly) `_meta.ineligibleMatches`.
- If `ineligibleMatches` is also empty (nothing anywhere on that mill_no), the panel is fully empty with no warning — accurate ("no MMS presence for this product").

## Out of scope (v2+)

- Switching to an "other match" from the warning (requires new UI affordance).
- Rendering the MMS `products` record (name, key_benefits) above the tabs.
- Displaying `style_categories`, `style_filter_taggings`, `sizing_charts`, or `turntimes`.
- Search-within-panel or column-filtering beyond the existing sortable headers.
- Pagination UI; hard `LIMIT 500` on colors+sizes+suids is the safety net for now.
