# S3 Raw Data Section — Design Spec

## Problem

The raw supplier data files in S3 (before FPS processing) are useful for investigating product issues, but accessing them requires knowing the bucket structure, constructing paths manually, and running AWS CLI commands. Inspector Promo should surface this data alongside the other views.

## Solution

Add an "S3" section to the left nav that fetches and displays the raw JSON files from the `datafuse-promo-standards` S3 bucket for a given product.

## S3 Bucket Structure

```
s3://datafuse-promo-standards/{provider}/
├── products/{product_id}.json
├── inventory/{product_id}-inventory.json
├── media/{product_id}-image.json
├── media/{product_id}-document.json
└── configs/{product_id}-config.json
```

Provider names in S3 match the `provider_name` from FPDB (e.g., `hitpromo`, `pcna`, `gemline`).

## Backend

New route: `GET /api/s3/:provider/:productId`

- For each file type defined in `config.s3Files`, constructs the S3 path and fetches via `aws s3 cp - -` (streams to stdout)
- Uses `child_process.execFile` to shell out to `aws` CLI
- Fetches all files in parallel
- Returns JSON keyed by file type name: `{ "Product": {...}, "Inventory": {...}, ... }`
- If a file doesn't exist or the command fails, that key gets `{ error: "message" }`
- Individual file failures don't block other files

## Config

New `s3Files` array in `config.js`:

```js
s3Bucket: 'datafuse-promo-standards',
s3Files: [
  { name: 'Product', path: 'products/{id}.json' },
  { name: 'Inventory', path: 'inventory/{id}-inventory.json' },
  { name: 'Media Images', path: 'media/{id}-image.json' },
  { name: 'Media Documents', path: 'media/{id}-document.json' },
  { name: 'Config', path: 'configs/{id}-config.json' },
],
```

## Frontend

- New "S3" button in left nav (after MMS)
- New `s3-section` in the content area with the same tab structure as FPS
- Uses existing `fetchTabbedData` with `renderJson` — five tabs, each showing a collapsible JSON tree
- S3 endpoint called with provider from the lookup result: `/api/s3/{provider}/{productId}`
- All files fetched in parallel on section load

## Auth

Relies on the user's existing AWS CLI credentials (SSO or otherwise) being active in the shell environment where the server is started. No additional auth handling in the app. If credentials are expired, the error message from `aws` surfaces in each tab.

## Limitations

- Engineer-only: requires AWS CLI access and active credentials
- No caching: fetches from S3 on every request
