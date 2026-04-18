module.exports = {
  // FPDB Data — raw supplier data from fulfillment_products_service tables
  // $1 = product_id (supplier's ID), $2 = provider_name
  fpdbQueries: [
    {
      name: 'Products',
      sql: `SELECT product_id, provider_name, product_name, description,
              product_brand, line_name, primary_image_url,
              is_caution, caution_comment, is_closeout,
              creation_date, last_change_date, effective_date, end_date
            FROM rawdata.fulfillment_products_service_products
            WHERE product_id = $1
            ORDER BY provider_name
            LIMIT 100`,
    },
    {
      name: 'Parts',
      sql: `SELECT part_id, product_id, provider_name, description,
              color_name, color_hex, color_standard_name,
              primary_material, label_size, custom_size,
              country_of_origin, lead_time, gtin,
              dimension_uom, depth, height, width,
              weight_uom, weight,
              rush_service, closeout, hazmat, is_on_demand
            FROM rawdata.fulfillment_products_service_parts
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Prices',
      sql: `SELECT product_id, provider_name, currency,
              group_name, group_desc, discount_code,
              price, quantity_min, quantity_max
            FROM rawdata.fulfillment_products_service_product_prices
            WHERE product_id = $1
            ORDER BY group_name, quantity_min
            LIMIT 200`,
    },
    {
      name: 'Inventory',
      sql: `SELECT product_id, provider_name, part_id,
              part_color, label_size, part_description,
              quantity_available, quantity_uom,
              main_part, manufactured_item, buy_to_order,
              replenishment_lead_time, last_modified
            FROM rawdata.fulfillment_products_service_part_inventories
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Aux Details',
      sql: `SELECT product_id, provider_name, description, features, hazmat
            FROM rawdata.fulfillment_products_service_auxiliary_product_details
            WHERE product_id = $1
            LIMIT 100`,
    },
    {
      name: 'Categories',
      sql: `SELECT category_id, product_id, provider_name, category_name, subcategory
            FROM rawdata.fulfillment_products_service_categories
            WHERE product_id = $1
            ORDER BY category_name
            LIMIT 200`,
    },
    {
      name: 'Promo SKUs',
      sql: `SELECT id, product_id, provider_name, part_id, part_group,
              decoration_id, mms_sku, created_at, updated_at, disabled_at
            FROM rawdata.fulfillment_products_service_fulfillment_promo_product_skus
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Promo Views',
      sql: `SELECT id, provider_name, product_id, location_id,
              decoration_id, mms_view_name, created_at, updated_at
            FROM rawdata.fulfillment_products_service_fulfillment_promo_product_views
            WHERE product_id = $1
            LIMIT 200`,
    },
    {
      name: 'Future Inventory',
      sql: `SELECT product_id, provider_name, part_id,
              inventory_location_id, quantity, quantity_uom, available_on
            FROM rawdata.fulfillment_products_service_inventory_future_availabilities
            WHERE product_id = $1
            ORDER BY part_id, available_on
            LIMIT 200`,
    },
    {
      name: 'Media Class Types',
      sql: `SELECT media_class_type_id, product_media_id, product_id, provider_name,
              class_type_id, class_type_name, media_type
            FROM rawdata.fulfillment_products_service_media_class_types
            WHERE product_id = $1
            LIMIT 200`,
    },
    {
      name: 'Part Colors',
      sql: `SELECT product_id, provider_name, part_id, ordinal,
              color_name, color_hex, color_standard_name, approximate_pms
            FROM rawdata.fulfillment_products_service_part_colors
            WHERE product_id = $1
            ORDER BY part_id, ordinal
            LIMIT 200`,
    },
    {
      name: 'Inventory Locations',
      sql: `SELECT product_id, provider_name, part_id,
              inventory_location_id, inventory_location_name,
              postal_code, country, quantity, quantity_uom
            FROM rawdata.fulfillment_products_service_part_inventory_locations
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Part Packages',
      sql: `SELECT product_id, provider_name, part_id,
              "default", package_type, description, quantity,
              dimension_uom, depth, height, width, weight_uom, weight
            FROM rawdata.fulfillment_products_service_part_packages
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Shipping Packages',
      sql: `SELECT product_id, provider_name, part_id,
              package_type, quantity,
              dimension_uom, depth, height, width, weight_uom, weight
            FROM rawdata.fulfillment_products_service_part_shipping_packages
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Config Charges',
      sql: `SELECT product_id, provider_name, location_id, decoration_id,
              charge_id, charge_name, charge_description, charge_type,
              x_min_qty, x_uom, y_min_qty, y_uom,
              price, repeat_price,
              price_effective_date, price_expiry_date, updated_at
            FROM rawdata.fulfillment_products_service_product_configuration_charges
            WHERE product_id = $1
            ORDER BY charge_name
            LIMIT 200`,
    },
    {
      name: 'Config Parts',
      sql: `SELECT product_id, provider_name, part_id,
              part_description, part_group, part_group_description,
              part_group_required, part_ratio, updated_at
            FROM rawdata.fulfillment_products_service_product_configuration_parts
            WHERE product_id = $1
            ORDER BY part_group, part_id
            LIMIT 200`,
    },
    {
      name: 'Configurations',
      sql: `SELECT product_id, provider_name,
              location_id, location_name, location_rank, default_location,
              decoration_id, decoration_name, decoration_geometry,
              decoration_height, decoration_width, decoration_diameter, decoration_uom,
              decorations_included, max_decoration, min_decoration,
              default_decoration, lead_time, rush_lead_time, updated_at
            FROM rawdata.fulfillment_products_service_product_configurations
            WHERE product_id = $1
            ORDER BY location_rank
            LIMIT 200`,
    },
    {
      name: 'FOBs',
      sql: `SELECT product_id, provider_name,
              fob_id, fob_city, fob_state, fob_postal_code
            FROM rawdata.fulfillment_products_service_product_fobs
            WHERE product_id = $1
            LIMIT 200`,
    },
    {
      name: 'Media',
      sql: `SELECT product_id, provider_name, part_id,
              url, media_type, file_size, width, height, dpi,
              color, description, single_part, updated_at
            FROM rawdata.fulfillment_products_service_product_media_contents
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Parts Locations',
      sql: `SELECT product_id, provider_name, part_id, location_id
            FROM rawdata.fulfillment_products_service_product_parts_locations
            WHERE product_id = $1
            ORDER BY part_id
            LIMIT 200`,
    },
    {
      name: 'Related Products',
      sql: `SELECT product_id, provider_name,
              relation_type, related_product_id
            FROM rawdata.fulfillment_products_service_related_products
            WHERE product_id = $1
            LIMIT 200`,
    },
  ],

  // MMS Data — raw MMS tables from rawdata, keyed on product_id via mill_no.
  // Returns ALL matching styles (any status); client renders them as pills.
  // $1 = product_id (matches mms_styles.mill_no).
  mmsAllStylesSql: `SELECT id, name, manufacturer, mill_no, status,
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
    ORDER BY deployed_at DESC NULLS LAST, id ASC
    LIMIT 20`,

  // $1 = array of style ids — returns all colors grouped later by style_id.
  mmsColorsForStylesSql: `SELECT id, style_id, name, status,
           pricing_group_id, mill_no, branding_method,
           realb, singles_price, singles_enabled,
           abo_enabled, dtg_enabled, inventory_enabled,
           deploy_type, suppliers,
           deployed_at, retired_at, created_at, updated_at
    FROM rawdata.mms_colors
    WHERE style_id = ANY($1)
    ORDER BY style_id, name
    LIMIT 2000`,

  // $1 = array of style ids — one row per (size × SUID) across the given styles; grouped later by style_id.
  mmsSkusSuidsForStylesSql: `SELECT c.style_id,
           c.id AS color_id, c.name AS color_name, c.status AS color_status,
           sz.id AS size_id, sz.name AS size_name, sz.position,
           sz.status AS size_status, sz.gtin, sz.in_stock,
           sz.last_known_supplier_quantity, sz.oos_threshold,
           sk.status AS sku_status,
           u.supplier_id, u.uid
    FROM rawdata.mms_colors c
    JOIN rawdata.mms_sizes sz ON sz.color_id = c.id
    LEFT JOIN rawdata.mms_skus sk
      ON sk.style_id = c.style_id
     AND sk.color_id = c.id
     AND UPPER(sk.size_id) = UPPER(sz.name)
    LEFT JOIN rawdata.mms_supplier_unique_ids u
      ON u.size_id = sz.id
    WHERE c.style_id = ANY($1)
    ORDER BY c.style_id, c.name, sz.position, u.supplier_id
    LIMIT 2000`,

  // S3 raw data — pre-processing JSON files from supplier data bucket
  s3Bucket: 'datafuse-promo-standards',
  s3Files: [
    { name: 'Product', path: 'products/{id}.json' },
    { name: 'Inventory', path: 'inventory/{id}-inventory.json' },
    { name: 'Media Images', path: 'media/{id}-image.json' },
    { name: 'Media Documents', path: 'media/{id}-document.json' },
    { name: 'Config', path: 'configs/{id}-config.json' },
  ],

  // {id} = product_id (supplier's), {provider} = provider_name from FPDB
  fpsEndpoints: [
    {
      name: 'Product',
      path: '/api/v1/products?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Inventory',
      path: '/api/v1/products/inventories?provider_name={provider}&product_id={id}',
    },
    {
      name: 'SKU Details',
      path: '/api/v1/skus/details?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Configurations',
      path: '/api/v1/products/configurations?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Charges',
      path: '/api/v1/products/charges?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Templates',
      path: '/api/v1/products/templates?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Quantities',
      path: '/api/v1/products/quantities?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Parts',
      path: '/api/v1/products/parts?provider_name={provider}&product_id={id}',
    },
    {
      name: 'Packages',
      path: '/api/v1/products/packages?provider_name={provider}&product_id={id}',
    },
  ],

  // Universal links shown for every product.
  // Placeholders: {id} = product_id, {style_id} = MMS style ID
  externalLinks: [
    {
      name: 'MMS',
      urlPattern: 'https://mms.example.com/styles/{style_id}',
    },
  ],

  // Supplier product page / search URLs keyed by provider_name.
  // Placeholder: {id} = product_id.
  // Only displayed if the product's provider matches a key here.
  supplierLinks: {
    koozie: 'https://www.kooziegroup.com/searchai/?query={id}',
    stregis: 'https://us.stregisgrp.com/channel/home-office/detail/{id}',
    showdowndisplays: 'https://www.showdowndisplays.com/ProductSearch?SearchWords={id}&SearchType=ProductSearch',
    hitpromo: 'https://www.hitpromo.net/search/product/{id}',
    pcna: 'https://www.pcna.com/en-us/Search?SearchTerm={id}',
    ariel: 'https://www.arielpremium.com/product/{id}',
    snugz: 'https://snugzusa.com/product/{id}',
    primeline: 'https://www.primeline.com/search?q={id}',
    customink: 'https://www.customink.com/products/results?keyword={id}',
    moderneglass: 'https://glassamerica.com/Product.cfm?ProductID={id}',
    etsexpress: 'https://etsexpress.com/pg_product_detail/?id={id}',
    hubpen: 'https://hubpen.com/?s={id}&post_type=product',
    districtphoto: 'https://www.districtphoto.com/products/p/{id}',
    magnet: 'https://themagnetgroup.com/shop?search={id}',
    gemline: 'https://gemline.com/s/global-search/{id}',
  },

  // Tab ordering — controls display order for each section.
  // FPDB uses grouped tabs (two-level nav). Others use flat ordering.
  fpdbGroups: [
    { group: 'Product', tabs: ['Products', 'Aux Details', 'Categories', 'Related Products'] },
    { group: 'Parts & Colors', tabs: ['Parts', 'Part Colors', 'Parts Locations'] },
    { group: 'Pricing', tabs: ['Prices'] },
    { group: 'Inventory', tabs: ['Inventory', 'Inventory Locations', 'Future Inventory'] },
    { group: 'Packaging', tabs: ['Part Packages', 'Shipping Packages'] },
    { group: 'Configuration', tabs: ['Configurations', 'Config Parts', 'Config Charges'] },
    { group: 'Media', tabs: ['Media', 'Media Class Types'] },
    { group: 'Fulfillment', tabs: ['Promo SKUs', 'Promo Views', 'FOBs'] },
  ],

  fpsTabOrder: ['Product', 'Inventory', 'SKU Details', 'Configurations', 'Charges', 'Decorations', 'Templates', 'Quantities', 'Parts', 'Packages'],

  mmsTabOrder: ['Style', 'Colors', 'SKUs & SUIDs'],

  s3TabOrder: ['Product', 'Inventory', 'Media Images', 'Media Documents', 'Config'],

  // Lookup: FPDB only. Search by product_id.
  // Returns: product_id, provider_name (as supplier_name), product_name
  lookupSql: `SELECT DISTINCT
      product_id,
      provider_name AS supplier_name,
      product_name
    FROM rawdata.fulfillment_products_service_products
    WHERE product_id = $1
    LIMIT 20`,
};
