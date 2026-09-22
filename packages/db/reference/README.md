# Canonical product reference data

These are reference catalogues, not demo jobs or candidate activity. They can be imported into a real environment without transferring local users, applications or payments.

- Countries, administrative regions, cities, coordinates and IANA time zones: [GeoNames](https://download.geonames.org/export/dump/), CC BY 4.0. The supplied `GEONAMES-README.txt` retains the publisher's attribution and format. The snapshot includes populated places above 15,000 inhabitants and administrative capitals; it is not a list of every settlement. `geonames-manifest.json` records source hashes. Kosovo's `XK` is a documented GeoNames extension, not an assigned ISO 3166-1 code. Obsolete AN and CS records are excluded. The UI labels all choices as countries/territories.
- Languages and autonyms: [iso-639-1](https://github.com/meikidd/iso-639-1), MIT; retain `ISO-LANGUAGES-LICENSE`. `languages-manifest.json` records the fetched literal-data hash and the resulting JSON hash. No downloaded JavaScript was executed. This catalogue contains 183 codes; the older GeoNames `bh` and `sh` entries are not selectable. `languages-source.json` is retained solely as the original GeoNames source, not used for language selection.
- Skills, benefits and roles: editorial Nodework reference vocabulary in `packages/shared/src/product/taxonomy.ts`. It has separate canonical IDs, aliases and word-boundary role patterns. Unknown titles remain unmapped; no salary cohort is invented. Existing legacy facets are retained.
- Recruiting regions: explicit country sets in `packages/shared/src/product/regions.ts`. These are product eligibility groupings, not legal or political membership claims. They are visible to the poster and expand to countries on the server. `North America` exists once; selecting overlapping groups deduplicates the resulting countries. Worldwide includes all countries/territories.

## Rebuild and apply

1. `node scripts/download-reference-data.mjs` downloads GeoNames into ignored `.wrangler/reference-data/geonames`, with size and timeout bounds.
2. `python scripts/prepare-geonames.py` verifies the manifest and prepares the geographic JSON. Language JSON is a checked-in, separately attributed snapshot; it is not regenerated from GeoNames.
3. `node scripts/build-reference-import.mjs` validates all catalogues and writes ignored `.wrangler/reference-data/reference-import.sql` and its SHA-256 receipt. This step does not connect to D1 or enable any feature.
4. Apply migration 0024 (and subsequent product migrations when ready) to the intended database before importing. Apply the SQL with Wrangler using an **explicit configuration and local/remote target**. For the deployed Nodework preview use `apps/web/wrangler.preview.jsonc`, binding `DB`; do not use the legacy default configuration remotely.

Imports are retry-safe upserts by stable identity, preserving skill moderation status and existing foreign-key associations. The script does not delete entries or activate feature flags. Verify row counts, source hashes and representative city/language/alias queries after import. Rollback disables the product flag and retains reference data; do not drop referenced tables on a populated database.
