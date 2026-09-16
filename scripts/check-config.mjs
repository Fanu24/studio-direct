// Reads deployment variables from the process, never prints their values.
const errors=[];
const env=process.env;
let origin;
try {origin=new URL(env.SITE_URL);if(origin.protocol!=='https:'||origin.hostname==='localhost'||origin.hostname.endsWith('.example')) throw Error();}
catch {errors.push('SITE_URL must be your public HTTPS origin');}
if(!env.BETTER_AUTH_SECRET||env.BETTER_AUTH_SECRET.length<32)errors.push('BETTER_AUTH_SECRET must have at least 32 random characters');
if(env.LOCAL_MAIL==='true')errors.push('LOCAL_MAIL must be disabled in production');
if(!env.ADMIN_EMAILS?.trim())errors.push('ADMIN_EMAILS is required for administration');
if(!env.TURNSTILE_SITE_KEY||!env.TURNSTILE_SECRET_KEY||env.TURNSTILE_SITE_KEY==='1x00000000000000000000AA')errors.push('Configure production Turnstile keys');
if(env.EMAIL_ENABLED!=='true'||!env.EMAIL_FROM||/localhost|\.example|\.invalid/.test(env.EMAIL_FROM))errors.push('Activate a verified sender and EMAIL_ENABLED for production login and alerts');
if(env.STRIPE_ENABLED==='true'&&(!/^sk_(test|live)_/.test(env.STRIPE_SECRET_KEY||'')||!env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')))errors.push('Stripe checkout requires secret and signed webhook keys');
if(errors.length){console.error('Configuration incomplete:\n'+errors.map(x=>'- '+x).join('\n'));process.exitCode=1;}
else console.log('Required variable formats checked. Verify bindings, email delivery and Stripe sandbox separately before launch.');
