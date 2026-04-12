# Bootstrap 5 Integration for Inspector Promo

**Date:** 2026-04-11
**Status:** Draft
**Goal:** Replace custom CSS with Bootstrap 5 via CDN to improve development productivity and provide a consistent component vocabulary for AI-assisted development.

## Context

Inspector Promo is a product data lookup tool served by Express with vanilla HTML/CSS/JS. It has ~344 lines of custom CSS covering layout, tables, tabs, navigation, JSON tree rendering, and state classes. Non-engineers run this app locally via `npm start` — there is no build step and we want to keep it that way.

## Decision

**Bootstrap 5 via CDN.** No build step required. Two tags added to `index.html`:
- Bootstrap CSS (`bootstrap.min.css`)
- Bootstrap JS bundle (`bootstrap.bundle.min.js`)

**Why Bootstrap over DaisyUI/Tailwind:**
- Zero configuration — CDN link in HTML, done
- Deepest AI model training data of any CSS framework
- Largest component library covering every UI pattern in the app
- Minimal customization needs make Bootstrap's defaults sufficient
- Non-engineer users never encounter a build step

## Scope

Three files change. No backend changes. No new npm dependencies.

### Files Modified

| File | Change |
|---|---|
| `public/index.html` | Add CDN links, swap class names to Bootstrap equivalents, restructure navbar |
| `public/style.css` | Rewrite from ~344 lines to ~50 lines of overrides |
| `public/app.js` | Update class names on dynamically-created elements |

## Component Mapping

| Current Custom | Bootstrap Replacement |
|---|---|
| Custom `header` flexbox | `navbar navbar-dark` with custom `bg` color |
| `#lookup-form` | `input-group` inside navbar |
| `#identity-content` | `navbar-text` with `badge` elements |
| `#disambiguation` buttons | `btn-group` with `btn-outline-light btn-sm` |
| `#left-nav` vertical buttons | `nav nav-pills flex-column` |
| `.nav-btn.active` | `nav-link active` with accent color override |
| `.tab-nav` horizontal tabs | `nav nav-tabs` |
| `.tab-content` panes | `tab-content` > `tab-pane` |
| `.table-wrap table` | `table table-sm table-hover table-striped` |
| `.table-wrap th` sticky header | Keep `position: sticky` in custom CSS |
| `.error-message` | `alert alert-danger` |
| `.loading` | `spinner-border spinner-border-sm` + text |
| `.no-data` | `text-muted fst-italic` |
| `#links-content ul` | `list-group list-group-flush` |
| `.hidden` | Bootstrap's `d-none` |

## Custom CSS Retained

The rewritten `style.css` (~50 lines) covers only what Bootstrap does not:

1. **Header background color** — `#1a1a2e` (dark navy, not Bootstrap's default dark)
2. **Accent color** — `#e94560` (CustomInk red). Bootstrap 5 doesn't fully propagate `--bs-primary` to all components, so we apply the accent color directly to the components that need it:
   ```css
   .btn-primary { background-color: #e94560; border-color: #e94560; }
   .btn-primary:hover { background-color: #c73e54; border-color: #c73e54; }
   .nav-pills .nav-link.active { background-color: #e94560; }
   .nav-tabs .nav-link.active { color: #e94560; border-bottom-color: #e94560; }
   ```
3. **Full-viewport flex layout** — `body` as `display: flex; flex-direction: column; height: 100vh` with `main` as `flex: 1; overflow: hidden`
4. **Sticky table headers** — `position: sticky; top: 0` on `th` elements
5. **JSON tree renderer** — All `.json-tree` styles (syntax highlighting colors, collapsible toggle, indentation). Bootstrap has no JSON display component.

## HTML Structure Changes

The overall structure stays the same. Key adjustments:

- `<header>` becomes `<nav class="navbar navbar-dark">` with the existing flex layout mapped to Bootstrap's navbar utilities
- `#left-nav` buttons become `<a class="nav-link">` inside a `nav nav-pills flex-column`
- Tab navs become `<ul class="nav nav-tabs">` with `<li class="nav-item">` wrappers
- The `hidden` class usage throughout is replaced with `d-none`

## JavaScript Changes

`app.js` rendering logic is unchanged. Only the CSS class names applied to dynamically-created elements are updated:

- `buildTable()` applies `table table-sm table-hover table-striped` instead of wrapping in `.table-wrap`
- `fetchTabbedData()` creates Bootstrap tab markup (`nav-tabs`, `nav-link`, `tab-pane`)
- Error messages use `alert alert-danger` instead of `.error-message`
- Loading indicators use `spinner-border spinner-border-sm` instead of `.loading`
- Left nav activation uses `active` class on `nav-link` elements (same pattern, different class names)
- `resetResults()` and `showProduct()` use `d-none` instead of `hidden`

## What Does Not Change

- All backend code (Express routes, Redshift queries, FPS proxy, config)
- The JSON tree renderer and its syntax highlighting
- The UX flow (header search, left nav sections, tabbed data, sortable tables)
- Deployment model (`npm start`, no build step)

## Migration Order

1. Add Bootstrap CDN links to `index.html` `<head>` and before `</body>`
2. Update `index.html` markup — swap to Bootstrap class names, restructure navbar
3. Update `app.js` — change class names on dynamically-created elements
4. Rewrite `style.css` — strip to overrides only
5. Test all sections: lookup, disambiguation, links, FPDB tables, FPS JSON tree, MMS tables, tab switching, column sorting
