import {publicJobsApi} from '../../../lib/jobs/public-api';
export const GET=(request:Request)=>publicJobsApi(request);
