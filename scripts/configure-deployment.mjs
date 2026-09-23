import './check-config.mjs';
import {deploymentConfig} from './deployment-config.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
if(process.exitCode)process.exit(process.exitCode);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
for(const app of ['web','crawler']){
 const file=resolve(root,`apps/${app}/wrangler.jsonc`);
 const config=deploymentConfig(JSON.parse(readFileSync(file,'utf8')),app,process.env);
 if(!process.argv.includes('--check'))writeFileSync(file,JSON.stringify(config,null,2)+'\n');
}
console.log(process.argv.includes('--check')?'Both Worker configurations validated; no files changed.':'Resource bindings and public variables configured. Install credentials as Worker secrets.');
