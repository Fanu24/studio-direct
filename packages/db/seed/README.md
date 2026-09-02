# Company seed operations

## Add companies from CSV

Use a UTF-8 CSV with this header:

```csv
name,career_url,ats_type,ats_slug
Example Studio,https://boards-api.greenhouse.io/v1/boards/example/jobs,greenhouse,example
JSON-LD Studio,https://example.com/careers,,
```

Before adding a row:

1. Confirm the company is a game studio or directly relevant publisher.
2. Confirm `career_url` is the company's public HTTPS careers endpoint.
3. Set `ats_type` to `greenhouse` or `lever`. Leave it empty for a careers
   page that uses the JobPosting JSON-LD fallback. Never set
   `ats_type=jsonld`: the crawler reaches the JSON-LD fallback only when
   `ats_type` is empty/null.
4. Set `ats_slug` to the Greenhouse or Lever board identifier. Leave it empty
   for the JSON-LD fallback.
5. Deduplicate by normalized company name and careers URL.

The repository does not currently import CSV directly. Review the CSV, then add
each accepted row to `companies.json` with `domain` derived from the company
site and `listed: 1`; convert empty ATS fields to JSON `null`. Add the
equivalent idempotent row to
`studio-direct.sql`. Keep names, URLs, ATS values, and slugs identical in both
files, using SQL `NULL` for empty ATS fields, then run:

```powershell
pnpm --filter @gaming/db test
pnpm --filter @gaming/db typecheck
pnpm --filter @gaming/db seed
```

The seed command targets local D1. Do not substitute a remote or production
database flag.

## Grow toward 300 listed jobs

1. Grow the reviewed company seed incrementally to 500 companies. Add small
   batches, run the local seed, crawl them, and record failures before the next
   batch.
2. Prioritize Greenhouse and Lever boards, then public careers pages with
   valid JobPosting JSON-LD.
3. After each batch, measure distinct, currently listed remote/hybrid jobs
   observed on a first-party career page:

```sql
SELECT COUNT(DISTINCT j.id) AS listed_remote_career_page_jobs
FROM jobs AS j
WHERE j.listed = 1
  AND j.remote IN ('remote', 'hybrid')
  AND EXISTS (
    SELECT 1
    FROM job_sightings AS s
    WHERE s.job_id = j.id
      AND s.source = 'career_page'
  );
```

The target is at least 300 by this measure. Track seeded companies, successful
career crawls, and the measured job count together so seed size is not mistaken
for coverage.

Only evaluate Ashby or Workable support if 500 reviewed companies using
Greenhouse, Lever, and JobPosting JSON-LD still cannot reach 300. Record the
measured shortfall first; adding an ATS requires a separate implementation and
test plan.
