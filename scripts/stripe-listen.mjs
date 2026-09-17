import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),file=resolve(root,'apps/web/.dev.vars');
const source=readFileSync(file,'utf8'),key=source.match(/^STRIPE_SECRET_KEY=(.*)$/m)?.[1]?.trim();
if(!key||!/^([sr]k)_test_/.test(key))throw Error('Configure a Stripe test secret key in apps/web/.dev.vars. Live keys are refused.');
const cli=process.env.STRIPE_CLI||'stripe';
mkdirSync(resolve(root,'.wrangler/config'),{recursive:true});
const child=spawn(cli,['listen','--forward-to','http://localhost:3000/api/stripe/webhook',
  '--events','checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.expired,invoice.paid,charge.refunded,customer.subscription.deleted'],{
  cwd:root,windowsHide:true,env:{...process.env,STRIPE_API_KEY:key,STRIPE_DEVICE_NAME:'studio-direct-local-tests',XDG_CONFIG_HOME:resolve(root,'.wrangler/config')},
});
let pending='';
function output(chunk){
  pending+=chunk.toString();
  let newline;
  while((newline=pending.indexOf('\n'))>=0){
    const line=pending.slice(0,newline);pending=pending.slice(newline+1);
    const secret=line.match(/whsec_[a-zA-Z0-9]+/)?.[0];
    if(secret){let config=readFileSync(file,'utf8');config=config.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m,'STRIPE_WEBHOOK_SECRET='+secret);writeFileSync(file,config,{mode:0o600});}
    console.log(line.replace(/(?:whsec_|sk_test_|rk_test_)[a-zA-Z0-9]+/g,'[REDACTED]'));
    if(secret)console.log('Webhook signing secret saved locally. Restart pnpm dev after the first connection.');
  }
}
child.stdout.on('data',output);child.stderr.on('data',output);
child.on('error',error=>{console.error('Stripe CLI failed: '+error.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
process.on('SIGINT',()=>child.kill());
process.on('SIGTERM',()=>child.kill());
