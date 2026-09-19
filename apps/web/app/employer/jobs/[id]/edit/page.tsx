import {redirect,notFound} from 'next/navigation';
import {platform,currentUser} from '../../../../../lib/platform';
import {ownedListing} from '../../../../../lib/billing/listing-management';
import {ListingForm} from '../../../../_components/listing-form';
export const dynamic='force-dynamic';
export const metadata={title:'Edit your job',robots:{index:false,follow:false}};
export default async function EditJob({params}:{params:Promise<{id:string}>}){
 const raw=await params;let id:string;try{id=decodeURIComponent(raw.id);}catch{notFound();}
 const env=await platform(),user=await currentUser(env);if(!user)redirect('/employer/login');
 const job=await ownedListing(env.DB,user.id,id);if(!job)notFound();
 return <main className="container"><h1>Edit your job</h1><p>Changes retain your existing placement and expiry date.</p><ListingForm editJobId={id} initialListing={job.input} creditSelection={job.selection}/></main>;
}
