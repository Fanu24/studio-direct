import './check-config.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.exitCode)process.exit(process.exitCode);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const app of ['web','crawler']){
 const file=resolve(root,`apps/${app}/wrangler.jsonc`),config=JSON.parse(readFileSync(file,'utf8'));
 for(const key of ['SITE_URL','EMAIL_ENABLED','EMAIL_FROM','ADMIN_EMAILS'])config.vars[key]=process.env[key]||'';
 if(app==='web'){config.vars.BETTER_AUTH_URL=process.env.SITE_URL;config.vars.TURNSTILE_SITE_KEY=process.env.TURNSTILE_SITE_KEY;config.vars.STRIPE_ENABLED=process.env.STRIPE_ENABLED||'false';config.vars.LOCAL_MAIL='false';}
 writeFileSync(file,JSON.stringify(config,null,2)+'\n');
}
console.log('Deployment variables written; credentials must be installed as Worker secrets.');
