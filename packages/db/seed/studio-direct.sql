INSERT OR IGNORE INTO tenants (id, slug, name)
VALUES ('tenant:gaming', 'nodework', 'Nodework');

INSERT OR IGNORE INTO companies (
  id, tenant_id, name, name_norm, domain, logo_url, career_url,
  ats_type, ats_slug, listed, created_at
)
VALUES
  (
    'company:riot', 'tenant:gaming', 'Riot Games', 'riot',
    'riotgames.com', 'https://logo.clearbit.com/riotgames.com',
    'https://boards-api.greenhouse.io/v1/boards/riotgames/jobs',
    'greenhouse', 'riotgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:dream', 'tenant:gaming', 'Dream Games', 'dream',
    'dreamgames.com', 'https://logo.clearbit.com/dreamgames.com',
    'https://boards-api.greenhouse.io/v1/boards/dreamgames/jobs',
    'greenhouse', 'dreamgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:scopely', 'tenant:gaming', 'Scopely', 'scopely',
    'scopely.com', 'https://logo.clearbit.com/scopely.com',
    'https://boards-api.greenhouse.io/v1/boards/scopely/jobs',
    'greenhouse', 'scopely', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:epic', 'tenant:gaming', 'Epic Games', 'epic',
    'epicgames.com', 'https://logo.clearbit.com/epicgames.com',
    'https://boards-api.greenhouse.io/v1/boards/epicgames/jobs',
    'greenhouse', 'epicgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:roblox', 'tenant:gaming', 'Roblox', 'roblox',
    'roblox.com', 'https://logo.clearbit.com/roblox.com',
    'https://boards-api.greenhouse.io/v1/boards/roblox/jobs',
    'greenhouse', 'roblox', 1, '2026-09-02T00:00:00.000Z'
  );

-- Demo jobs (development fixture only - NOT real market salary data).
-- Salary figures below are synthetic placeholders that exist only so the
-- local verification loop exercises the salary_min/salary_max/salary_text
-- columns and UI instead of always seeing them blank. A meaningful share
-- (4 of 6) carries salary data; the rest is left null on purpose to also
-- exercise the honest-empty-state path.
INSERT OR IGNORE INTO jobs (
  id, tenant_id, company_id, canonical_key, title, title_norm, slug,
  location, remote, description_html, apply_url,
  salary_text, salary_min, salary_max,
  source, external_id, featured_until, highlight, exclusivity,
  seen_on_indeed, posted_at, listed, created_at, updated_at
)
VALUES
  (
    'job:demo:riot-backend', 'tenant:gaming', 'company:riot',
    'demo:riot-backend-engineer', 'Backend Engineer', 'backend-engineer',
    'backend-engineer-riot-games-demo1',
    'Los Angeles, CA', 'hybrid',
    '<p>Build backend services for live game platforms. Development fixture job.</p>',
    'https://boards.greenhouse.io/riotgames/jobs/demo1',
    '$140k - $190k', 140000, 190000,
    'career_page', 'demo1', NULL, 0, 'unknown',
    0, '2026-08-20T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  ),
  (
    'job:demo:dream-client', 'tenant:gaming', 'company:dream',
    'demo:dream-client-engineer', 'Client Engineer', 'client-engineer',
    'client-engineer-dream-games-demo2',
    'Istanbul, Turkey', 'onsite',
    '<p>Ship mobile game client features. Development fixture job.</p>',
    'https://boards.greenhouse.io/dreamgames/jobs/demo2',
    '$60k - $90k', 60000, 90000,
    'career_page', 'demo2', NULL, 0, 'unknown',
    0, '2026-08-18T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  ),
  (
    'job:demo:scopely-data', 'tenant:gaming', 'company:scopely',
    'demo:scopely-data-scientist', 'Data Scientist', 'data-scientist',
    'data-scientist-scopely-demo3',
    'Remote', 'remote',
    '<p>Analyze live-ops player data across titles. Development fixture job.</p>',
    'https://boards.greenhouse.io/scopely/jobs/demo3',
    '$130k - $170k', 130000, 170000,
    'career_page', 'demo3', NULL, 0, 'unknown',
    0, '2026-08-25T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  ),
  (
    'job:demo:epic-gameplay', 'tenant:gaming', 'company:epic',
    'demo:epic-gameplay-programmer', 'Gameplay Programmer', 'gameplay-programmer',
    'gameplay-programmer-epic-games-demo4',
    'Cary, NC', 'onsite',
    '<p>Build gameplay systems in Unreal Engine. Development fixture job.</p>',
    'https://boards.greenhouse.io/epicgames/jobs/demo4',
    NULL, NULL, NULL,
    'career_page', 'demo4', NULL, 0, 'unknown',
    0, '2026-08-15T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  ),
  (
    'job:demo:roblox-product', 'tenant:gaming', 'company:roblox',
    'demo:roblox-product-designer', 'Product Designer', 'product-designer',
    'product-designer-roblox-demo5',
    'San Mateo, CA', 'hybrid',
    '<p>Design creator tooling used by millions of players. Development fixture job.</p>',
    'https://boards.greenhouse.io/roblox/jobs/demo5',
    '$120k - $160k', 120000, 160000,
    'career_page', 'demo5', NULL, 0, 'unknown',
    0, '2026-08-28T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  ),
  (
    'job:demo:riot-support', 'tenant:gaming', 'company:riot',
    'demo:riot-support-specialist', 'Player Support Specialist', 'player-support-specialist',
    'player-support-specialist-riot-games-demo6',
    'Dublin, Ireland', 'onsite',
    '<p>Support players across EMEA. Development fixture job.</p>',
    'https://boards.greenhouse.io/riotgames/jobs/demo6',
    NULL, NULL, NULL,
    'career_page', 'demo6', NULL, 0, 'unknown',
    0, '2026-08-10T00:00:00.000Z', 1, '2026-09-02T00:00:00.000Z', '2026-09-02T00:00:00.000Z'
  );

SELECT
  (SELECT COUNT(*) FROM tenants WHERE slug = 'nodework') AS tenant_count,
  (SELECT COUNT(*) FROM companies WHERE tenant_id = 'tenant:gaming') AS company_count,
  (SELECT COUNT(*) FROM jobs WHERE tenant_id = 'tenant:gaming' AND id LIKE 'job:demo:%') AS demo_job_count;
