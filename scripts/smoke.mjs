const base=process.env.SITE_URL||'http://localhost:3000';
let failed=false;
for(const path of ['/','/jobs','/post-web3-job','/post-web3-job/bundle','/ads','/hire','/web3-salaries','/web3-companies','/login']){
 try{const response=await fetch(new URL(path,base),{signal:AbortSignal.timeout(60000)});const html=await response.text();const ok=response.status===200&&html.includes('<main')&&!html.includes('Application error:');console.log(`${path}: ${response.status}${ok?'':' FAILED'}`);failed ||= !ok;}catch(error){failed=true;console.error(`${path}: ${error.message}`);}
}
process.exitCode=failed?1:0;
