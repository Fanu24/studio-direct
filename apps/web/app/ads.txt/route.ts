import {platform} from '../../lib/platform';
import {advertisingConfig} from '../../lib/advertising';
export const dynamic='force-dynamic';
export async function GET(){const config=await advertisingConfig((await platform()).DB);return new Response(config.mode==='off'?'# No advertising network enabled\n':`google.com, ${config.publisher.replace('ca-','')}, DIRECT, f08c47fec0942fa0\n`,{headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=300'}});}
