import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const child=spawn(process.execPath,[resolve(root,'apps/crawler/node_modules/wrangler/bin/wrangler.js'),'dev','--local','--test-scheduled','--port','8787','--persist-to',resolve(root,'.wrangler/state')],{cwd:resolve(root,'apps/crawler'),stdio:'inherit',env:{...process.env,XDG_CONFIG_HOME:resolve(root,'.wrangler/config'),WRANGLER_LOG_PATH:resolve(root,'.wrangler/logs')}});
child.on('exit',code=>process.exit(code||0));
