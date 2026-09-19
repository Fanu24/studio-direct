import {platform} from '../../../lib/platform';
import {advertisingConfig} from '../../../lib/advertising';
export async function GET(){return Response.json(await advertisingConfig((await platform()).DB),{headers:{'Cache-Control':'public, max-age=60'}});}
