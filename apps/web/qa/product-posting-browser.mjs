// Focused browser-component test with a local reference/checkout transport.
// The real HTTP handlers, DB transactions and signed webhooks have separate integration tests.
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve,dirname,extname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {existsSync,readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const vitestRequire=createRequire(require.resolve('vitest/package.json'));
const {build}=createRequire(vitestRequire.resolve('vite/package.json'))('esbuild');
const out=resolve(root,'../../.wrangler/qa/product-posting-browser');await mkdir(out,{recursive:true});
const entry="import React from 'react';import {createRoot} from 'react-dom/client';import {JobPostForm} from './app/_components/product/job-post-form';createRoot(document.getElementById('app')).render(<JobPostForm/>);";
// Resolve and read only workspace files in Node. The native Windows bundler otherwise
// scans inaccessible ancestor directories for config; no ancestor access is needed.
const workspaceLoader={name:'workspace-files',setup(builder){
  builder.onResolve({filter:/.*/},args=>{
    if(args.path==='fixture:entry')return {path:resolve(root,'__product-fixture.tsx'),namespace:'workspace'};
    const base=dirname(args.importer),candidate=args.path.startsWith('.')?resolve(base,args.path):args.path;
    const target=isAbsolute(candidate)?[candidate,...['.ts','.tsx','.js','.jsx','.json','/index.ts','/index.tsx','/index.js'].map(ext=>candidate+ext)].find(existsSync):createRequire(resolve(base,'__resolve.cjs')).resolve(candidate);
    if(!target||!target.toLowerCase().startsWith(resolve(root,'../..').toLowerCase()+'/'.replace('/',process.platform==='win32'?'\\':'/')))throw Error('Browser dependency is outside the workspace or missing: '+args.path);
    return {path:target,namespace:'workspace'};
  });
  builder.onLoad({filter:/.*/,namespace:'workspace'},args=>({contents:args.path===resolve(root,'__product-fixture.tsx')?entry:readFileSync(args.path,'utf8'),loader:({'.ts':'ts','.tsx':'tsx','.json':'json','.jsx':'jsx'})[extname(args.path)]??'js'}));
}};
const bundle=await build({absWorkingDir:root,entryPoints:['fixture:entry'],plugins:[workspaceLoader],tsconfigRaw:{compilerOptions:{}},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"test"'}});
const choices={companies:[{id:'fixture-company',name:'Example Company',domain:'example.com'}],regions:[{id:'country:IT',name:'Italy'}],cities:[{id:3173435,name:'Milan',region:'Lombardy',country_name:'Italy'}],skills:[{id:'rust',name:'Rust'}],languages:[{id:'en',name:'English',native_name:'English'}],benefits:[]};
const submissions=[];
let authenticated=false,browser,page;
const server=createServer(async(request,response)=>{
  const url=new URL(request.url,'http://localhost');
  if(url.pathname==='/bundle.js'){response.setHeader('Content-Type','text/javascript');response.end(bundle.outputFiles[0].contents);return;}
  if(url.pathname==='/api/product/reference'){response.setHeader('Content-Type','application/json');response.end(JSON.stringify({items:choices[url.searchParams.get('kind')]??[]}));return;}
  if(url.pathname==='/api/product/jobs/checkout'){
    let body='';for await(const part of request)body+=part;submissions.push(JSON.parse(body));response.setHeader('Content-Type','application/json');
    response.statusCode=authenticated?200:401;response.end(JSON.stringify(authenticated?{url:'/checkout-fixture'}:{login:'/employer/login?next=/post-web3-job'}));return;
  }
  if(url.pathname==='/employer/login'){authenticated=true;response.end('<h1>Fixture login</h1><a href="/post-web3-job">Return to your draft</a>');return;}
  if(url.pathname==='/checkout-fixture'){response.end('<h1>Checkout reached</h1>');return;}
  response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>Product form QA</title><div id="app"></div><script src="/bundle.js"></script></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
try{
  const installed=chromium.executablePath();const fallback=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
  browser=await chromium.launch({headless:true,...(!existsSync(installed)&&fallback?{executablePath:fallback}:{})});
  page=await browser.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/post-web3-job');
  await page.getByLabel('Job title',{exact:false}).fill('x');await page.getByRole('textbox',{name:/Job description/}).focus();
  await expect(page.getByText('Enter a job title between 3 and 120 characters.')).toBeVisible();
  await page.getByRole('button',{name:/Continue to checkout/}).click();expect(submissions).toHaveLength(0);
  await page.getByLabel('Job title',{exact:false}).fill('Protocol Engineer');
  await page.getByRole('textbox',{name:/Job description/}).fill('Build reliable blockchain infrastructure and collaborate with engineers on security reviews and releases. '.repeat(3));
  async function choose(label,name){await page.getByRole('combobox',{name:new RegExp(label)}).fill(name);await page.getByRole('option',{name:new RegExp('^'+name)}).click();}
  await choose('Company name','Example Company');await expect(page.getByLabel('Company website')).toHaveValue('https://example.com');
  await page.getByLabel('Minimum',{exact:true}).fill('5000');await page.getByLabel('Maximum',{exact:true}).fill('7000');
  await page.getByLabel('Currency',{exact:true}).selectOption('EUR');await page.getByLabel('Period',{exact:true}).selectOption('monthly');
  await page.getByLabel('Salary or fee can be paid in crypto').check();await page.getByLabel(/Hide salary range/).check();
  await page.getByLabel('Hybrid',{exact:true}).check();await choose('Location','Milan');await expect(page.getByText('Candidate eligibility',{exact:false})).toHaveCount(0);
  await page.getByLabel('Remote',{exact:true}).check();await expect(page.getByRole('combobox',{name:/^Location/})).toHaveCount(0);
  await page.getByLabel('Restrict by time zone instead').check();await page.getByLabel('From',{exact:true}).selectOption('330');await page.getByLabel('To',{exact:true}).selectOption('840');
  await page.getByLabel('Restrict by time zone instead').uncheck();await choose('Countries, territories and regions','Italy');
  await choose('Required skills','Rust');await choose('Languages','English');
  await page.getByLabel('Email',{exact:true}).check();await page.getByLabel('Applications email').fill('hiring@example.com');
  await page.getByLabel('Pinned placement').selectOption('3');await expect(page.getByRole('button',{name:'Continue to checkout · $219.00'})).toBeVisible();
  await page.getByRole('button',{name:/Continue to checkout/}).click();await expect(page.getByRole('heading',{name:'Fixture login'})).toBeVisible();
  await page.getByRole('link',{name:'Return to your draft'}).click();
  await expect(page.getByLabel('Job title',{exact:false})).toHaveValue('Protocol Engineer');await expect(page.getByLabel('Minimum',{exact:true})).toHaveValue('5000');
  await page.getByRole('button',{name:/Continue to checkout/}).click();await expect(page.getByRole('heading',{name:'Checkout reached'})).toBeVisible();
  expect(submissions).toHaveLength(2);expect(submissions[1].id).toBe(submissions[0].id);
  expect(submissions[1].listing).toMatchObject({salaryCurrency:'EUR',salaryPeriod:'monthly',cryptoPaymentAvailable:true,workArrangement:'remote',requiredSkillIds:['rust'],applicationsEmail:'hiring@example.com'});
  expect(submissions[1].addons).toMatchObject({pinDays:3,hideSalary:true});expect(errors).toEqual([]);
  await writeFile(resolve(out,'result.json'),JSON.stringify({passed:true,checks:['required-field validation','conditional location and eligibility','canonical suggestions','current price total','draft restored after login','idempotency key retained'],transport:'local fixture; HTTP payment integration tested separately'},null,2));
  console.log('Product form browser checks passed. No live users, jobs or payments created.');
}catch(error){if(page){await writeFile(resolve(out,'failure.html'),await page.content());await page.screenshot({path:resolve(out,'failure.png'),fullPage:true});}await writeFile(resolve(out,'result.json'),JSON.stringify({passed:false,error:String(error)},null,2));throw error;}
finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
