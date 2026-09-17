// Avoid config bundling on Windows. Same test files, including real Workers tests.
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
process.env.XDG_CONFIG_HOME=resolve(repo,'.wrangler/config');
process.env.WRANGLER_LOG_PATH=resolve(repo,'.wrangler/logs');
let failed=false;
for(const project of ['packages/shared','packages/db','apps/web','apps/crawler']){
 const root=resolve(repo,project);process.chdir(root);
 const {startVitest}=await import(pathToFileURL(resolve(root,'node_modules/vitest/dist/node.js')));
 const options={root,config:false,configFile:false,watch:false,environment:'node',maxWorkers:2,minWorkers:1,passWithNoTests:true};
 if(project==='apps/crawler')options.include=['src/**/*.test.ts','wrangler.test.ts'];
 const ctx=await startVitest('test',[],options,{configFile:false});
 failed ||= !ctx || ctx.state.getFiles().some(f=>f.result?.state==='fail') || ctx.state.getUnhandledErrors().length>0;
 await ctx?.close();
 if(project==='apps/crawler'){
  const {cloudflareTest,readD1Migrations}=await import(pathToFileURL(resolve(root,'node_modules/@cloudflare/vitest-pool-workers/dist/pool/index.mjs')));
  const worker=await startVitest('test',[],{root,config:false,watch:false,include:['tests/**/*.test.ts']},{configFile:false,plugins:[cloudflareTest(async()=>({wrangler:{configPath:resolve(root,'wrangler.jsonc')},miniflare:{compatibilityDate:'2026-08-22',bindings:{TEST_MIGRATIONS:await readD1Migrations(resolve(repo,'packages/db/migrations'))}}}))]});
  failed ||= !worker || worker.state.getFiles().some(f=>f.result?.state==='fail') || worker.state.getUnhandledErrors().length>0;
  await worker?.close();
 }
}
process.exitCode=failed?1:0;
