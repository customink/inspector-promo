// Section fetchers — each returns Promise<{groups: [{name, tabs: [{name, content}]}]}>.
// Loaded after render.js and before app.js. Calls the existing /api/<section>/...
// routes and transforms each response into the uniform structure.

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
const MMS_TAB_ORDER = ['Style', 'Colors', 'SKUs & SUIDs'];
const S3_TAB_ORDER = ['Product', 'Inventory', 'Media Images', 'Media Documents', 'Config'];

async function fetchJson(url) {
  const res = await fetch(url);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

function errorStructure(message) {
  return {
    groups: [{ name: '', tabs: [{ name: 'Error', content: { type: 'error', message } }] }],
  };
}

async function fetchLinks(match) {
  try {
    const qs = new URLSearchParams();
    if (match.style_id) qs.set('style_id', match.style_id);
    if (match.supplier_name) qs.set('provider', match.supplier_name);
    const params = qs.toString() ? `?${qs.toString()}` : '';
    const data = await fetchJson(`/api/links/${encodeURIComponent(match.product_id)}${params}`);
    const items = Array.isArray(data.links) ? data.links : [];
    return {
      groups: [{
        name: '',
        tabs: [{ name: 'Links', content: { type: 'list', items } }],
      }],
    };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchFpdb(match) {
  try {
    const data = await fetchJson(`/api/fpdb/${encodeURIComponent(match.product_id)}`);
    const allGroupedTabNames = FPDB_GROUPS.flatMap((g) => g.tabs);
    const extras = Object.keys(data).filter((name) => !allGroupedTabNames.includes(name));

    const groupDefs = FPDB_GROUPS.slice();
    if (extras.length > 0) {
      groupDefs.push({ group: 'Other', tabs: extras });
    }

    const groups = groupDefs
      .map(({ group, tabs }) => ({
        name: group,
        tabs: tabs
          .filter((tabName) => tabName in data)
          .map((tabName) => ({
            name: tabName,
            content: { type: 'table', rows: data[tabName] || [] },
          })),
      }))
      .filter((g) => g.tabs.length > 0);

    if (groups.length === 0) {
      return { groups: [{ name: '', tabs: [{ name: 'FPDB', content: { type: 'table', rows: [] } }] }] };
    }
    return { groups };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchFps(match) {
  try {
    const provider = match.supplier_name || '';
    const url = `/api/fps/${encodeURIComponent(match.product_id)}?provider=${encodeURIComponent(provider)}`;
    const data = await fetchJson(url);

    const ordered = FPS_TAB_ORDER.filter((name) => name in data);
    const extras = Object.keys(data).filter((name) => !FPS_TAB_ORDER.includes(name));
    const tabNames = [...ordered, ...extras];

    const tabs = tabNames.map((name) => {
      const entry = data[name] || {};
      return {
        name,
        content: { type: 'json', url: entry.url, data: entry.data },
      };
    });

    return { groups: [{ name: '', tabs }] };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchMms(match) {
  try {
    const data = await fetchJson(`/api/mms/${encodeURIComponent(match.product_id)}`);
    const styles = Array.isArray(data.styles) ? data.styles : [];

    if (styles.length === 0) {
      const emptyTabs = MMS_TAB_ORDER.map((tabName) => ({
        name: tabName,
        content: { type: 'table', rows: [] },
      }));
      return { groups: [{ name: '', tabs: emptyTabs }] };
    }

    const groups = styles.map((s) => ({
      name: `${s.id} — ${s.status}`,
      tabs: MMS_TAB_ORDER.map((tabName) => ({
        name: tabName,
        content: { type: 'table', rows: (s.tabs && s.tabs[tabName]) || [] },
      })),
    }));

    return { groups };
  } catch (err) {
    return errorStructure(err.message);
  }
}

async function fetchS3(match) {
  try {
    const provider = match.supplier_name || '';
    const url = `/api/s3/${encodeURIComponent(provider)}/${encodeURIComponent(match.product_id)}`;
    const data = await fetchJson(url);

    const ordered = S3_TAB_ORDER.filter((name) => name in data);
    const extras = Object.keys(data).filter((name) => !S3_TAB_ORDER.includes(name));
    const tabNames = [...ordered, ...extras];

    const tabs = tabNames.map((name) => ({
      name,
      content: { type: 'json', data: data[name] },
    }));

    return { groups: [{ name: '', tabs }] };
  } catch (err) {
    return errorStructure(err.message);
  }
}
