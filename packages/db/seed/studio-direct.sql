INSERT OR IGNORE INTO tenants (id, slug, name)
VALUES ('tenant:gaming', 'gaming', 'Studio Direct');

INSERT OR IGNORE INTO companies (
  id, tenant_id, name, name_norm, domain, career_url,
  ats_type, ats_slug, listed, created_at
)
VALUES
  (
    'company:riot', 'tenant:gaming', 'Riot Games', 'riot',
    'riotgames.com', 'https://boards-api.greenhouse.io/v1/boards/riotgames/jobs',
    'greenhouse', 'riotgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:dream', 'tenant:gaming', 'Dream Games', 'dream',
    'dreamgames.com', 'https://boards-api.greenhouse.io/v1/boards/dreamgames/jobs',
    'greenhouse', 'dreamgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:scopely', 'tenant:gaming', 'Scopely', 'scopely',
    'scopely.com', 'https://boards-api.greenhouse.io/v1/boards/scopely/jobs',
    'greenhouse', 'scopely', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:epic', 'tenant:gaming', 'Epic Games', 'epic',
    'epicgames.com', 'https://boards-api.greenhouse.io/v1/boards/epicgames/jobs',
    'greenhouse', 'epicgames', 1, '2026-09-02T00:00:00.000Z'
  ),
  (
    'company:roblox', 'tenant:gaming', 'Roblox', 'roblox',
    'roblox.com', 'https://boards-api.greenhouse.io/v1/boards/roblox/jobs',
    'greenhouse', 'roblox', 1, '2026-09-02T00:00:00.000Z'
  );

SELECT
  (SELECT COUNT(*) FROM tenants WHERE slug = 'gaming') AS tenant_count,
  (SELECT COUNT(*) FROM companies WHERE tenant_id = 'tenant:gaming') AS company_count;
