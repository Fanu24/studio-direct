import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const state = resolve(root, '.wrangler/state');
mkdirSync(state, { recursive: true });
const file = resolve(root, 'apps/web/.dev.vars');
if (!existsSync(file)) {
  writeFileSync(file, [
    'SITE_URL=http://localhost:3000',
    'BETTER_AUTH_URL=http://localhost:3000',
    `BETTER_AUTH_SECRET=${randomBytes(32).toString('hex')}`,
    'LOCAL_MAIL=true', 'EMAIL_ENABLED=false',
    'EMAIL_FROM=noreply@localhost.invalid',
    'ADMIN_EMAILS=admin@example.test',
    'TURNSTILE_SITE_KEY=1x00000000000000000000AA',
    'TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA',
    'STRIPE_ENABLED=false', 'STRIPE_SECRET_KEY=', 'STRIPE_WEBHOOK_SECRET=',
    'GOOGLE_CLIENT_ID=', 'GOOGLE_CLIENT_SECRET=', '',
  ].join('\n'), { mode: 0o600 });
  console.log('Created local configuration with a random authentication secret.');
} else console.log('Existing .dev.vars preserved.');
const crawler = resolve(root, 'apps/crawler/.dev.vars');
if (!existsSync(crawler)) writeFileSync(crawler, 'SITE_URL=http://localhost:3000\nEMAIL_ENABLED=false\nWEB3_CAREER_API_TOKEN=\n', { mode: 0o600 });
const result = spawnSync(process.execPath, [
  resolve(root, 'apps/web/node_modules/wrangler/bin/wrangler.js'),
  'd1', 'migrations', 'apply', 'gaming-jobs', '--local', '--persist-to', state,
], { cwd: resolve(root, 'apps/web'), stdio: 'inherit', env: { ...process.env,
  XDG_CONFIG_HOME: resolve(root, '.wrangler/config'), WRANGLER_LOG_PATH: resolve(root, '.wrangler/logs') } });
if (result.status !== 0) process.exit(result.status || 1);
console.log('Local D1 ready. No jobs or accounts have been seeded. Run pnpm dev.');
console.log('For local sign-in, use the link printed as [LOCAL EMAIL] in the development terminal.');
